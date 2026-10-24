import React,{useEffect,useRef,useState} from 'react';
import neutral from '../assets/krishna-avatar-clean.jpg';
import speaking from '../assets/krishna-avatar-speaking.jpg';
import blinking from '../assets/krishna-avatar-blink.jpg';

const WIDTH=768,HEIGHT=512;
function loadImage(src){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=src;});}
function makePatch(image,{x,y,rx,ry}) {
  const canvas=document.createElement('canvas');canvas.width=WIDTH;canvas.height=HEIGHT;
  const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,WIDTH,HEIGHT);
  ctx.globalCompositeOperation='destination-in';ctx.translate(x,y);ctx.scale(rx,ry);
  const mask=ctx.createRadialGradient(0,0,0,0,0,1);mask.addColorStop(0,'white');mask.addColorStop(.7,'white');mask.addColorStop(1,'transparent');
  ctx.fillStyle=mask;ctx.fillRect(-1,-1,2,2);return canvas;
}
export default function VideoAvatar({speechFrame,status}) {
  const canvas=useRef(null),video=useRef(null);const [renderer,setRenderer]=useState('poster');
  useEffect(()=>{
    let active=true,frame=0,stream=null,lastPaint=0;
    const element=video.current,stage=canvas.current,ctx=stage.getContext('2d');
    const preference=window.matchMedia('(prefers-reduced-motion: reduce)');let reduced=preference.matches;
    const change=event=>{reduced=event.matches;};preference.addEventListener('change',change);
    Promise.all([loadImage(neutral),loadImage(speaking),loadImage(blinking)]).then(([base,mouth,eyes])=>{
      if(!active)return;
      // Feather only the changed facial regions; keep the rest of the image fixed.
      const mouthPatch=makePatch(mouth,{x:384,y:260,rx:52,ry:29});
      const eyePatch=makePatch(eyes,{x:382,y:182,rx:108,ry:43});
      let mouthLevel=0;
      function draw(time){
        if(!active)return;
        if(time-lastPaint>=32){
          lastPaint=time;
          const speech=speechFrame.current;
          const target=!reduced&&speech.playing?speech.level:0;
          mouthLevel+=(target-mouthLevel)*(target > mouthLevel ? .72 : .5);
          const seconds=time/1000;
          const blinkPhase=seconds%5.7,blink=!reduced&&blinkPhase<.16?Math.sin(blinkPhase/.16*Math.PI):0;
          ctx.fillStyle='#080c13';ctx.fillRect(0,0,WIDTH,HEIGHT);ctx.save();
          if(!reduced){ctx.translate(WIDTH/2,HEIGHT*.65);ctx.rotate(Math.sin(seconds*.75)*.0025);ctx.translate(-WIDTH/2,-HEIGHT*.65+Math.sin(seconds*1.2)*.65);}
          ctx.drawImage(base,0,0,WIDTH,HEIGHT);
          if(mouthLevel>.025){ctx.globalAlpha=Math.min(1,mouthLevel*1.8);ctx.drawImage(mouthPatch,0,0);}
          if(blink>.01){ctx.globalAlpha=blink;ctx.drawImage(eyePatch,0,0);}
          ctx.globalAlpha=1;ctx.restore();
          stage.dataset.mouth=mouthLevel>.1?'open':'closed';
        }
        frame=requestAnimationFrame(draw);
      }
      ctx.drawImage(base,0,0,WIDTH,HEIGHT);frame=requestAnimationFrame(draw);setRenderer('canvas');
      if(typeof stage.captureStream==='function'){
        try{stream=stage.captureStream(30);element.srcObject=stream;element.play().then(()=>{if(active)setRenderer('video');}).catch(()=>{});}catch{/* Animated canvas remains available. */}
      }
    }).catch(()=>{if(active)setRenderer('poster');});
    return()=>{active=false;cancelAnimationFrame(frame);preference.removeEventListener('change',change);stream?.getTracks().forEach(track=>track.stop());element.pause();element.srcObject=null;};
  },[speechFrame]);
  return <div className={`avatar-video-stage ${status==='speaking'?'is-talking':''}`} data-renderer={renderer}>
    <img className="avatar-poster" src={neutral} alt="Illustrated AI avatar wearing glasses and a plain dark hoodie"/>
    <canvas ref={canvas} width={WIDTH} height={HEIGHT} className={renderer==='canvas'?'avatar-canvas visible':'avatar-canvas'} aria-hidden="true"/>
    <video ref={video} className={renderer==='video'?'avatar-live-video visible':'avatar-live-video'} muted autoPlay playsInline disablePictureInPicture aria-label="Animated conversational AI avatar"/>
    <div className="avatar-video-shade" aria-hidden="true"/>
    <div className="avatar-video-badge"><i/>{status==='speaking'?'SPEAKING':status==='listening'?'LISTENING':'AI AVATAR'}</div>
  </div>;
}
