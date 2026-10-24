import test from 'node:test';
import assert from 'node:assert/strict';
import {decodePCM16,pcmEnergy,createPCMPlayback} from '../src/pcm-audio.js';
test('PCM decoder handles split samples and signed little-endian audio',()=>{const first=decodePCM16(new Uint8Array([0,128,255]));assert.equal(first.samples[0],-1);assert.equal(first.carry,255);const second=decodePCM16(new Uint8Array([127]),first.carry);assert.ok(second.samples[0]>.99);assert.equal(second.carry,null);});
test('speech amplitude follows real PCM samples and silence remains closed',()=>{assert.equal(pcmEnergy(new Float32Array(600)).levels[0],0);assert.ok(pcmEnergy(new Float32Array(600).fill(.2)).levels[0]>.9);});
test('agent audio completion waits for actual playback; barge-in clears queued sources',()=>{
 const sources=[],speechFrame={current:{}},events=[];const context={currentTime:0,destination:{},createBuffer(channels,length,rate){return {duration:length/rate,copyToChannel(){}};},createBufferSource(){const source={connect(){},disconnect(){},start(at){this.startAt=at;},stop(){this.stopped=true;}};sources.push(source);return source;}};
 const playback=createPCMPlayback(context,{speechFrame,onSpeaking:()=>events.push('speaking'),onDrain:()=>events.push('drained'),requestFrame:()=>1,cancelFrame:()=>{}});
 playback.push(new Uint8Array(960));assert.ok(playback.hasAudio());playback.markDone();assert.deepEqual(events,['speaking']);sources[0].onended();assert.equal(events.at(-1),'drained');
 playback.push(new Uint8Array(960));playback.clear();assert.equal(sources[1].stopped,true);assert.equal(playback.hasAudio(),false);assert.equal(speechFrame.current.level,0);
});
