export function decodePCM16(bytes,carry=null) {
  let data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  if(carry!==null){const joined=new Uint8Array(data.length+1);joined[0]=carry;joined.set(data,1);data=joined;}
  const length=data.length-data.length%2,view=new DataView(data.buffer,data.byteOffset,length),samples=new Float32Array(length/2);
  for(let i=0;i<samples.length;i++)samples[i]=view.getInt16(i*2,true)/32768;
  return {samples,carry:length<data.length?data[data.length-1]:null};
}
export function pcmEnergy(samples,rate=24000) {
  const hop=Math.max(1,Math.round(rate/40)),levels=new Float32Array(Math.ceil(samples.length/hop));
  for(let i=0;i<levels.length;i++){let sum=0,count=0;for(let j=i*hop;j<Math.min(samples.length,(i+1)*hop);j++){sum+=samples[j]*samples[j];count++;}const rms=Math.sqrt(sum/Math.max(1,count));levels[i]=rms<.007?0:Math.min(1,rms*7);}
  return {levels,hop};
}
export function createPCMPlayback(context,{speechFrame,onSpeaking,onDrain,requestFrame=requestAnimationFrame,cancelFrame=cancelAnimationFrame}) {
  let nextTime=context.currentTime,carry=null,done=false,animation=0;const queue=new Map();
  function tick(){
    const time=context.currentTime;const segment=[...queue.values()].find(item=>time>=item.start&&time<item.end);
    speechFrame.current={playing:Boolean(segment),level:segment?.energy.levels[Math.floor((time-segment.start)*24000/segment.energy.hop)]||0,time};
    if(queue.size)animation=requestFrame(tick);else speechFrame.current={playing:false,level:0,time:0};
  }
  function drained(){if(done&&!queue.size){speechFrame.current={playing:false,level:0,time:0};onDrain();}}
  return {
    push(bytes){
      done=false;const decoded=decodePCM16(bytes,carry);carry=decoded.carry;const samples=decoded.samples;if(!samples.length)return;
      if(nextTime-context.currentTime>60)throw Error('Audio playback queue is full. Restart the conversation.');
      const buffer=context.createBuffer(1,samples.length,24000);buffer.copyToChannel(samples,0);const source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);
      const start=Math.max(nextTime,context.currentTime+.04),end=start+buffer.duration;nextTime=end;queue.set(source,{start,end,energy:pcmEnergy(samples)});
      source.onended=()=>{queue.delete(source);source.disconnect();drained();};source.start(start);onSpeaking();
      if(queue.size===1){cancelFrame(animation);animation=requestFrame(tick);}
    },
    hasAudio(){return queue.size>0;},
    markDone(){done=true;drained();},
    clear(){cancelFrame(animation);for(const source of queue.keys()){source.onended=null;try{source.stop();source.disconnect();}catch{}}queue.clear();nextTime=context.currentTime;carry=null;done=false;speechFrame.current={playing:false,level:0,time:0};},
  };
}
