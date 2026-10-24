// Read WAV/PCM fixtures and locally generated speech without rerouting or delaying the audio.
// Amplitude drives an illustrated mouth animation; this is not phoneme lip sync.
export function speechEnvelopeFromWav(bytes) {
  try {
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    const tag=offset=>String.fromCharCode(...bytes.subarray(offset,offset+4));
    if(bytes.length<44||tag(0)!=='RIFF'||tag(8)!=='WAVE')return null;
    let format=null,data=null;
    for(let offset=12;offset+8<=bytes.length;){
      const length=view.getUint32(offset+4,true),start=offset+8;
      if(start+length>bytes.length)return null;
      if(tag(offset)==='fmt '&&length>=16)format={type:view.getUint16(start,true),channels:view.getUint16(start+2,true),rate:view.getUint32(start+4,true),bits:view.getUint16(start+14,true)};
      if(tag(offset)==='data')data={start,length};
      offset=start+length+(length%2);
    }
    if(!format||!data||format.type!==1||format.bits!==16||!format.channels||!format.rate||format.channels>8||format.rate>192000)return null;
    const frames=Math.floor(data.length/(format.channels*2)),hop=Math.max(1,Math.round(format.rate/40));
    const levels=new Float32Array(Math.ceil(frames/hop));
    for(let index=0;index<levels.length;index++){
      let energy=0,count=0;
      for(let frame=index*hop;frame<Math.min(frames,(index+1)*hop);frame++)for(let channel=0;channel<format.channels;channel++){
        const sample=view.getInt16(data.start+(frame*format.channels+channel)*2,true)/32768;energy+=sample*sample;count++;
      }
      levels[index]=Math.sqrt(energy/Math.max(1,count));
    }
    const voiced=Array.from(levels).filter(level=>level>.008).sort((a,b)=>a-b);
    const peak=Math.max(.06,voiced[Math.floor(voiced.length*.9)]||.06);
    for(let index=0;index<levels.length;index++)levels[index]=levels[index]<.008?0:Math.min(1,levels[index]/peak);
    return {levels,frameSeconds:hop/format.rate,duration:frames/format.rate};
  }catch{return null;}
}
export function speechLevelAt(envelope,time) {
  if(!envelope||!Number.isFinite(time)||time<0)return 0;
  return envelope.levels[Math.floor(time/envelope.frameSeconds)]||0;
}
