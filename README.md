# Krishna Singh — React Portfolio + Deepgram Voice Assistant

React/Vite portfolio with Inter typography, a dark grid, metallic cards, 3D accents, and an illustrated conversational avatar in a right-side popup. All 23 website entries and the GitHub link are retained.

## Setup

Requires Node.js 22+.

```bash
npm install
npm run dev
```

The root `.env` contains server-only configuration. Use `.env.example` as the template for a new installation:

```dotenv
DEEPGRAM_API_KEY=your_deepgram_key
DEEPGRAM_TTS_MODEL=flux-naveen-en
DEEPGRAM_TTS_SPEED=0.95
DEEPGRAM_TTS_EXPRESSIVITY=0
DEEPGRAM_STT_MODEL=nova-3
DEEPGRAM_STT_LANGUAGE=multi
DEEPGRAM_THINK_PROVIDER=open_ai
DEEPGRAM_THINK_MODEL=gpt-4o-mini
PORT=3000
HOST=127.0.0.1
```

Naveen (`flux-naveen-en`) is Deepgram’s adult male Indian English voice. The default pace is `0.95` with expressivity `0` to preserve the voice’s tuned delivery. These settings target a relaxed conversational sound; perceived naturalness still needs listening on your speakers. Speech uses the v2 provider, with raw 24 kHz PCM output. Listening uses Nova-3 multilingual transcription. Replies use Deepgram’s managed OpenAI integration, so no separate OpenAI or ElevenLabs key is needed. The pasted ElevenLabs provider settings are replaced by Deepgram speech. The default reasoning model is the documented managed `gpt-4o-mini`; change it only to a model supported by Deepgram Voice Agent.

Restart the server after editing `.env`. The key must have Voice Agent access and available credits. Environment files and backups are ignored by Git. Never use a `VITE_` prefix for a secret. Rotate any key shared in chat before publishing.

## Expressive delivery

Naveen uses `DEEPGRAM_TTS_EXPRESSIVITY=0` for its tuned delivery, without the previous animated expressivity setting. The script encourages warm greetings, curiosity about a visitor’s idea, calm technical explanations, empathy when someone is confused, and occasional spoken acknowledgments such as “hmm” or “mm-hmm.” Delivery depends on the voice model; these are conversational wording choices, not guaranteed emotion presets.

Flux does not implement the screenshot’s emotion/sound tag palette. Recognized competitor/SSML markup is stripped, and inline timed pauses are batch-only, so the live agent sends plain speech with natural punctuation. It does not insert fake `[laugh]`, `[crying]`, `[whisper]`, or `[pause 500ms]` commands. Expressivity is beta; set it to `0` to restore the voice’s tuned delivery if pronunciation or pacing is worse. Restart the server after changing it.

References: [Flux capabilities and markup handling](https://developers.deepgram.com/docs/flux-tts/feature-overview) and [Voice Agent expressivity](https://developers.deepgram.com/docs/voice-agent-tts-models).

## Conversation

Open the human icon, “Talk to AI,” or the hero’s AI button. The assistant connects and speaks its greeting automatically. After greeting playback, the browser requests microphone access. With permission, audio streams continuously to Deepgram and speaking interrupts the current reply. Use Mute to release the microphone, Interrupt to stop local playback and begin listening, or type a question. If browser autoplay blocks sound, use Play reply. Closing releases microphone tracks, stops playback, and closes the provider session. Reopening starts a fresh conversation.

Voice input requires HTTPS or localhost, Web Audio, AudioWorklet, and microphone permission. Typed questions remain available if microphone access is denied. Deepgram processes submitted audio and conversation text under its service policies. The opening greeting introduces Krishna as a software engineer with 6+ years of experience and mentions websites, ecommerce, SaaS, AI software, and automation. The widget identifies the assistant as AI, and it describes verified skills and projects in first person. It stays transparent about being AI and uses the factual portfolio context in `server/portfolio-context.mjs`.

The browser connects to a same-origin WebSocket proxy. The server authenticates with Deepgram and owns the system prompt and provider settings. Browser clients cannot change the prompt or select another provider. Sessions are limited to five minutes by default, two concurrent sessions per IP, 20 total sessions, and ten new sessions per minute per IP. Platform-level spending controls and a shared limiter are recommended for deployments with multiple server instances.

## Production

```bash
npm test
npm run build
npm start
```

`npm start` serves `dist/`, public voice configuration, and the `/api/voice/agent` WebSocket endpoint at `http://127.0.0.1:3000`. For containers, set `HOST=0.0.0.0` and the platform’s `PORT`. The hosting platform or reverse proxy must support WebSocket upgrades and HTTPS. Static-only hosting of `dist/` cannot run this assistant. Store the environment variables in server secrets; do not expose the repository root as static files.

Vite development and preview servers attach the same proxy. No API credential is sent to the browser or bundled into the frontend.

### Vercel

Audit on 25 October 2026 (IST): the production config URL returned 200 with `configured: true`, while both an ordinary HTTP request and an HTTP/1.1 WebSocket upgrade request to `https://my-portfolios-with-voice-ai-yzsg.vercel.app/api/voice/agent` returned Vercel `404 NOT_FOUND`. This confirms the deployed route is not reaching the bridge. The local `api/voice/agent.js` and `vercel.json` were untracked at audit time, so neither was included in the current commit. The deployed commit/root directory and dashboard function inventory still need verification; no production Deepgram session has been established in this audit.

The exported Node HTTP server matches [Vercel's current WebSocket API](https://vercel.com/docs/functions/websockets). The same server has the upgrade listener attached; it does not call `listen()`. `vercel.json` keeps Vite, `npm run build`, and `dist`, explicitly enables `fluid: true` (supported by the [configuration schema](https://openapi.vercel.sh/vercel.json)), and sets the agent function's `maxDuration` to 300 seconds. This fits even the [Hobby Fluid Compute limit](https://vercel.com/docs/functions/configuring-functions/duration#duration-limits). Sessions end by 290 seconds. There are no rewrites, and only `dist` is public static output.

The root `api/` directory exposes these functions independently of the Vite build:

- `api/voice/config.js`: `GET /api/voice/config`, sharing the public configuration from the Node server. Other methods return 405. Responses are not cached and never contain credentials. `configured` means only that the key is non-empty; it does not validate authentication, permissions, models, or credit balance.
- `api/voice/agent.js`: `/api/voice/agent`, exporting the existing secured Deepgram bridge. An ordinary GET returns 426 when configured, or a safe 503 `MISSING_KEY` response when the key is absent. A valid same-origin WebSocket request can upgrade to 101. No second voice proxy is used.
- `api/leads.js`: `/api/leads`, a native HTTP server using the existing validation, consent, origin, size, honeypot, and rate checks with a serverless-safe durable intake adapter (described below). It does not run the local file outbox.

In **Vercel Project Settings → Environment Variables**, configure these independently for **Production** and **Preview** as needed, then redeploy. All are server-only; never prefix them with `VITE_`:

| Variable | Required/default |
| --- | --- |
| `DEEPGRAM_API_KEY` | Required to start voice; Voice Agent permissions and available credits required |
| `DEEPGRAM_TTS_MODEL` | `flux-naveen-en` |
| `DEEPGRAM_TTS_SPEED` | `0.95` |
| `DEEPGRAM_TTS_EXPRESSIVITY` | `0` |
| `DEEPGRAM_STT_MODEL` | `nova-3` |
| `DEEPGRAM_STT_LANGUAGE` | `multi` |
| `DEEPGRAM_THINK_PROVIDER` | `open_ai` |
| `DEEPGRAM_THINK_MODEL` | `gpt-4o-mini` |
| `DEEPGRAM_MAX_SESSION_SECONDS` | Optional; Vercel sessions are clamped to 30–290 seconds |
| `LEADS_INTAKE_URL` | Required for Vercel enquiry acceptance; authenticated durable HTTPS receiver |
| `LEADS_INTAKE_TOKEN` | Required for that receiver; sent only server-to-server |

The speech profile now defaults to Naveen (male Indian English), speed `0.95`, and expressivity `0`. Update the three `DEEPGRAM_TTS_*` values in Vercel Production and Preview and redeploy; existing environment overrides take precedence over source defaults. The server reports the selected model in public config and `SessionReady`; the config accent follows known voice selections. Recognition and reasoning defaults were retained. Voice readiness requires Deepgram's `SettingsApplied` response and the bridge's `SessionReady` event. The frontend has separate config-fetch, WebSocket handshake, and Deepgram startup deadlines. Microphone capture still starts after greeting playback, and denied microphone permission leaves typed chat available. Closing/restarting releases audio and connection resources; stale callbacks cannot activate an old session.

Voice logs contain generated `sessionId` values and fixed event names such as `upgrade_rejected`, `upgrade_accepted`, `upstream_connecting`, `session_ready`, `session_failed`, and `session_closed`, plus safe status/category values. They contain no headers, provider response bodies, audio, transcripts, prompts, or keys. Search these events in the agent function's Vercel logs. Browser WebSocket APIs do not expose rejected upgrade response bodies/statuses, so a handshake failure message cannot identify the exact HTTP rejection; use the server log or an explicit upgrade probe for that distinction. Key presence is checked separately through config.

Per-process connection/rate limits remain; use Vercel Firewall rules for limits shared across instances. No deployment/account settings have been changed remotely.

#### Vercel enquiry storage

Local files, including `/tmp`, are not durable lead storage in Vercel Functions. `LEADS_DATA_DIR` is used only by the standalone persistent Node service. The Vercel adapter deliberately returns 503 with an actionable message if durable intake is unconfigured. A CRM webhook's generic 200 response and a successful SMTP send are not treated as stored receipts.

Configure `LEADS_INTAKE_URL` only after provisioning a trusted HTTPS intake service backed by a durable database/storage and delivery queue. This repository does not provision that service or invent its credentials. The adapter sends a Bearer token, `Idempotency-Key`, and JSON `{id, name, phone, email, requirement, message, consent: true, source: "krishna-portfolio"}`. Requirement is the validated service ID. The receiver must authenticate the token, validate the data, deduplicate the UUID (reject conflicting reuse with 409), and atomically persist the lead and delivery work. It must return `{stored: true, id: "<same submitted UUID>"}` only after durable commit. Generic 2xx responses, wrong IDs, redirects, timeouts, and failures cannot confirm acceptance. The ID must remain stable across retry after a lost response.

The receiver owns reliable SMTP/CRM delivery and retries. It can reuse `createLeadService` on persistent Node hosting, adapting its committed receipt to this contract and running its worker, or use its own transactional database/queue. Keep SMTP/CRM credentials on that receiver. Existing standalone SMTP/CRM behavior and retry tests are preserved. No remote receiver or actual email/CRM delivery has been verified in this audit.

#### Deployment verification

1. Commit all changed/new source files, especially `api/voice/agent.js` and `vercel.json`, and push the production branch. In Vercel, verify the repository root directory, deployed commit SHA, Vite build command/output, and effective Fluid Compute setting.
2. Confirm the new deployment lists `api/voice/config.js`, `api/voice/agent.js`, and `api/leads.js` as Functions. The previously tested deployment does not expose the agent route; local tests cannot prove production function discovery.
3. Confirm `/api/voice/config` returns JSON 200 with `configured: true`. An ordinary `/api/voice/agent` request should now return 426 rather than 404 (or 503 if missing the key).
4. Open browser DevTools → Network → WS and restart the assistant. Require a 101 upgrade, client `Start`, bridge `SessionReady`, and the spoken greeting. Confirm the correlated server log reaches `session_ready`. Check the sanitized category if startup fails.
5. Send a typed portfolio question and hear the answer. Allow the microphone after the greeting; verify transcription, response audio, interruption, mute, denied-permission typed fallback, closing, and restart. Check that no old session remains active after closing.
6. Test an invalid Origin with an upgrade client and expect 403. Check that no credential, prompt, raw provider error, or audio/transcript is present in configuration/error responses or logs. Conversation text/audio are intentionally streamed only to the active voice client.
7. Submit an enquiry without intake configuration and require 503 with no success notice. After provisioning the durable receiver, submit with consent, verify the stored receipt and SMTP/CRM delivery, then retry the same UUID and verify deduplication. Reject missing consent and invalid origins.

Automated tests mock Deepgram and durable intake; they do not use a live key. Local handshake tests require permission to bind localhost. A secret-free build can be checked with `DEEPGRAM_API_KEY= npm run build`. Production readiness remains unverified until all applicable checks above pass on the deployed commit.

## Implementation

- `src/components/VoiceAssistant.jsx`: popup, transcripts, status, microphone and typed input.
- `src/useVoiceAssistant.js`: browser conversation lifecycle and cleanup.
- `src/pcm-worklet.js`: microphone capture as mono 16-bit PCM.
- `src/pcm-audio.js`: streamed PCM playback, interruption, and mouth energy tracking.
- `server/deepgram-proxy.mjs`: authenticated WebSocket relay, origin checks, validation, limits, and sanitized errors.
- `server/deepgram-settings.mjs`: server-owned voice, listening, and reasoning settings.
- `server/voice-api.mjs`: public configuration without credentials.
- `server/portfolio-context.mjs`: greeting and factual assistant instructions.

Official references: [Indian English voices](https://developers.deepgram.com/docs/flux-tts/voices), [Voice Agent speech models](https://developers.deepgram.com/docs/voice-agent-tts-models), [message flow](https://developers.deepgram.com/docs/voice-agent-message-flow), and [managed reasoning models](https://developers.deepgram.com/docs/voice-agent-llm-models).

## Avatar

The supplied illustration has its hoodie logo removed. Neutral, speaking, and blinking PNG masters plus delivery JPEGs are in `src/assets/`; generation prompts are recorded in `src/assets/avatar-generation.md`.

`VideoAvatar.jsx` blends feathered mouth and eye regions on a 768×512 canvas and displays its 30 fps capture in an inline video. The mouth follows energy from the actual streamed speech. Idle blinking, subtle motion, fallback canvas/poster, and reduced-motion support are included. No webcam or separate avatar service is used. This is an animated illustration with amplitude-based mouth movement, not phoneme-accurate lip synchronization.

For a local avatar check without provider calls, run `npm run dev` and open `/tests/avatar-preview.html`. This test entry and synthetic WAV fixture are excluded from production.

## Validation and backups

`npm test` covers server-owned settings, safe public configuration, WebSocket handshakes and relay, error sanitization, origin and credential checks, PCM capture/playback, interruption cleanup, and speech energy. Live Deepgram greeting, typed portfolio answers, streamed speech, and Nova-3 transcription of a synthetic sample have been verified. The browser popup and animated avatar were checked with the microphone muted. Real microphone recording is not part of automated validation.

Before this migration, 39 files were archived and verified by SHA-256:

`backups/before-deepgram-migration-20261024-023042.tar.gz`

Earlier backups remain in `backups/`, including `before-video-avatar-20261024-020626.tar.gz` and `complete-before-conversational-popup-20261024-015335.tar.gz`. Backups exclude environment secrets and installed dependencies. Extract into a separate directory to review or restore, then run `npm install`.

## Pricing and project enquiries

The Pricing section contains the nine website/software packages from the supplied image, Google Ads/Meta Ads management (₹15,000/month for the first two months, ₹12,000/month thereafter), SEO/AEO (₹8,000/month per website), and the supplied project terms. `src/pricing-data.js` is shared by the UI and the AI context, so the avatar uses the same published estimates. Pricing buttons preselect a service in the enquiry form. The AI can collect enquiry fields by voice or typed chat, one at a time or all together, and fill the review form in its popup. The same draft is available in the full-page form. Visitors review or edit the fields, tick consent, and press **Send project enquiry**. Voice recordings and full transcripts are never attached to leads.

Clients provide name, phone, email, their service requirement (the “What can I help with?” selection), and a project message, then explicitly agree to email/CRM processing. The server validates the submission and saves it before returning a receipt. Configure these server-only values in `.env`:

```dotenv
LEAD_EMAIL_TO=singhkrishna512@gmail.com
LEAD_EMAIL_FROM=your_verified_sender@example.com
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_login
SMTP_PASSWORD=your_smtp_password_or_app_password
CRM_WEBHOOK_URL=https://your-crm.example.com/webhook
CRM_WEBHOOK_TOKEN=
LEADS_DATA_DIR=data/leads
```

Use your email provider’s SMTP credentials and an allowed sender address. Port 587 requires STARTTLS; use port 465 with `SMTP_SECURE=true` for implicit TLS. The visitor’s email is used only as Reply-To, never as the sender. See [Nodemailer SMTP configuration](https://nodemailer.com/smtp).

The CRM receives an HTTPS POST with exactly these fields:

```json
{"name":"Client name","phone":"+91 98765 43210","email":"client@example.com","requirement":"5-page website · WordPress","message":"Project description, desired features and timeline"}
```

`CRM_WEBHOOK_TOKEN` adds an optional `Authorization: Bearer …` header. The destination is server-owned and never accepted from browser input; redirects are disabled. A stable lead UUID is sent as `Idempotency-Key`, which the CRM should use for deduplication. Webhook URLs, tokens, and SMTP passwords are never returned to the frontend.

**Delivery is not active until the relevant settings are filled in and the server restarted.** Without settings, leads are still saved privately with `not_configured` delivery status. With settings, email and CRM are attempted independently; one destination’s failure does not resend successful deliveries to the other. Pending deliveries retry every minute with exponential backoff up to one hour, including after a restart. To retry immediately after correcting settings:

```bash
npm run leads:retry
```

Private JSON records are stored in `LEADS_DATA_DIR` (default `data/leads`) with owner-only file permissions. Each includes receipt ID, contact information, requirement, message, consent, timestamp, and per-destination delivery status. This directory is ignored by Git and never served through the HTTP API. Keep it on a persistent, private disk/volume, back it up securely, and manage retention according to your business needs. Static hosting or ephemeral server storage cannot preserve enquiries. Use one Node server process against this directory; multiple replicas need a shared transactional database/queue. Delivery is at-least-once across a crash during an outbound request; a destination should deduplicate by lead ID.

Same-origin JSON requests, size limits, validation, a honeypot, and a per-IP limit of 10 submissions per ten minutes are included. The limiter uses the direct network peer; configure platform-level limits for public deployments behind a proxy. There is no public lead-list endpoint. Delivery errors are kept generic in the browser and no submitted personal data is logged.

Tests use temporary private storage and mocked delivery services to verify durable receipts, exact webhook payloads, email addressing, retries, duplicate requests, Unicode input, consent, spam limits, and failure states. Actual email/CRM delivery must be verified after your credentials and webhook are configured.

Pre-change backup: `backups/before-leads-pricing-20261024-083856.tar.gz` (verified; credentials and runtime lead records excluded).

## Conversational enquiry collection

Simply say or type that you want to enquire. The AI asks for missing details naturally; visitors can share one field at a time or all details in a single message. Collection-mode buttons, tabs, progress counts, and the provider/voice subtitle are hidden from the interface. The agent uses the server-owned `update_enquiry` function to fill name, phone, email, requirement, and message. It asks only for missing/invalid fields, accepts corrections, and preserves earlier answers. The service selection is required; **Something else / Let’s discuss** handles enquiries without a package match.

`server/enquiry-tool.mjs` defines the tool and a validated in-session draft. Function requests are handled in the authenticated bridge; arbitrary browser function results and submission commands are rejected. Tools are deferred until the user’s turn ends, and duplicate function IDs are ignored. The draft tool cannot grant consent, save a lead, send email, or call the CRM. Drafts stay in browser/server session memory and are not stored in localStorage or the lead outbox before submission.

When all five fields are valid, the popup automatically opens a review form with editable values. Microphone capture stops during review. Visitors can use **Back to chat** to correct details by speaking or typing; enable the microphone again if needed. They must tick the consent checkbox and press **Send project enquiry**. A spoken “yes” alone never submits. Submission uses the same durable API and delivery queue as the full-page form. The CRM receives exactly `name`, `phone`, `email`, `requirement`, and `message`; `requirement` is the human-readable service selection, while `message` is the detailed description. Older stored leads with `service`/`requirements` are mapped on delivery to the new schema without resending destinations already marked sent.

Provider references: [Deepgram function definitions](https://developers.deepgram.com/docs/build-a-function-call), [function requests](https://developers.deepgram.com/docs/voice-agent-function-call-request), and [function responses](https://developers.deepgram.com/docs/voice-agent-function-call-response).

Pre-change backup: `backups/before-ai-lead-collection-20261024-085742.tar.gz` (verified; credentials and lead records excluded).
# my-portfolios-with-voice-ai
my-portfolios-with-voice-ai
