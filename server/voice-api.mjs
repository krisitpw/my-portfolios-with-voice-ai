// Public configuration contains no credentials. Audio and chat use the secured WS bridge.
import {voiceIdentity} from './deepgram-settings.mjs';
export function createVoiceApi({env=process.env}={}) {
  return function voiceApi(req,res,next=()=>{res.writeHead(404);res.end();}) {
    const path=(req.url||'').split('?')[0];if(!path.startsWith('/api/voice/'))return next();
    if(path==='/api/voice/config'){
      if(req.method!=='GET'){
        res.writeHead(405,{'Allow':'GET','Content-Type':'application/json','Cache-Control':'no-store'});
        return res.end(JSON.stringify({error:'Method not allowed'}));
      }
      res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
      const {model,accent}=voiceIdentity(env);
      return res.end(JSON.stringify({configured:Boolean(env.DEEPGRAM_API_KEY?.trim()),provider:'Deepgram',voice:model,accent,transport:'websocket'}));
    }
    res.writeHead(404,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{code:'USE_VOICE_SOCKET',message:'Use the voice conversation connection.'}}));
  };
}
