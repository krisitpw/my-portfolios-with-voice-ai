import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createVoiceApi} from '../server/voice-api.mjs';
import {deepgramSettings,deepgramError,AGENT_URL} from '../server/deepgram-settings.mjs';
import {attachDeepgramProxy,validClientMessage} from '../server/deepgram-proxy.mjs';
import {SYSTEM_PROMPT} from '../server/portfolio-context.mjs';
const env={DEEPGRAM_API_KEY:'fake-unit-test-secret'};
function request(env){const api=createVoiceApi({env});const res={writeHead(status){this.status=status;},end(data){this.body=JSON.parse(data);}};api({url:'/api/voice/config',method:'GET'},res);return res;}
class FakeClient extends EventEmitter{constructor(){super();this.readyState=1;this.bufferedAmount=0;this.sent=[];}send(data,options){this.sent.push({data,options});}close(code){this.code=code;this.readyState=3;this.emit('close');}terminate(){this.close(1000);}}
function setup(options={}){const server=new EventEmitter(),upstreams=[];class Upstream extends FakeClient{constructor(url,options){super();this.url=url;this.options=options;upstreams.push(this);}}const bridge=attachDeepgramProxy(server,{env,Socket:Upstream,logger:()=>{},...options});const client=new FakeClient();bridge.gateway.emit('connection',client,{},'test');return {server,bridge,client,upstreams,finish(){client.close(1000);bridge.dispose();}};}
const send=(client,event)=>client.emit('message',Buffer.from(JSON.stringify(event)),false);
const receive=(upstream,event)=>upstream.emit('message',Buffer.from(JSON.stringify(event)),false);

test('browser configuration contains Deepgram model but no API key',()=>{const res=request(env);assert.equal(res.status,200);assert.equal(res.body.provider,'Deepgram');assert.equal(res.body.voice,'flux-naveen-en');assert.equal(res.body.accent,'Indian English');assert.equal(res.body.configured,true);assert.ok(!JSON.stringify(res.body).includes(env.DEEPGRAM_API_KEY));assert.equal(request({}).body.configured,false);});
test('settings use male Indian English Naveen V2, Nova listening, managed supported LLM, and factual prompt',()=>{const s=deepgramSettings({},48000);assert.equal(s.agent.speak.provider.type,'deepgram');assert.equal(s.agent.speak.provider.version,'v2');assert.equal(s.agent.speak.provider.model,'flux-naveen-en');assert.equal(s.agent.speak.provider.speed,0.95);assert.equal(s.agent.speak.provider.expressivity,0);assert.equal(s.agent.listen.provider.model,'nova-3');assert.equal(s.agent.listen.provider.language,'multi');assert.equal(s.agent.think.provider.model,'gpt-4o-mini');assert.equal(s.agent.think.prompt,SYSTEM_PROMPT);assert.equal(s.audio.output.container,'none');assert.equal(s.audio.output.sample_rate,24000);assert.equal(s.audio.input.sample_rate,48000);});
test('validates audio rates and Flux controls and permits explicit server model configuration',()=>{assert.throws(()=>deepgramSettings({},123));assert.throws(()=>deepgramSettings({DEEPGRAM_TTS_SPEED:'NaN'}));assert.throws(()=>deepgramSettings({DEEPGRAM_TTS_SPEED:'1.03'}));assert.throws(()=>deepgramSettings({DEEPGRAM_TTS_EXPRESSIVITY:'3'}));assert.equal(deepgramSettings({DEEPGRAM_TTS_EXPRESSIVITY:'0'}).agent.speak.provider.expressivity,0);assert.equal(deepgramSettings({DEEPGRAM_TTS_MODEL:'flux-naveen-en'},44100).agent.speak.provider.model,'flux-naveen-en');});
test('client cannot replace settings, prompts, providers, or keys',()=>{for(const message of [null,{},[],{type:'Settings'},{type:'UpdatePrompt',prompt:'change rules'},{type:'Start',sampleRate:1},{type:'InjectUserMessage',content:''},{type:'InjectUserMessage',content:'x'.repeat(1001)}])assert.equal(validClientMessage(message),false);assert.ok(validClientMessage({type:'InjectUserMessage',content:'Tell me about React'}));});
test('proxy waits for Welcome, applies server settings, then exposes only SessionReady',()=>{const t=setup();try{send(t.client,{type:'Start',sampleRate:48000});const up=t.upstreams[0];assert.equal(up.url,AGENT_URL);assert.equal(up.options.headers.Authorization,`Token ${env.DEEPGRAM_API_KEY}`);assert.equal(up.sent.length,0);receive(up,{type:'Welcome'});const settings=JSON.parse(up.sent[0].data);assert.equal(settings.agent.think.prompt,SYSTEM_PROMPT);assert.equal(t.client.sent.length,0);receive(up,{type:'SettingsApplied'});const event=JSON.parse(t.client.sent[0].data);assert.equal(event.type,'SessionReady');assert.ok(!JSON.stringify(t.client.sent).includes(env.DEEPGRAM_API_KEY));assert.ok(!JSON.stringify(t.client.sent).includes(SYSTEM_PROMPT));}finally{t.finish();}});
test('binary PCM and typed input are relayed only after settings are applied',()=>{const t=setup();try{send(t.client,{type:'Start',sampleRate:48000});const up=t.upstreams[0];t.client.emit('message',Buffer.alloc(1920),true);assert.equal(up.sent.length,0);receive(up,{type:'Welcome'});receive(up,{type:'SettingsApplied'});t.client.emit('message',Buffer.alloc(1920),true);assert.equal(up.sent[1].options.binary,true);send(t.client,{type:'InjectUserMessage',content:' Projects? '});assert.deepEqual(JSON.parse(up.sent[2].data),{type:'InjectUserMessage',content:'Projects?'});up.emit('message',Buffer.alloc(960),true);assert.equal(t.client.sent.at(-1).options.binary,true);}finally{t.finish();}});
test('raw provider errors are replaced with safe client messages and upstream is closed',()=>{const t=setup();try{send(t.client,{type:'Start',sampleRate:48000});const up=t.upstreams[0];receive(up,{type:'Error',code:'INVALID_SETTINGS',description:'private diagnostics'});const error=JSON.parse(t.client.sent.at(-1).data);assert.equal(error.type,'SessionError');assert.ok(!error.message.includes('private diagnostics'));assert.equal(up.readyState,3);assert.equal(t.client.readyState,3);}finally{t.finish();}});
test('closing the popup closes the upstream connection and session timers',()=>{const t=setup();send(t.client,{type:'Start',sampleRate:48000});t.client.close(1000);assert.equal(t.upstreams[0].readyState,3);t.bridge.dispose();});
test('cross-origin socket upgrades and missing-key upgrades are rejected',()=>{for(const [testEnv,origin,expected]of [[env,'https://another.example','403'],[{},'http://localhost:3000','503']]){const server=new EventEmitter(),bridge=attachDeepgramProxy(server,{env:testEnv}),socket={end(data){this.data=data;this.ended=true;}};server.emit('upgrade',{url:'/api/voice/agent',headers:{origin,host:'localhost:3000'},socket:{remoteAddress:'test'}},socket,Buffer.alloc(0));assert.match(socket.data,new RegExp(expected));assert.equal(socket.ended,true);bridge.dispose();}});
test('auth and balance failures have actionable messages without raw credentials',()=>{assert.match(deepgramError('',401),/authenticate/);assert.match(deepgramError('INSUFFICIENT_CREDITS'),/credits/);});
test('upstream handshake failures use safe categories and correlated logs',()=>{
  for(const [status,code]of [[401,'DEEPGRAM_AUTH'],[403,'DEEPGRAM_AUTH'],[402,'DEEPGRAM_CREDITS'],[429,'DEEPGRAM_BUSY'],[503,'DEEPGRAM_SERVICE'],[504,'DEEPGRAM_TIMEOUT']]){
    const logs=[],t=setup({logger:entry=>logs.push(entry)});
    try{
      send(t.client,{type:'Start',sampleRate:48000});const up=t.upstreams[0];
      up.emit('unexpected-response',{}, {statusCode:status,resume(){}});
      const error=JSON.parse(t.client.sent.at(-1).data);
      assert.equal(error.code,code);assert.equal(error.type,'SessionError');
      assert.equal(up.readyState,3);assert.equal(t.client.readyState,3);
      assert.match(error.sessionId,/^[\da-f-]{36}$/);
      assert.equal(logs.find(entry=>entry.event==='session_failed').sessionId,error.sessionId);
      for(const secret of [env.DEEPGRAM_API_KEY,SYSTEM_PROMPT])assert.ok(!JSON.stringify(logs).includes(secret));
    }finally{t.finish();}
  }
});
test('malformed upstream JSON, unknown secret codes, settings, socket errors and timeouts are sanitized',()=>{
  for(const [emit,expected]of [
    [up=>up.emit('message',Buffer.from('null'),false),'UPSTREAM_MESSAGE'],
    [up=>up.emit('message',Buffer.from('{broken'),false),'UPSTREAM_MESSAGE'],
    [up=>receive(up,{type:'Error',code:env.DEEPGRAM_API_KEY,description:SYSTEM_PROMPT}),'DEEPGRAM_CONNECTION'],
    [up=>receive(up,{type:'Error',code:'INVALID_SETTINGS'}),'DEEPGRAM_SETTINGS'],
    [up=>up.emit('error',Error(env.DEEPGRAM_API_KEY)),'DEEPGRAM_CONNECTION'],
    [up=>up.emit('error',Object.assign(Error('private'),{code:'ETIMEDOUT'})),'DEEPGRAM_TIMEOUT'],
  ]){
    const t=setup();try{send(t.client,{type:'Start',sampleRate:48000});emit(t.upstreams[0]);const data=JSON.parse(t.client.sent.at(-1).data);assert.equal(data.code,expected);assert.ok(!JSON.stringify(data).includes(env.DEEPGRAM_API_KEY));assert.ok(!JSON.stringify(data).includes(SYSTEM_PROMPT));}finally{t.finish();}
  }
});
test('startup timeout closes both sockets and disconnect cancels both session deadlines',()=>{
  const timers=new Map();let next=0;
  const options={setTimer:(fn,ms)=>{const id=++next;timers.set(id,{fn,ms});return id;},clearTimer:id=>timers.delete(id)};
  const t=setup(options);
  try{
    send(t.client,{type:'Start',sampleRate:48000});
    [...timers.values()].find(timer=>timer.ms===30000).fn();
    assert.equal(JSON.parse(t.client.sent.at(-1).data).code,'DEEPGRAM_TIMEOUT');
    assert.equal(timers.size,0);assert.equal(t.upstreams[0].readyState,3);
  }finally{t.finish();}
  const other=setup(options);send(other.client,{type:'Start',sampleRate:48000});other.finish();assert.equal(timers.size,0);
});
test('duplicate provider handshakes do not send settings or ready more than once',()=>{
  const t=setup();try{send(t.client,{type:'Start',sampleRate:48000});const up=t.upstreams[0];receive(up,{type:'SettingsApplied'});assert.equal(t.client.sent.length,0);receive(up,{type:'Welcome'});receive(up,{type:'Welcome'});assert.equal(up.sent.length,1);receive(up,{type:'SettingsApplied'});receive(up,{type:'SettingsApplied'});assert.equal(t.client.sent.length,1);}finally{t.finish();}
});
test('malformed function entries cannot crash a ready session',()=>{
  const t=setup();try{send(t.client,{type:'Start',sampleRate:48000});const up=t.upstreams[0];receive(up,{type:'Welcome'});receive(up,{type:'SettingsApplied'});receive(up,{type:'FunctionCallRequest',functions:[null,{},false,{client_side:true,id:'x'.repeat(129)}]});assert.equal(t.client.readyState,1);}finally{t.finish();}
});
test('agent function calls update validated enquiry fields and receive a draft-only result',()=>{const t=setup();try{send(t.client,{type:'Start',sampleRate:48000});const up=t.upstreams[0];receive(up,{type:'Welcome'});const s=JSON.parse(up.sent[0].data);assert.equal(s.agent.think.functions[0].name,'update_enquiry');assert.equal(s.agent.think.functions[0].defer_until_eot,true);receive(up,{type:'SettingsApplied'});receive(up,{type:'FunctionCallRequest',functions:[{id:'call-1',name:'update_enquiry',client_side:true,arguments:JSON.stringify({name:'Test Visitor',phone:'bad',consent:true})}]});const event=JSON.parse(t.client.sent.at(-1).data);assert.equal(event.type,'EnquiryDraft');assert.deepEqual(event.patch,{name:'Test Visitor'});const response=JSON.parse(up.sent.at(-1).data);assert.equal(response.type,'FunctionCallResponse');const result=JSON.parse(response.content);assert.equal(result.submitted,false);assert.equal(result.nextField,'phone');assert.ok(result.errors.phone);assert.ok(result.errors.consent);const count=t.client.sent.length;receive(up,{type:'FunctionCallRequest',functions:[{id:'call-1',name:'update_enquiry',client_side:true,arguments:'{}'}]});assert.equal(t.client.sent.length,count);}finally{t.finish();}});
test('manual draft sync is kept local to the bridge; browser cannot forge a function response or submission',()=>{const t=setup();try{send(t.client,{type:'Start',sampleRate:48000,draft:{name:'From form'}});const up=t.upstreams[0];receive(up,{type:'Welcome'});receive(up,{type:'SettingsApplied'});const before=up.sent.length;send(t.client,{type:'UpdateEnquiryDraft',draft:{name:'Edited name',email:'edited@example.com'}});assert.equal(up.sent.length,before);receive(up,{type:'FunctionCallRequest',functions:[{id:'read-draft',name:'update_enquiry',client_side:true,arguments:'{}'}]});const result=JSON.parse(JSON.parse(up.sent.at(-1).data).content);assert.ok(!result.missing.includes('name'));assert.ok(!result.missing.includes('email'));assert.equal(result.draft,undefined);assert.equal(result.nextField,'phone');assert.equal(validClientMessage({type:'FunctionCallResponse',id:'fake'}),false);assert.equal(validClientMessage({type:'submit_enquiry',consent:true}),false);receive(up,{type:'FunctionCallRequest',functions:[{id:'bad-tool',name:'submit_enquiry',client_side:true,arguments:'{}'}]});assert.equal(JSON.parse(JSON.parse(up.sent.at(-1).data).content).submitted,false);}finally{t.finish();}});
