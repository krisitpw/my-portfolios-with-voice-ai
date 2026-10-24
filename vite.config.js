import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { createVoiceApi } from "./server/voice-api.mjs";
import { attachDeepgramProxy } from "./server/deepgram-proxy.mjs";
import { createLeadApi } from "./server/lead-api.mjs";
import { createLeadService } from "./server/lead-service.mjs";

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  const attachLeads = server => {const service=createLeadService({env});server.middlewares.use(createLeadApi({env,service}));const stop=service.startWorker();server.httpServer?.on('close',stop);};
  return {
    plugins: [react(), {
      name: "portfolio-voice-api",
      configureServer(server) { attachLeads(server);server.middlewares.use(createVoiceApi({ env })); attachDeepgramProxy(server.httpServer, { env }); },
      configurePreviewServer(server) { attachLeads(server);server.middlewares.use(createVoiceApi({ env })); attachDeepgramProxy(server.httpServer, { env }); },
    }],
  };
});
