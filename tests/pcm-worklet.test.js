import test from 'node:test';
import assert from 'node:assert/strict';
test('microphone worklet emits 20ms mono PCM chunks and RMS levels',async()=>{
 let Processor;globalThis.sampleRate=48000;globalThis.AudioWorkletProcessor=class{constructor(){this.sent=[];this.port={postMessage:message=>this.sent.push(message)};}};globalThis.registerProcessor=(name,constructor)=>{assert.equal(name,'portfolio-pcm-input');Processor=constructor;};
 await import('../src/pcm-worklet.js');const processor=new Processor();for(let i=0;i<8;i++)processor.process([[new Float32Array(128).fill(.25)]]);
 assert.equal(processor.sent.length,1);assert.equal(processor.sent[0].pcm.byteLength,1920);assert.equal(new DataView(processor.sent[0].pcm).getInt16(0,true),8191);assert.ok(processor.sent[0].level>.9);
 delete globalThis.sampleRate;delete globalThis.AudioWorkletProcessor;delete globalThis.registerProcessor;
});
