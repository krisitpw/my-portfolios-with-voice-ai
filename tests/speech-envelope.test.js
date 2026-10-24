import test from 'node:test';
import assert from 'node:assert/strict';
import {speechEnvelopeFromWav,speechLevelAt} from '../src/speech-envelope.js';
function wav(samples,{channels=1,extraChunk=false}={}) {
 const extra=extraChunk?12:0,bytes=new Uint8Array(44+extra+samples.length*2),v=new DataView(bytes.buffer);
 const text=(offset,value)=>{for(let i=0;i<value.length;i++)bytes[offset+i]=value.charCodeAt(i);};
 text(0,'RIFF');v.setUint32(4,bytes.length-8,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,channels,true);v.setUint32(24,8000,true);v.setUint32(28,8000*channels*2,true);v.setUint16(32,channels*2,true);v.setUint16(34,16,true);
 if(extraChunk){text(36,'JUNK');v.setUint32(40,3,true);bytes.set([1,2,3,0],44);}
 text(36+extra,'data');v.setUint32(40+extra,samples.length*2,true);samples.forEach((s,i)=>v.setInt16(44+extra+i*2,s,true));return bytes;
}
test('mouth envelope opens for speech amplitude and closes during silent frames',()=>{
 const samples=[...Array(200).fill(0),...Array.from({length:200},(_,i)=>Math.round(Math.sin(i*.25)*12000)),...Array(200).fill(0)];
 const envelope=speechEnvelopeFromWav(wav(samples));assert.equal(envelope.frameSeconds,.025);assert.equal(speechLevelAt(envelope,.01),0);assert.ok(speechLevelAt(envelope,.03)>.5);assert.equal(speechLevelAt(envelope,.06),0);assert.equal(speechLevelAt(envelope,2),0);
});
test('handles WAV metadata padding, stereo, and a byte-array offset',()=>{
 const bytes=wav(Array(800).fill(8000),{channels:2,extraChunk:true});const container=new Uint8Array(bytes.length+16);container.set(bytes,8);const envelope=speechEnvelopeFromWav(container.subarray(8,8+bytes.length));assert.equal(envelope.duration,.05);assert.equal(envelope.levels.length,2);assert.ok(envelope.levels[0]>.5);
});
test('invalid or unsupported audio safely leaves the avatar mouth closed',()=>{
 assert.equal(speechEnvelopeFromWav(new Uint8Array(10)),null);const bytes=wav(Array(200).fill(100));new DataView(bytes.buffer).setUint16(20,3,true);assert.equal(speechEnvelopeFromWav(bytes),null);assert.equal(speechLevelAt(null,1),0);assert.equal(speechLevelAt({levels:[],frameSeconds:.025},NaN),0);
});
test('truncated audio is rejected without reading outside its buffer',()=>{
 const bytes=wav(Array(200).fill(8000));assert.equal(speechEnvelopeFromWav(bytes.subarray(0,bytes.length-10)),null);
});
