# IMP.md — Implementation Progress
## Korean ↔ English Real-Time Translation Service

**Last Updated**: 2026-02-21

---

## Milestone Tracker

Reference: TRD.md §13

| # | Milestone | Status | Notes |
|---|-----------|--------|-------|
| 1 | Project scaffolding | ✅ Done | Docker Compose, project structure, configs. CI deferred. |
| 2 | Server core | ✅ Done | WS gateway, session manager, message protocol, config (Zod) |
| 3 | Deepgram adapter | ✅ Code done | Adapter implemented. Needs live API key test. |
| 4 | Translation pipeline | ✅ Code done | NMT (Google), LLM (Google TLLM + Claude). Needs live test. |
| 5 | SDK core | ✅ Done | Audio capture, WS client, event emitter, session state. UMD bundle 2.8KB gzip. |
| 6 | End-to-end demo | ❌ Not started | Needs real API keys + wiring verification |
| 7 | Google adapter | ✅ Code done | gRPC duplex stream, 5-min restart. Needs live test. |
| 8 | OpenAI adapter | ✅ Code done | Realtime API, 16→24kHz resampling. Needs live test. |
| 9 | Qwen3-ASR adapter | ✅ Code done | Python wrapper + server adapter. Needs GPU host. |
| 10 | Frontend app | ✅ Done | React + Zustand + Tailwind. Landing, Translate, Settings pages. |
| 11 | SDK polish | ❌ Not started | Shadow DOM, themes, docs, npm publish (deferred per TRD) |
| 12 | Testing & benchmarks | ❌ Not started | Unit tests, CER evaluation (deferred per TRD) |

---

## Detailed Breakdown

### ✅ Completed

#### Infrastructure & Config
- [x] `.gitignore`, `.env.example`, `docker-compose.yml`
- [x] `secrets/.gitkeep`
- [x] `scripts/setup.sh`, `scripts/seed-db.sql` (Postgres schema: sessions, transcripts, api_keys, usage)
- [x] Server Dockerfile (multi-stage, node:20-alpine)
- [x] Frontend Dockerfile (multi-stage, nginx:alpine)
- [x] SDK Dockerfile
- [x] Qwen3-ASR Dockerfile.gpu
- [x] Docker build verified: server ✅, frontend ✅

#### Server — Config & Core
- [x] `server/src/config/index.ts` — Zod env schema, `loadConfig()`, `resolveProviderConfig()`
- [x] `server/src/config/providers.ts` — per-provider config schemas
- [x] `server/src/config/logger.ts` — pino structured logger
- [x] `server/src/ws/gateway.ts` — WebSocket server, heartbeat, message routing
- [x] `server/src/ws/session.ts` — per-connection session, ASR↔translation pipeline wiring
- [x] `server/src/index.ts` — HTTP server + WS gateway + graceful shutdown

#### Server — ASR Adapters (all 4 providers)
- [x] `server/src/asr/types.ts` — `IASRProvider`, `TranscriptResult`, `ASRError`, `ASRProviderConfig`
- [x] `server/src/asr/router.ts` — provider factory
- [x] `server/src/asr/deepgram.ts` — `@deepgram/sdk`, `LiveTranscriptionEvents`, `is_final`+`speech_final`, keepAlive
- [x] `server/src/asr/google.ts` — `@google-cloud/speech` gRPC duplex stream, 5-min restart logic
- [x] `server/src/asr/openai.ts` — Realtime API WS, `transcription_session.update`, 16kHz→24kHz resampling, accumulated deltas
- [x] `server/src/asr/qwen3-asr.ts` — internal WS adapter to Python engine

#### Server — Translation Engines
- [x] `server/src/translation/types.ts` — `ITranslationEngine`, `TranslationResult`, `TranslationError`
- [x] `server/src/translation/router.ts` — interim→NMT, final→LLM routing
- [x] `server/src/translation/nmt.ts` — Google Cloud Translation v3 (location=global)
- [x] `server/src/translation/llm.ts` — Google Translation LLM v3 (location=us-central1, model=translation-llm)
- [x] `server/src/translation/claude.ts` — Anthropic SDK, system prompt preserving Korean formality register

#### Server — Storage
- [x] `server/src/storage/session-store.ts` — PostgreSQL session persistence (stub)
- [x] `server/src/storage/usage-tracker.ts` — usage metering (stub)

#### SDK
- [x] `sdk/src/types.ts` — `TranslateSDKConfig` (with `serverUrl`), `TranslateSDKInstance`, events
- [x] `sdk/src/transport/protocol.ts` — full client↔server message protocol
- [x] `sdk/src/audio/capture.ts` — AudioWorklet mic capture, PCM16 encoding, 20ms frames (640 bytes)
- [x] `sdk/src/audio/resampler.ts` — linear interpolation resampler, float32→PCM16
- [x] `sdk/src/transport/ws-client.ts` — WebSocket with auto-reconnect, heartbeat, audio buffering
- [x] `sdk/src/events/emitter.ts` — type-safe event emitter
- [x] `sdk/src/state/session-state.ts` — internal state (finals, interim, translations)
- [x] `sdk/src/index.ts` — public API: `TranslateSDK.init()`, start/stop/destroy, getters, setters
- [x] Rollup UMD + ESM bundle — 2.8KB gzipped (target: <15KB)

#### Frontend
- [x] `frontend/src/store/useTranslatorStore.ts` — Zustand store
- [x] `frontend/src/hooks/useTranslator.ts` — SDK wrapper hook
- [x] `frontend/src/hooks/useAudioLevel.ts` — audio level hook
- [x] `frontend/src/pages/Landing.tsx`, `Translate.tsx`, `Settings.tsx`
- [x] `frontend/src/components/StatusBar.tsx`, `AudioVisualizer.tsx`
- [x] `frontend/src/components/Controls/RecordButton.tsx`, `TranscriptionToggle.tsx`
- [x] `frontend/src/components/TranslationPanel/SourcePanel.tsx`, `TargetPanel.tsx`, `SentenceRow.tsx`
- [x] `frontend/src/main.tsx`, `App.tsx`, `index.css`, `types/index.ts`
- [x] Vite build passes

#### Qwen3-ASR
- [x] `qwen3-asr/src/server.py` — streaming WebSocket server
- [x] `qwen3-asr/src/config.py` — model & server config
- [x] `qwen3-asr/src/health.py` — health check endpoint
- [x] `qwen3-asr/requirements.txt`

#### Build Verification
- [x] TypeScript: server 0 errors, SDK 0 errors, frontend 0 errors
- [x] Server build: `tsc` ✅
- [x] SDK build: Rollup UMD + ESM ✅
- [x] Frontend build: `tsc -b && vite build` ✅
- [x] Docker: server image ✅, frontend image ✅

#### Git
- [x] 9 atomic commits following `<type>(<scope>): <description>` convention

---

### 🔲 Remaining

#### Milestone 6 — End-to-End Demo
- [ ] Configure real API keys (Deepgram, Google, OpenAI)
- [ ] Run `docker compose up` with server + redis + db
- [ ] Verify SDK→Server WS connection
- [ ] Verify audio pipeline: mic → SDK → server → ASR provider → transcript back
- [ ] Verify translation pipeline: transcript → NMT/LLM → translation back
- [ ] Verify frontend displays live transcript + translation

#### Milestone 9 — Qwen3-ASR Live Test
- [ ] Test on GPU-enabled host
- [ ] Docker build with `Dockerfile.gpu`
- [ ] Verify WebSocket streaming from server adapter to Python engine

#### Milestone 11 — SDK Polish (deferred)
- [ ] Shadow DOM encapsulation (if UI layer added)
- [ ] Theming system
- [ ] npm package publishing
- [ ] SDK API documentation
- [ ] CDN deployment

#### Milestone 12 — Testing & Benchmarks (deferred)
- [ ] Unit tests: ASR adapters (`deepgram.test.ts`, `google.test.ts`, `openai.test.ts`, `qwen3-asr.test.ts`)
- [ ] Unit tests: Translation engines (`nmt.test.ts`, `llm.test.ts`)
- [ ] Unit tests: SDK modules
- [ ] Integration tests: session flow with mock providers
- [ ] E2E tests: Playwright browser tests
- [ ] `scripts/benchmark/evaluate.py` — CER evaluation script
- [ ] Korean test audio corpus (`scripts/benchmark/korean-test-audio/`)
- [ ] Load testing with k6

#### Infrastructure Gaps
- [ ] Frontend nginx.conf for SPA routing + WebSocket proxy
- [ ] `docker-compose.prod.yml`
- [ ] CI/CD pipeline (deferred per user)
- [ ] API key auth validation (server currently has stub)
- [ ] Rate limiting per API key
- [ ] Session persistence wiring (store stub exists, not wired to WS sessions)
- [ ] Usage tracking wiring (tracker stub exists, not wired)
- [ ] Redis integration (cache layer referenced in config but not used yet)
- [ ] Health check endpoints on server (`/health`)

#### Known Technical Gaps
- [ ] Server `storage/session-store.ts` and `storage/usage-tracker.ts` are stubs — need real Postgres queries
- [ ] OpenAI adapter: TRD §9.2 says use ephemeral keys via `POST /v1/realtime/client_secrets` — current impl uses direct API key in WS header (works server-side but differs from spec)
- [ ] Google adapter: 5-min stream restart needs E2E validation under real load
- [ ] Frontend `useTranslator` hook needs SDK package dependency wiring (currently types-only)
