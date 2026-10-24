import WebSocket,{WebSocketServer} from 'ws';
import {randomUUID} from 'node:crypto';
import {AGENT_URL,deepgramSettings,deepgramFailure} from './deepgram-settings.mjs';
import {createEnquiryDraft} from './enquiry-tool.mjs';
import {voiceErrorMessage} from '../src/voice-errors.js';

export function validClientMessage(message) {
  if(!message||typeof message!=='object'||Array.isArray(message))return false;
  if(message.type==='Start')return Number.isInteger(message.sampleRate)&&[16000,24000,32000,44100,48000].includes(message.sampleRate);
  if(message.type==='InjectUserMessage')return typeof message.content==='string'&&Boolean(message.content.trim())&&message.content.length<=1000;
  if(message.type==='UpdateEnquiryDraft')return Boolean(message.draft&&typeof message.draft==='object'&&!Array.isArray(message.draft));
  return message.type==='KeepAlive';
}
export function attachDeepgramProxy(server,{env=process.env,Socket=WebSocket,now=Date.now,logger=entry=>console.info(JSON.stringify(entry)),setTimer=setTimeout,clearTimer=clearTimeout}={}) {
  const gateway=new WebSocketServer({noServer:true,maxPayload:65536,perMessageDeflate:false});
  const active=new Map(),rates=new Map();
  const send=(client,data)=>{if(client.readyState===WebSocket.OPEN)client.send(JSON.stringify(data));};
  // Fixed event/category names and generated IDs only: never log request headers,
  // provider text, transcripts, audio, prompts, or credentials.
  const log=(sessionId,event,details={})=>{try{logger({scope:'voice',sessionId,event,...details});}catch{}};
  function upgrade(req,socket,head){
    if((req.url||'').split('?')[0]!=='/api/voice/agent')return;
    const sessionId=randomUUID();
    const reject=(status,code)=>{
      log(sessionId,'upgrade_rejected',{status:Number(status.slice(0,3)),code});
      const body=JSON.stringify({error:{code,message:voiceErrorMessage(code)},sessionId});
      socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Type: application/json\r\nCache-Control: no-store\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
    };
    let origin;try{origin=new URL(req.headers.origin||'');}catch{return reject('403 Forbidden','INVALID_ORIGIN');}
    if(!['http:','https:'].includes(origin.protocol)||origin.host!==req.headers.host)return reject('403 Forbidden','INVALID_ORIGIN');
    const ip=req.socket.remoteAddress||'local',time=now();
    let rate=rates.get(ip);if(!rate||time-rate.start>=60000){rate={start:time,count:0};rates.set(ip,rate);}
    if(++rate.count>10||(active.get(ip)||0)>=2||gateway.clients.size>=20)return reject('429 Too Many Requests','DEEPGRAM_BUSY');
    if(!env.DEEPGRAM_API_KEY?.trim())return reject('503 Service Unavailable','MISSING_KEY');
    if(rates.size>5000)for(const [id,value]of rates)if(time-value.start>60000)rates.delete(id);
    gateway.handleUpgrade(req,socket,head,client=>{active.set(ip,(active.get(ip)||0)+1);gateway.emit('connection',client,req,ip,sessionId);});
  }
  server.on('upgrade',upgrade);
  gateway.on('connection',(client,req,ip,sessionId=randomUUID())=>{
    log(sessionId,'upgrade_accepted');
    let upstream=null,started=false,settingsSent=false,ready=false,closed=false,keepAlive=null;
    let enquiry=createEnquiryDraft();const toolCalls=new Set();
    const timeout=setTimer(()=>fail('SESSION_ENDED'),Math.max(30,Math.min(900,Number(env.DEEPGRAM_MAX_SESSION_SECONDS)||300))*1000);
    let initialization=setTimer(()=>fail('INVALID_CLIENT_MESSAGE'),10000);
    function dispose(){if(closed)return;closed=true;clearTimer(timeout);clearTimer(initialization);clearInterval(keepAlive);const count=Math.max(0,(active.get(ip)||1)-1);if(count)active.set(ip,count);else active.delete(ip);if(upstream){upstream.removeAllListeners('message');upstream.on('error',()=>{});upstream.terminate();}log(sessionId,'session_closed',{ready});}
    function fail(code,status=0){if(closed)return;const failure=deepgramFailure(code,status);log(sessionId,'session_failed',{code:failure.code,status});send(client,{type:'SessionError',...failure,sessionId});client.close(code==='SESSION_ENDED'?1000:1011);dispose();}
    client.on('error',dispose);client.on('close',dispose);
    client.on('message',(data,binary)=>{
      if(closed)return;
      if(binary){
        if(!ready||!upstream||upstream.readyState!==WebSocket.OPEN)return;
        if(data.length>16384||data.length%2!==0){client.close(1008,'Invalid PCM');return;}
        if(upstream.bufferedAmount>1024*1024){fail('BACKPRESSURE');return;}
        upstream.send(data,{binary:true});return;
      }
      let message;try{message=JSON.parse(data.toString());}catch{return fail('INVALID_CLIENT_MESSAGE');}
      if(!validClientMessage(message)){client.close(1008,'Unsupported message');return;}
      if(message.type==='Start'){
        if(started){client.close(1008,'Already started');return;}started=true;clearTimer(initialization);
        let settings;try{settings=deepgramSettings(env,message.sampleRate);}catch{return fail('INVALID_SETTINGS');}
        enquiry=createEnquiryDraft(message.draft);
        log(sessionId,'upstream_connecting');
        try{upstream=new Socket(AGENT_URL,{headers:{Authorization:`Token ${env.DEEPGRAM_API_KEY.trim()}`},handshakeTimeout:20000,maxPayload:8*1024*1024,perMessageDeflate:false});}catch{return fail('CONNECTION_ERROR');}
        initialization=setTimer(()=>fail('CONNECTION_TIMEOUT'),30000);
        upstream.on('unexpected-response',(request,response)=>{response.resume();fail('UPSTREAM_HTTP',response.statusCode);});
        upstream.on('error',error=>fail(error?.code==='ETIMEDOUT'||/timed?\s*out/i.test(error?.message||'')?'CONNECTION_TIMEOUT':'CONNECTION_ERROR'));
        upstream.on('close',()=>{if(!closed)fail('CONNECTION_CLOSED');});
        upstream.on('message',(payload,isBinary)=>{
          if(closed||client.readyState!==WebSocket.OPEN)return;
          if(isBinary){if(!ready)return;if(client.bufferedAmount>2*1024*1024)return fail('BACKPRESSURE');client.send(payload,{binary:true});return;}
          let event;try{event=JSON.parse(payload.toString());}catch{return fail('UPSTREAM_MESSAGE');}
          if(!event||typeof event!=='object'||Array.isArray(event)||typeof event.type!=='string')return fail('UPSTREAM_MESSAGE');
          if(event.type==='Welcome'){if(settingsSent)return;settingsSent=true;upstream.send(JSON.stringify(settings));return;}
          if(event.type==='SettingsApplied'){
            if(ready||!settingsSent)return;
            ready=true;clearTimer(initialization);keepAlive=setInterval(()=>{if(upstream.readyState===WebSocket.OPEN)upstream.send(JSON.stringify({type:'KeepAlive'}));},5000);
            log(sessionId,'session_ready');
            send(client,{type:'SessionReady',voice:settings.agent.speak.provider.model,provider:'Deepgram'});return;
          }
          if(event.type==='Error')return fail(typeof event.code==='string'?event.code:'AGENT_ERROR');
          if(event.type==='Warning')return; // No raw provider diagnostics or config echoes in the browser.
          if(event.type==='FunctionCallRequest'){
            if(!ready)return;
            for(const fn of (Array.isArray(event.functions)?event.functions:[]).slice(0,5)){
              if(!fn||fn.client_side!==true||typeof fn.id!=='string'||fn.id.length>128||toolCalls.has(fn.id))continue;
              if(toolCalls.size>=100)return fail('LIMIT_FUNCTION_CALLS');toolCalls.add(fn.id);
              let result={error:'Unsupported function. No action was taken.',submitted:false};
              if(fn.name==='update_enquiry'){
                try{const input=JSON.parse(fn.arguments);const update=enquiry.update(input);send(client,{type:'EnquiryDraft',patch:update.patch,missing:update.missing,status:update.status});result={acceptedFields:Object.keys(update.patch),errors:update.errors,missing:update.missing,nextField:update.nextField,status:update.status,submitted:false,nextAction:update.missing.length?'Ask only for the next missing or invalid field, in a short spoken question. Do not repeat valid fields.':'The form is ready. Reply in one short spoken sentence asking the visitor to check the review form, tick consent, and press Send project enquiry. Do not read the contact values aloud, list the fields, use markdown, or claim submission.'};}
                catch{result={error:'Invalid enquiry fields. Ask the visitor to clarify.',submitted:false};}
              }
              upstream.send(JSON.stringify({type:'FunctionCallResponse',id:fn.id,name:fn.name,content:JSON.stringify(result)}));
            }
            return;
          }
          if(!ready)return;
          if(event.type==='ConversationText'){
            if(['user','assistant'].includes(event.role)&&typeof event.content==='string')send(client,{type:event.type,role:event.role,content:event.content});
          }else if(['UserStartedSpeaking','AgentThinking','AgentAudioDone','InjectionRefused'].includes(event.type))send(client,{type:event.type});
        });
      }else if(message.type==='UpdateEnquiryDraft'){enquiry.update(message.draft);}
      else if(ready&&upstream?.readyState===WebSocket.OPEN){upstream.send(JSON.stringify(message.type==='InjectUserMessage'?{type:'InjectUserMessage',content:message.content.trim()}:{type:'KeepAlive'}));}
    });
  });
  const dispose=()=>{server.off('upgrade',upgrade);for(const client of gateway.clients)client.terminate();gateway.close();};
  server.on('close',dispose);return {dispose,gateway};
}
