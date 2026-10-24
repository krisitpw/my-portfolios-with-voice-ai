// A mono PCM16 chunk every 20 ms, at the AudioContext's actual sample rate.
class PortfolioPCMInput extends AudioWorkletProcessor {
  constructor(){super();this.frames=Math.round(sampleRate*.02);this.buffer=new Float32Array(this.frames);this.used=0;}
  process(inputs){
    const input=inputs[0]?.[0];if(!input)return true;
    for(let i=0;i<input.length;i++){
      this.buffer[this.used++]=input[i];
      if(this.used===this.frames){
        const bytes=new ArrayBuffer(this.frames*2),view=new DataView(bytes);let energy=0;
        for(let frame=0;frame<this.frames;frame++){const value=Math.max(-1,Math.min(1,this.buffer[frame]));energy+=value*value;view.setInt16(frame*2,value<0?value*32768:value*32767,true);}
        this.port.postMessage({pcm:bytes,level:Math.min(1,Math.sqrt(energy/this.frames)*8)},[bytes]);this.used=0;
      }
    }
    return true;
  }
}
registerProcessor('portfolio-pcm-input',PortfolioPCMInput);
