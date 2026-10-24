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
DEEPGRAM_TTS_SPEED=1
DEEPGRAM_TTS_EXPRESSIVITY=1
DEEPGRAM_STT_MODEL=nova-3
DEEPGRAM_STT_LANGUAGE=multi
DEEPGRAM_THINK_PROVIDER=open_ai
DEEPGRAM_THINK_MODEL=gpt-4o-mini
PORT=3000
HOST=127.0.0.1
```

Naveen is Deepgram’s Indian English male voice. Speech uses the v2 provider, with raw 24 kHz PCM output. Listening uses Nova-3 multilingual transcription. Replies use Deepgram’s managed OpenAI integration, so no separate OpenAI or ElevenLabs key is needed. The pasted ElevenLabs provider settings are replaced by Deepgram speech. The default reasoning model is the documented managed `gpt-4o-mini`; change it only to a model supported by Deepgram Voice Agent.

Restart the server after editing `.env`. The key must have Voice Agent access and available credits. Environment files and backups are ignored by Git. Never use a `VITE_` prefix for a secret. Rotate any key shared in chat before publishing.

## Expressive delivery

Naveen uses `DEEPGRAM_TTS_EXPRESSIVITY=1` for a more animated delivery. The script encourages warm greetings, curiosity about a visitor’s idea, calm technical explanations, empathy when someone is confused, and occasional spoken acknowledgments such as “hmm” or “mm-hmm.” Delivery depends on the voice model; these are conversational wording choices, not guaranteed emotion presets.

Flux does not implement the screenshot’s emotion/sound tag palette. Recognized competitor/SSML markup is stripped, and inline timed pauses are batch-only, so the live agent sends plain speech with natural punctuation. It does not insert fake `[laugh]`, `[crying]`, `[whisper]`, or `[pause 500ms]` commands. Expressivity is beta; set it to `0` to restore the voice’s tuned delivery if pronunciation or pacing is worse. Restart the server after changing it.

References: [Flux capabilities and markup handling](https://developers.deepgram.com/docs/flux-tts/feature-overview) and [Voice Agent expressivity](https://developers.deepgram.com/docs/voice-agent-tts-models).

## Conversation

Open the human icon, “Talk to AI,” or the hero’s AI button. The assistant connects and speaks its greeting automatically. After greeting playback, the browser requests microphone access. With permission, audio streams continuously to Deepgram and speaking interrupts the current reply. Use Mute to release the microphone, Interrupt to stop local playback and begin listening, or type a question. If browser autoplay blocks sound, use Play reply. Closing releases microphone tracks, stops playback, and closes the provider session. Reopening starts a fresh conversation.

Voice input requires HTTPS or localhost, Web Audio, AudioWorklet, and microphone permission. Typed questions remain available if microphone access is denied. Deepgram processes submitted audio and conversation text under its service policies. The avatar introduces itself as Krishna’s AI avatar and describes verified skills and projects in first person. It stays transparent about being AI and uses the factual portfolio context in `server/portfolio-context.mjs`.

The browser connects to a same-origin WebSocket proxy. The server authenticates with Deepgram and owns the system prompt and provider settings. Browser clients cannot change the prompt or select another provider. Sessions are limited to five minutes by default, two concurrent sessions per IP, 20 total sessions, and ten new sessions per minute per IP. Platform-level spending controls and a shared limiter are recommended for deployments with multiple server instances.

## Production

```bash
npm test
npm run build
npm start
```

`npm start` serves `dist/`, public voice configuration, and the `/api/voice/agent` WebSocket endpoint at `http://127.0.0.1:3000`. For containers, set `HOST=0.0.0.0` and the platform’s `PORT`. The hosting platform or reverse proxy must support WebSocket upgrades and HTTPS. Static-only hosting of `dist/` cannot run this assistant. Store the environment variables in server secrets; do not expose the repository root as static files.

Vite development and preview servers attach the same proxy. No API credential is sent to the browser or bundled into the frontend.

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
