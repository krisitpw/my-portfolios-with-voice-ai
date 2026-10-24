import {useCallback,useEffect,useRef,useState} from 'react';
import {createPCMPlayback} from './pcm-audio';
import workletURL from './pcm-worklet.js?worker&url';
import {cleanEnquiryPatch,emptyEnquiry} from './lead-fields';

export function useVoiceAssistant(open,{draft={},onDraftChange,reviewing=false}={}) {
  const [status,setStatus]=useState('idle'),[messages,setMessages]=useState([]),[error,setError]=useState(''),[micEnabled,setMicEnabled]=useState(true),[level,setLevel]=useState(0),[configured,setConfigured]=useState(false),[needsPlay,setNeedsPlay]=useState(false);
  const speechFrame=useRef({playing:false,level:0,time:0}),session=useRef(null);
  const enquiryRef=useRef({draft,onDraftChange,reviewing});enquiryRef.current={draft,onDraftChange,reviewing};
  const [enquiryReady,setEnquiryReady]=useState(false);
  const [enquiryRevision,setEnquiryRevision]=useState(0);
  const phase=useCallback(value=>{setStatus(value);},[]);
  const stop=useCallback(()=>{
    const current=session.current;session.current=null;
    if(current){current.closed=true;clearTimeout(current.timeout);current.abort.abort();current.stream?.getTracks().forEach(track=>track.stop());current.input?.disconnect();current.source?.disconnect();current.gain?.disconnect();current.playback?.clear();if(current.socket){current.socket.onclose=null;current.socket.onerror=null;current.socket.onmessage=null;current.socket.close();}current.context?.close().catch(()=>{});}
    speechFrame.current={playing:false,level:0,time:0};setLevel(0);setNeedsPlay(false);
  },[]);
  function currentSession(current){return session.current===current&&!current.closed;}
  function append(role,content){
    if(!content?.trim()||!['user','assistant'].includes(role))return;
    setMessages(previous=>{const last=previous.at(-1);if(last?.role===role&&last.content===content)return previous;if(role==='assistant'&&last?.role==='assistant')return [...previous.slice(0,-1),{role,content:last.content+' '+content}];return [...previous,{role,content}];});
  }
  async function startMic(current){
    if(!currentSession(current)||current.muted||enquiryRef.current.reviewing||current.stream||current.requesting)return;
    current.requesting=true;phase('requesting-mic');
    try{
      if(!navigator.mediaDevices?.getUserMedia||!current.context.audioWorklet)throw Error('Voice input is unavailable in this browser. You can type below.');
      const stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      if(!currentSession(current)||current.muted){stream.getTracks().forEach(track=>track.stop());return;}
      current.stream=stream;await current.context.audioWorklet.addModule(workletURL);
      if(!currentSession(current)||current.muted){stream.getTracks().forEach(track=>track.stop());current.stream=null;return;}
      current.source=current.context.createMediaStreamSource(stream);current.input=new AudioWorkletNode(current.context,'portfolio-pcm-input');current.gain=current.context.createGain();current.gain.gain.value=0;
      current.input.port.onmessage=event=>{
        if(!currentSession(current)||current.muted||!current.ready||current.socket.readyState!==WebSocket.OPEN)return;
        if(current.socket.bufferedAmount>256*1024)return;
        current.socket.send(event.data.pcm);setLevel(event.data.level);
      };
      current.source.connect(current.input);current.input.connect(current.gain);current.gain.connect(current.context.destination);setError('');phase(current.playback.hasAudio()?'speaking':'listening');
    }catch(err){
      if(!currentSession(current))return;
      current.stream?.getTracks().forEach(track=>track.stop());current.stream=null;current.muted=true;setMicEnabled(false);
      setError(err.name==='NotAllowedError'?'Microphone access was not granted. You can type your question below.':err.message);phase('ready');
    }finally{current.requesting=false;}
  }
  const connect=useCallback(async()=>{
    stop();setMessages([]);setError('');setConfigured(false);setMicEnabled(!enquiryRef.current.reviewing);setEnquiryReady(false);phase('connecting');
    const current={closed:false,muted:enquiryRef.current.reviewing,ready:false,dropAudio:false,abort:new AbortController()};session.current=current;
    try{
      const Context=window.AudioContext||window.webkitAudioContext;
      if(!Context)throw Error('This browser cannot play the voice conversation. Please try a current browser.');
      current.context=new Context({sampleRate:48000});current.context.resume().catch(()=>{});
      current.playback=createPCMPlayback(current.context,{speechFrame,onSpeaking:()=>{if(currentSession(current)){phase('speaking');if(current.context.state!=='running')setNeedsPlay(true);}},onDrain:()=>{if(!currentSession(current))return;phase(current.stream&&!current.muted?'listening':'ready');startMic(current);}});
      const response=await fetch('/api/voice/config',{signal:current.abort.signal});if(!response.ok)throw Error('The voice assistant could not load its server settings.');const config=await response.json();if(!currentSession(current))return;
      if(!config.configured){setError('The voice assistant is being set up. Use the contact links to reach Krishna.');phase('unavailable');return;}
      const protocol=location.protocol==='https:'?'wss:':'ws:';current.socket=new WebSocket(`${protocol}//${location.host}/api/voice/agent`);current.socket.binaryType='arraybuffer';
      current.timeout=setTimeout(()=>{if(currentSession(current)){setError('Deepgram took too long to connect. Restart the conversation to try again.');stop();phase('ready');}},35000);
      current.socket.onopen=()=>{if(currentSession(current))current.socket.send(JSON.stringify({type:'Start',sampleRate:current.context.sampleRate,draft:enquiryRef.current.draft}));};
      current.socket.onmessage=event=>{
        if(!currentSession(current))return;
        if(event.data instanceof ArrayBuffer){if(!current.dropAudio)try{current.playback.push(new Uint8Array(event.data));}catch(err){setError(err.message);stop();phase('ready');}return;}
        let message;try{message=JSON.parse(event.data);}catch{return;}
        switch(message.type){
          case 'SessionReady':current.ready=true;clearTimeout(current.timeout);setConfigured(true);if(current.context.state!=='running')setNeedsPlay(true);phase('ready');break;
          case 'ConversationText':append(message.role,message.content);if(message.role==='assistant'){current.dropAudio=false;}break;
          case 'UserStartedSpeaking':current.playback.clear();current.dropAudio=true;phase('listening');break;
          case 'AgentThinking':current.dropAudio=false;phase('thinking');break;
          case 'AgentAudioDone':current.playback.markDone();break;
          case 'EnquiryDraft':enquiryRef.current.onDraftChange?.(cleanEnquiryPatch(message.patch).patch);setEnquiryReady(message.status==='ready_for_review');setEnquiryRevision(value=>value+1);break;
          case 'InjectionRefused':setError('Please wait for the current answer to finish, then try your question again.');phase('ready');break;
          case 'SessionError':setError(message.message||'The Deepgram session ended. Restart to continue.');stop();setConfigured(false);phase('ready');break;
          default:break;
        }
      };
      current.socket.onerror=()=>{if(currentSession(current)){setError('Could not connect to the Deepgram voice service. Please restart or check the server key.');stop();setConfigured(false);phase('ready');}};
      current.socket.onclose=()=>{if(currentSession(current)){setError('The voice session ended. Restart to continue.');stop();setConfigured(false);phase('ready');}};
    }catch(err){if(currentSession(current)){setError(err.message||'Could not start the voice session.');stop();setConfigured(false);phase('ready');}}
  },[stop,phase]);
  useEffect(()=>{if(open)connect();else{stop();phase('idle');}return stop;},[open,connect,stop,phase]);
  useEffect(()=>{const current=session.current;if(!current?.ready||current.socket?.readyState!==WebSocket.OPEN)return;const timer=setTimeout(()=>{if(currentSession(current)&&current.socket.readyState===WebSocket.OPEN)current.socket.send(JSON.stringify({type:'UpdateEnquiryDraft',draft:{...emptyEnquiry,...cleanEnquiryPatch(draft).patch}}));},250);return()=>clearTimeout(timer);},[draft]);
  const pauseMic=useCallback(()=>{const current=session.current;if(!current)return;current.muted=true;setMicEnabled(false);current.stream?.getTracks().forEach(track=>track.stop());current.stream=null;current.input?.disconnect();current.source?.disconnect();current.gain?.disconnect();current.input=null;current.source=null;current.gain=null;setLevel(0);},[]);
  function toggleMic(){
    const current=session.current;if(!current?.ready)return;current.muted=!current.muted;setMicEnabled(!current.muted);
    if(current.muted){current.stream?.getTracks().forEach(track=>track.stop());current.stream=null;current.input?.disconnect();current.source?.disconnect();current.gain?.disconnect();current.input=null;current.source=null;current.gain=null;setLevel(0);phase(current.playback.hasAudio()?'speaking':'ready');}
    else startMic(current);
  }
  function sendText(text){const current=session.current;if(!current?.ready||!text.trim())return;current.playback.clear();current.dropAudio=true;append('user',text.trim());phase('thinking');setError('');current.socket.send(JSON.stringify({type:'InjectUserMessage',content:text.trim()}));}
  function interrupt(){const current=session.current;if(!current?.ready)return;current.playback.clear();current.dropAudio=true;current.muted=false;setMicEnabled(true);startMic(current);phase('listening');}
  async function replay(){const current=session.current;if(!current?.context)return;try{await current.context.resume();setNeedsPlay(false);setError('');}catch{setError('Sound is blocked. Check your browser audio settings.');}}
  return {speechFrame,status,messages,error,micEnabled,level,configured,needsPlay,enquiryReady,enquiryRevision,pauseMic,sendText,toggleMic,interrupt,replay,reconnect:connect};
}
