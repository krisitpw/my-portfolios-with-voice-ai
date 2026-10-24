import test from 'node:test';
import assert from 'node:assert/strict';
import {openVoiceConnection,voiceSocketURL} from '../src/voice-connection.js';

function fixture(){
  const timers=new Map(),events=[],audio=[],failures=[];let ready=0,next=0;
  class Socket{
    constructor(url){this.url=url;this.sent=[];this.closed=false;}
    send(data){this.sent.push(JSON.parse(data));}
    close(){this.closed=true;}
  }
  const connection=openVoiceConnection({url:'wss://portfolio.test/api/voice/agent',sampleRate:48000,draft:{name:'Test'},Socket,
    onReady:()=>ready++,onEvent:event=>events.push(event),onAudio:data=>audio.push(data),onFailure:error=>failures.push(error),
    setTimer:(fn,ms)=>{const id=++next;timers.set(id,{fn,ms});return id;},clearTimer:id=>timers.delete(id),
  });
  return {...connection,timers,events,audio,failures,get ready(){return ready;},message:data=>connection.socket.onmessage({data:JSON.stringify(data)})};
}
test('same-origin URL uses secure WebSockets on HTTPS',()=>{
  assert.equal(voiceSocketURL({protocol:'https:',host:'example.test'}),'wss://example.test/api/voice/agent');
  assert.equal(voiceSocketURL({protocol:'http:',host:'localhost:5173'}),'ws://localhost:5173/api/voice/agent');
});
test('open sends Start but enables chat only after SessionReady; events and PCM then flow',()=>{
  const t=fixture();t.socket.onopen();assert.equal(t.ready,0);assert.equal(t.socket.sent[0].type,'Start');
  t.message({type:'AgentThinking'});assert.equal(t.events.length,0);
  t.message({type:'SessionReady'});t.message({type:'SessionReady'});assert.equal(t.ready,1);assert.equal(t.timers.size,0);
  t.message({type:'ConversationText',role:'assistant',content:'Hello'});assert.equal(t.events.length,1);
  t.socket.onmessage({data:new ArrayBuffer(4)});assert.equal(t.audio.length,1);t.close();
});
test('handshake failure, close before ready, provider error and ready disconnect differ',()=>{
  for(const [stage,expected]of [['handshake',/handshake/],['startup',/before.*ready/],['ready',/ended/]]){
    const t=fixture();if(stage!=='handshake')t.socket.onopen();if(stage==='ready')t.message({type:'SessionReady'});
    t.socket.onclose({code:1006});assert.match(t.failures[0],expected);assert.equal(t.socket.closed,true);assert.equal(t.timers.size,0);
  }
  for(const code of ['MISSING_KEY','DEEPGRAM_AUTH','DEEPGRAM_CREDITS','DEEPGRAM_SETTINGS','DEEPGRAM_TIMEOUT','DEEPGRAM_SERVICE']){
    const t=fixture();t.socket.onopen();t.message({type:'SessionError',code,message:'private key and raw provider text'});
    assert.equal(t.ready,0);assert.equal(t.failures.length,1);assert.ok(!t.failures[0].includes('private key'));assert.equal(t.timers.size,0);
  }
});
test('handshake and provider startup deadlines fail safely, while restart cleanup ignores late callbacks',()=>{
  for(const opened of [false,true]){
    const t=fixture();if(opened)t.socket.onopen();[...t.timers.values()][0].fn();
    assert.match(t.failures[0],opened?/Deepgram.*long/:/WebSocket.*time/);assert.equal(t.timers.size,0);
  }
  const old=fixture(),late=old.socket.onmessage;old.close();late({data:'{"type":"SessionReady"}'});
  assert.equal(old.ready,0);assert.equal(old.timers.size,0);assert.equal(old.socket.onerror,null);
  const fresh=fixture();fresh.socket.onopen();fresh.message({type:'SessionReady'});assert.equal(fresh.ready,1);fresh.close();
});
