import {createServer} from 'node:http';
import {createLeadApi} from '../server/lead-api.mjs';
import {createRemoteLeadService} from '../server/remote-lead-service.mjs';

// Export a native server so the shared API receives the raw request stream.
// No file outbox or background interval runs inside a Vercel Function.
export default createServer(createLeadApi({service:createRemoteLeadService()}));
