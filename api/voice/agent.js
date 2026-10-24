import {createServer} from 'node:http';
import {attachDeepgramProxy} from '../../server/deepgram-proxy.mjs';
import {voiceErrorMessage} from '../../src/voice-errors.js';

// Vercel's Node runtime accepts an exported HTTP server for WebSocket upgrades.
// Do not listen here: Vercel manages the listener.
const server=createServer((req,res)=>{
  const missing=!process.env.DEEPGRAM_API_KEY?.trim();
  res.writeHead(missing?503:426,{'Content-Type':'application/json','Cache-Control':'no-store'});
  res.end(JSON.stringify({error:{code:missing?'MISSING_KEY':'USE_VOICE_SOCKET',message:missing?voiceErrorMessage('MISSING_KEY'):'Use the voice conversation WebSocket connection.'}}));
});

attachDeepgramProxy(server,{env:{
  ...process.env,
  // End cleanly before Vercel's 300-second function deadline.
  DEEPGRAM_MAX_SESSION_SECONDS:Math.min(290,Number(process.env.DEEPGRAM_MAX_SESSION_SECONDS)||290),
}});

export default server;
