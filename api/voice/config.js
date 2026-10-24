import {createVoiceApi} from '../../server/voice-api.mjs';

// Keep local and deployed public responses identical. Never return credentials.
export default createVoiceApi();
