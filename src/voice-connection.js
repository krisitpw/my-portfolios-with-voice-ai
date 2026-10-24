import {voiceErrorMessage} from './voice-errors.js';

export function voiceSocketURL(location){
  return `${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/api/voice/agent`;
}

// A single connection owns its handlers and deadlines. Closing/restarting cancels
// all callbacks, including late events from a previous session.
export function openVoiceConnection({url,sampleRate,draft,onReady,onEvent,onAudio,onFailure,Socket=WebSocket,setTimer=setTimeout,clearTimer=clearTimeout}){
  const socket=new Socket(url);socket.binaryType='arraybuffer';
  let opened=false,ready=false,closed=false;
  let timer=setTimer(()=>fail('HANDSHAKE_TIMEOUT'),15000);
  function close(){
    if(closed)return;closed=true;clearTimer(timer);
    socket.onopen=null;socket.onmessage=null;socket.onerror=null;socket.onclose=null;
    socket.close();
  }
  function fail(code){if(closed)return;close();onFailure(voiceErrorMessage(code));}
  socket.onopen=()=>{
    if(closed)return;opened=true;clearTimer(timer);
    timer=setTimer(()=>fail('DEEPGRAM_TIMEOUT'),35000);
    socket.send(JSON.stringify({type:'Start',sampleRate,draft}));
  };
  socket.onmessage=event=>{
    if(closed)return;
    if(event.data instanceof ArrayBuffer){if(ready)onAudio(event.data);return;}
    let message;try{message=JSON.parse(event.data);}catch{return;}
    if(!message||typeof message!=='object'||Array.isArray(message))return;
    if(message.type==='SessionError')return fail(message.code);
    if(message.type==='SessionReady'){
      if(!opened||ready)return;ready=true;clearTimer(timer);onReady();return;
    }
    if(ready)onEvent(message);
  };
  socket.onerror=()=>fail(!opened?'HANDSHAKE_FAILED':!ready?'BEFORE_READY':'CONNECTION_CLOSED');
  socket.onclose=()=>fail(!opened?'HANDSHAKE_FAILED':!ready?'BEFORE_READY':'CONNECTION_CLOSED');
  return {socket,close};
}
