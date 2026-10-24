import {GREETING,SYSTEM_PROMPT} from './portfolio-context.mjs';
import {ENQUIRY_FUNCTION} from './enquiry-tool.mjs';
export const AGENT_URL='wss://agent.deepgram.com/v1/agent/converse';
export function deepgramSettings(env={},sampleRate=48000) {
  if(![16000,24000,32000,44100,48000].includes(sampleRate))throw Error('Unsupported microphone sample rate');
  const speed=Number(env.DEEPGRAM_TTS_SPEED||1),expressivity=Number(env.DEEPGRAM_TTS_EXPRESSIVITY??1);
  if(!Number.isFinite(speed)||speed<.5||speed>1.5||Math.abs(speed*20-Math.round(speed*20))>.0001)throw Error('Invalid Flux speech speed');
  if(![-2,-1,0,1,2].includes(expressivity))throw Error('Invalid Flux expressivity');
  return {type:'Settings',audio:{input:{encoding:'linear16',sample_rate:sampleRate},output:{encoding:'linear16',sample_rate:24000,container:'none'}},agent:{
    listen:{provider:{type:'deepgram',version:'v1',model:env.DEEPGRAM_STT_MODEL||'nova-3',language:env.DEEPGRAM_STT_LANGUAGE||'multi'}},
    think:{provider:{type:env.DEEPGRAM_THINK_PROVIDER||'open_ai',model:env.DEEPGRAM_THINK_MODEL||'gpt-4o-mini'},prompt:SYSTEM_PROMPT,functions:[ENQUIRY_FUNCTION]},
    speak:{provider:{type:'deepgram',version:'v2',model:env.DEEPGRAM_TTS_MODEL||'flux-naveen-en',speed,expressivity}},
    greeting:GREETING,
  }};
}
export function deepgramError(code='',status=0) {
  if(status===401||status===403||/AUTH|UNAUTHORIZED|INVALID_TOKEN/i.test(code))return 'Deepgram could not authenticate. Check the server API key and its Voice Agent permissions.';
  if(status===402||/CREDIT|PAYMENT|BALANCE/i.test(code))return 'Deepgram needs available credits to start the voice conversation.';
  if(/SETTINGS|MODEL|PROVIDER/i.test(code))return 'Deepgram could not apply the configured voice or conversation model. Check the server settings.';
  if(status===429||/LIMIT|CONCURRENCY/i.test(code))return 'The voice assistant is busy. Please try again shortly.';
  return 'The Deepgram conversation could not connect. Please try again or contact Krishna directly.';
}
