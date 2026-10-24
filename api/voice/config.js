import {createVoiceApi} from '../../server/voice-api.mjs';

// Share the public response with local development and the standalone server.
// Credentials are read only on the server and never included in this response.
export default createVoiceApi();
