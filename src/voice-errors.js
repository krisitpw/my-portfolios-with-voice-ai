// Public error vocabulary shared by the browser and server. No provider payloads.
const messages={
  MISSING_KEY:'The voice assistant is not configured. Ask Krishna to set the server Deepgram API key, then restart.',
  DEEPGRAM_AUTH:'Deepgram could not authenticate. Ask Krishna to check the server API key and its Voice Agent permissions.',
  DEEPGRAM_CREDITS:'Deepgram needs available credits to start the voice conversation. Please contact Krishna.',
  DEEPGRAM_SETTINGS:'Deepgram could not apply the configured voice or conversation model. Ask Krishna to check the server settings.',
  DEEPGRAM_TIMEOUT:'Deepgram took too long to connect. Restart the conversation to try again.',
  DEEPGRAM_BUSY:'The voice assistant is busy. Please try again shortly.',
  DEEPGRAM_SERVICE:'The Deepgram service is unavailable. Restart shortly or contact Krishna directly.',
  DEEPGRAM_CONNECTION:'The server could not connect to Deepgram. Restart shortly or contact Krishna directly.',
  UPSTREAM_MESSAGE:'The voice service sent an invalid response. Restart the conversation.',
  CONNECTION_CLOSED:'The voice connection ended. Restart the conversation to continue.',
  SESSION_ENDED:'This session has ended. Restart the conversation to continue.',
  INVALID_CLIENT_MESSAGE:'The voice connection received an unsupported message. Restart the conversation.',
  HANDSHAKE_FAILED:'The WebSocket handshake failed or was blocked. Restart; if it continues, ask Krishna to check the deployed voice function and Fluid Compute.',
  BEFORE_READY:'The WebSocket closed before the voice session became ready. Restart; if it continues, ask Krishna to check the voice function logs.',
  HANDSHAKE_TIMEOUT:'The voice WebSocket did not open in time. Restart and check your connection.',
};
export function voiceErrorMessage(code){return messages[code]||'The voice conversation could not connect. Restart or contact Krishna directly.';}
