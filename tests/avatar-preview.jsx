// Local-only visual/audio harness. Not an application entry and not in dist/.
import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import VideoAvatar from '../src/components/VideoAvatar';
import {speechEnvelopeFromWav,speechLevelAt} from '../src/speech-envelope';
import '../src/styles.css';
function Preview(){
 const speech=useRef({playing:false,level:0,time:0}),player=useRef(null),frame=useRef(0);const [status,setStatus]=useState('ready');
 function stop(){cancelAnimationFrame(frame.current);player.current?.pause();speech.current={playing:false,level:0,time:0};setStatus('ready');}
 async function play(){stop();const bytes=new Uint8Array(await(await fetch('/tests/fixtures/avatar-speech.wav')).arrayBuffer());const envelope=speechEnvelopeFromWav(bytes);const audio=new Audio('/tests/fixtures/avatar-speech.wav');audio.loop=true;player.current=audio;await audio.play();setStatus('speaking');function tick(){speech.current={playing:!audio.paused,level:speechLevelAt(envelope,audio.currentTime),time:audio.currentTime};frame.current=requestAnimationFrame(tick);}frame.current=requestAnimationFrame(tick);}
 useEffect(()=>()=>{cancelAnimationFrame(frame.current);player.current?.pause();},[]);
 return <main style={{maxWidth:390,margin:'40px auto',border:'1px solid #57534e',borderRadius:24,overflow:'hidden',background:'#0c0a09'}}><h1 style={{fontSize:20,margin:20}}>Local avatar rendering check</h1><VideoAvatar speechFrame={speech} status={status}/><div style={{padding:20,display:'flex',gap:16}}><button className="metal-button" onClick={play}>Play test audio</button><button className="metal-button" onClick={stop}>Stop</button></div><p role="status" style={{padding:'0 20px 20px'}}>{status}</p></main>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
