import WebSocket,{WebSocketServer} from 'ws';
import {AGENT_URL,deepgramSettings,deepgramError} from './deepgram-settings.mjs';
import {createEnquiryDraft} from './enquiry-tool.mjs';

export function validClientMessage(message) {
  if(!message||typeof message!=='object'||Array.isArray(message))return false;
  if(message.type==='Start')return Number.isInteger(message.sampleRate)&&[16000,24000,32000,44100,48000].includes(message.sampleRate);
  if(message.type==='InjectUserMessage')return typeof message.content==='string'&&Boolean(message.content.trim())&&message.content.length<=1000;
  if(message.type==='UpdateEnquiryDraft')return Boolean(message.draft&&typeof message.draft==='object'&&!Array.isArray(message.draft));
  return message.type==='KeepAlive';
}
export function attachDeepgramProxy(server,{env=process.env,Socket=WebSocket,now=Date.now}={}) {
  const gateway=new WebSocketServer({noServer:true,maxPayload:65536,perMessageDeflate:false});
  const active=new Map(),rates=new Map();
  const send=(client,data)=>{if(client.readyState===WebSocket.OPEN)client.send(JSON.stringify(data));};
  function upgrade(req,socket,head){
    if((req.url||'').split('?')[0]!=='/api/voice/agent')return;
    const reject=code=>{socket.write(`HTTP/1.1 ${code}\r\nConnection: close\r\n\r\n`);socket.destroy();};
    let origin;try{origin=new URL(req.headers.origin||'');}catch{return reject('403 Forbidden');}
    if(origin.host!==req.headers.host)return reject('403 Forbidden');
    const ip=req.socket.remoteAddress||'local',time=now();
    let rate=rates.get(ip);if(!rate||time-rate.start>=60000){rate={start:time,count:0};rates.set(ip,rate);}
    if(++rate.count>10||(active.get(ip)||0)>=2||gateway.clients.size>=20)return reject('429 Too Many Requests');
    if(!env.DEEPGRAM_API_KEY?.trim())return reject('503 Service Unavailable');
    if(rates.size>5000)for(const [id,value]of rates)if(time-value.start>60000)rates.delete(id);
    gateway.handleUpgrade(req,socket,head,client=>{active.set(ip,(active.get(ip)||0)+1);gateway.emit('connection',client,req,ip);});
  }
  server.on('upgrade',upgrade);
  gateway.on('connection',(client,req,ip)=>{
    let upstream=null,started=false,ready=false,closed=false,keepAlive=null;
    let enquiry=createEnquiryDraft();const toolCalls=new Set();
    const timeout=setTimeout(()=>{send(client,{type:'SessionError',code:'SESSION_ENDED',message:'This session has ended. Restart the conversation to continue.'});client.close(1000);},Math.max(30,Math.min(900,Number(env.DEEPGRAM_MAX_SESSION_SECONDS)||300))*1000);
    let initialization=setTimeout(()=>client.close(1008,'Start required'),10000);
    function dispose(){if(closed)return;closed=true;clearTimeout(timeout);clearTimeout(initialization);clearInterval(keepAlive);active.set(ip,Math.max(0,(active.get(ip)||1)-1));if(upstream){upstream.removeAllListeners('message');upstream.on('error',()=>{});upstream.terminate();}}
    function fail(code,status=0){if(closed)return;send(client,{type:'SessionError',code,message:deepgramError(code,status)});client.close(1011);dispose();}
    client.on('error',dispose);client.on('close',dispose);
    client.on('message',(data,binary)=>{
      if(closed)return;
      if(binary){
        if(!ready||!upstream||upstream.readyState!==WebSocket.OPEN)return;
        if(data.length>16384||data.length%2!==0){client.close(1008,'Invalid PCM');return;}
        if(upstream.bufferedAmount>1024*1024){fail('BACKPRESSURE');return;}
        upstream.send(data,{binary:true});return;
      }
      let message;try{message=JSON.parse(data.toString());}catch{client.close(1008,'Invalid message');return;}
      if(!validClientMessage(message)){client.close(1008,'Unsupported message');return;}
      if(message.type==='Start'){
        if(started){client.close(1008,'Already started');return;}started=true;clearTimeout(initialization);
        let settings;try{settings=deepgramSettings(env,message.sampleRate);}catch{return fail('INVALID_SETTINGS');}
        enquiry=createEnquiryDraft(message.draft);
        upstream=new Socket(AGENT_URL,{headers:{Authorization:`Token ${env.DEEPGRAM_API_KEY}`},handshakeTimeout:20000,maxPayload:8*1024*1024,perMessageDeflate:false});
        initialization=setTimeout(()=>fail('SETTINGS_TIMEOUT'),30000);
        upstream.on('unexpected-response',(request,response)=>{response.resume();fail('AUTH_OR_SERVICE_ERROR',response.statusCode);});
        upstream.on('error',()=>fail('CONNECTION_ERROR'));
        upstream.on('close',()=>{if(!closed){send(client,{type:'SessionError',code:'CONNECTION_CLOSED',message:'The voice connection ended. Restart to continue.'});client.close(1000);dispose();}});
        upstream.on('message',(payload,isBinary)=>{
          if(closed||client.readyState!==WebSocket.OPEN)return;
          if(isBinary){if(client.bufferedAmount>2*1024*1024)return fail('BACKPRESSURE');client.send(payload,{binary:true});return;}
          let event;try{event=JSON.parse(payload.toString());}catch{return;}
          if(event.type==='Welcome'){upstream.send(JSON.stringify(settings));return;}
          if(event.type==='SettingsApplied'){
            ready=true;clearTimeout(initialization);keepAlive=setInterval(()=>{if(upstream.readyState===WebSocket.OPEN)upstream.send(JSON.stringify({type:'KeepAlive'}));},5000);
            send(client,{type:'SessionReady',voice:settings.agent.speak.provider.model,provider:'Deepgram'});return;
          }
          if(event.type==='Error')return fail(event.code||'AGENT_ERROR');
          if(event.type==='Warning')return; // No raw provider diagnostics or config echoes in the browser.
          if(event.type==='FunctionCallRequest'){
            for(const fn of (Array.isArray(event.functions)?event.functions:[]).slice(0,5)){
              if(!fn.client_side||typeof fn.id!=='string'||toolCalls.has(fn.id))continue;
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
          if(['ConversationText','UserStartedSpeaking','AgentThinking','AgentAudioDone','InjectionRefused'].includes(event.type))send(client,event);
        });
      }else if(message.type==='UpdateEnquiryDraft'){enquiry.update(message.draft);}
      else if(ready&&upstream?.readyState===WebSocket.OPEN){upstream.send(JSON.stringify(message.type==='InjectUserMessage'?{type:'InjectUserMessage',content:message.content.trim()}:{type:'KeepAlive'}));}
    });
  });
  const dispose=()=>{server.off('upgrade',upgrade);for(const client of gateway.clients)client.terminate();gateway.close();};
  server.on('close',dispose);return {dispose,gateway};
}
