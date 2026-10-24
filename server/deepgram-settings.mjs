import {GREETING,SYSTEM_PROMPT} from './portfolio-context.mjs';
import {ENQUIRY_FUNCTION} from './enquiry-tool.mjs';
import {voiceErrorMessage} from '../src/voice-errors.js';
import {voiceIdentity,DEFAULT_VOICE_SPEED,DEFAULT_VOICE_EXPRESSIVITY} from './voice-profile.mjs';
export const AGENT_URL='wss://agent.deepgram.com/v1/agent/converse';
export function deepgramSettings(env={},sampleRate=48000) {
  if(![16000,24000,32000,44100,48000].includes(sampleRate))throw Error('Unsupported microphone sample rate');
  const speed=Number(env.DEEPGRAM_TTS_SPEED||DEFAULT_VOICE_SPEED),expressivity=Number(env.DEEPGRAM_TTS_EXPRESSIVITY??DEFAULT_VOICE_EXPRESSIVITY);
  if(!Number.isFinite(speed)||speed<.5||speed>1.5||Math.abs(speed*20-Math.round(speed*20))>.0001)throw Error('Invalid Flux speech speed');
  if(![-2,-1,0,1,2].includes(expressivity))throw Error('Invalid Flux expressivity');
  return {type:'Settings',audio:{input:{encoding:'linear16',sample_rate:sampleRate},output:{encoding:'linear16',sample_rate:24000,container:'none'}},agent:{
    listen:{provider:{type:'deepgram',version:'v1',model:env.DEEPGRAM_STT_MODEL||'nova-3',language:env.DEEPGRAM_STT_LANGUAGE||'multi'}},
    think:{provider:{type:env.DEEPGRAM_THINK_PROVIDER||'open_ai',model:env.DEEPGRAM_THINK_MODEL||'gpt-4o-mini'},prompt:SYSTEM_PROMPT,functions:[ENQUIRY_FUNCTION]},
    speak:{provider:{type:'deepgram',version:'v2',model:voiceIdentity(env).model,speed,expressivity}},
    greeting:GREETING,
  }};
}
export function deepgramError(code='',status=0) {
  return deepgramFailure(code,status).message;
}
export function deepgramFailure(code='',status=0){
  // Only these fixed categories leave the server, never the provider's code/text.
  let safe='DEEPGRAM_CONNECTION';
  if(status===401||status===403||/AUTH|UNAUTHORIZED|INVALID_TOKEN/i.test(code))safe='DEEPGRAM_AUTH';
  else if(status===402||/CREDIT|PAYMENT|BALANCE/i.test(code))safe='DEEPGRAM_CREDITS';
  else if(/TIMEOUT/i.test(code)||status===408||status===504)safe='DEEPGRAM_TIMEOUT';
  else if(/SETTINGS|MODEL|PROVIDER/i.test(code))safe='DEEPGRAM_SETTINGS';
  else if(status===429||/LIMIT|CONCURRENCY|BACKPRESSURE/i.test(code))safe='DEEPGRAM_BUSY';
  else if(status>=500||/UNAVAILABLE|SERVICE|SERVER_ERROR/i.test(code))safe='DEEPGRAM_SERVICE';
  else if(['UPSTREAM_MESSAGE','CONNECTION_CLOSED','SESSION_ENDED','INVALID_CLIENT_MESSAGE'].includes(code))safe=code;
  return {code:safe,message:voiceErrorMessage(safe)};
}
