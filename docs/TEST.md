# Test Plan — Korean ↔ English Real-Time Translation Service

**Created**: 2026-03-08  
**Updated**: 2026-03-09  
**Status**: Phase 1 ✅, Phase 2 ✅, Phase 3 ✅, Phase 4 ✅ (unit), Phase 5 ✅ (unit)  
**Approach**: Phased, bottom-up — validate each layer before building on it  
**Excluded**: Local providers (Qwen3-ASR, Qwen-local translation)

---

## Overview

```
Phase 1-3: Server (backend)
Phase 4:   SDK (transport + audio)
Phase 5:   Frontend (React UI)
```

Each phase gates the next. Do not proceed until the current phase passes.

---

## Phase 1: Server — ASR Transcription

Test each cloud ASR provider independently. Send audio, verify Korean transcript comes back.

### 1a. Google Cloud STT

| Item | Detail |
|------|--------|
| Provider | `google` |
| Model | `latest_long` |
| Config | `ASR_PROVIDER=google`, `GOOGLE_APPLICATION_CREDENTIALS` set |
| What to test | Streaming connection, interim results, final results, 5-min stream restart logic |
| Success criteria | `TranscriptResult` returned with Korean text, `isFinal` flag, confidence > 0 |
| Status | ✅ **PASS** |
| Result | banmal: "나 오늘 너무 피곤해." (conf 0.87, 8 interims), jondaenmal: "저는 오늘 너무 피곤합니다." (conf 0.87, 9 interims) |

### 1b. Deepgram

| Item | Detail |
|------|--------|
| Provider | `deepgram` |
| Model | `nova-3` |
| Config | `ASR_PROVIDER=deepgram`, `DEEPGRAM_API_KEY` set |
| What to test | Streaming connection, keepalive (8s), interim results, VAD events, smart formatting |
| Success criteria | `TranscriptResult` returned with Korean text, `isFinal` flag, confidence > 0 |
| Status | ✅ **PASS** |
| Result | banmal: "나오늘너무피곤해." (conf 0.98, 1 interim — no spaces), jondaenmal: "오늘너무피곤합니다." (conf 0.99, 1 interim — drops "저는", no spaces) |
| Notes | Deepgram Korean lacks word spacing. Only 1 interim per sentence vs Google's 8-9. |

### 1c. OpenAI Realtime

| Item | Detail |
|------|--------|
| Provider | `openai` |
| Model | `gpt-4o-transcribe` (via `gpt-realtime` session) |
| Config | `ASR_PROVIDER=openai`, `OPENAI_API_KEY` set |
| What to test | WebSocket connection, 16kHz→24kHz resampling, delta accumulation, interim + final results |
| Success criteria | `TranscriptResult` returned with Korean text, `isFinal` flag, confidence > 0 |
| Status | ✅ **PASS** |
| Result | banmal: "나 오늘 너무 피곤해." (conf 1.00, 7 interims), jondaenmal: "저는 오늘 너무 피곤합니다." (conf 1.00, 8 interims) |
| Notes | Best accuracy and spacing. Adapter required major rewrite for GA API (nested `audio.input.*` format, `session.type: "realtime"` required). |

---

## Phase 2: Server — Translation

Test each cloud translation engine independently. Send Korean text, verify English comes back.

### 2a. Google NMT (Interim)

| Item | Detail |
|------|--------|
| Provider | `google` |
| Model | `nmt` |
| Config | `TRANSLATION_INTERIM_PROVIDER=google`, `TRANSLATION_INTERIM_MODEL=nmt` |
| What to test | Korean→English text translation, response shape |
| Success criteria | `TranslationResult` with English `translatedText`, latency < 500ms |
| Test sentences | Both 반말 and 존댓말 Korean sentences |
| Status | ✅ **PASS** (5/5) |
| Result | Latency 99-304ms. All sentences translated correctly. |

### 2b. Google TLLM (Final)

| Item | Detail |
|------|--------|
| Provider | `google` |
| Model | `tllm` |
| Config | `TRANSLATION_FINAL_PROVIDER=google`, `TRANSLATION_FINAL_MODEL=tllm` |
| What to test | Korean→English quality translation, us-central1 routing |
| Success criteria | `TranslationResult` with English `translatedText`, latency < 1000ms |
| Test sentences | Both 반말 and 존댓말 Korean sentences |
| Status | ✅ **PASS** (5/5) |
| Result | Latency 120-403ms. Higher quality translations than NMT with formality nuance. |

### 2c. Claude

| Item | Detail |
|------|--------|
| Provider | `claude` |
| Model | `claude-sonnet-4-6` |
| Config | `TRANSLATION_FINAL_PROVIDER=claude`, `CLAUDE_API_KEY` set |
| What to test | Korean→English with formality preservation prompt |
| Success criteria | `TranslationResult` with English `translatedText`, formality register preserved |
| Test sentences | Both 반말 and 존댓말 Korean sentences |
| Status | ✅ **PASS** (5/5) |
| Result | Latency 584-1018ms. Preserves formality register: 반말 "I'm so tired" vs 존댓말 "I am very tired today." |

### 2d. OpenAI GPT

| Item | Detail |
|------|--------|
| Provider | `openai` |
| Model | `gpt-4.1-mini` |
| Config | `TRANSLATION_FINAL_PROVIDER=openai`, `OPENAI_API_KEY` set |
| What to test | Korean→English with system prompt |
| Success criteria | `TranslationResult` with English `translatedText` |
| Test sentences | Both 반말 and 존댓말 Korean sentences |
| Status | ✅ **PASS** (5/5) |
| Result | Latency 1110-1602ms. Works but significantly slower than Google. |

---

## Phase 3: Server — Full Pipeline (ASR + Translation over WebSocket)

Test the WebSocket gateway end-to-end with real provider combinations.

### 3a. Happy Path — Hybrid Mode

| Item | Detail |
|------|--------|
| What to test | `session.start` → send audio → receive `transcription.interim` → `transcription.final` → `translation.interim` (NMT) → `translation.final` (TLLM) |
| Success criteria | All 4 message types received in correct order, sentence indexing correct |
| Status | ✅ **PASS** |
| Result | 8 interims, 8 interim translations, 1 final transcription, 1 final translation. "나 오늘 너무 피곤해." → "I'm so tired today." sentenceIndex correctly set on finals. |

### 3b. Happy Path — Final-Only Mode

| Item | Detail |
|------|--------|
| What to test | `session.start` with `mode: 'final-only'` → send audio → receive `transcription.interim` → `transcription.final` → `translation.final` only |
| Success criteria | NO `translation.interim` messages received |
| Status | ✅ **PASS** |
| Result | 9 transcription interims, 0 translation interims (correct), 1 final transcription, 1 final translation. "저는 오늘 너무 피곤합니다." → "I'm so tired today." |

### 3c. Session Update Mid-Stream

| Item | Detail |
|------|--------|
| What to test | Start in hybrid mode → send `session.update` to switch to final-only → verify behavior changes |
| Success criteria | Mode switch takes effect on next sentence |
| Status | ⬜ Deferred — requires multi-sentence audio fixture |

### 3d. Error Handling

| Item | Detail |
|------|--------|
| What to test | Audio before session.start → error propagation to client |
| Success criteria | Client receives `error` message with code `NO_SESSION` |
| Status | ✅ **PASS** |
| Result | Received error with code `NO_SESSION` and message "Send session.start before audio" |

### 3e. Connection Lifecycle

| Item | Detail |
|------|--------|
| What to test | WS connect → `session.start` → `session.end` → close |
| Success criteria | Clean connect/disconnect cycle, `session.status: connected` received |
| Status | ✅ **PASS** |
| Result | Clean lifecycle: connected → session.end → close. No errors, no leaked resources. |

---

## Phase 4: SDK

Test the SDK's transport and audio layers. Requires server from Phase 3 to be validated.

### 4a. WebSocket Client

| Item | Detail |
|------|--------|
| What to test | Connection to server, auto-reconnect (exponential backoff, max 10 attempts), heartbeat (30s), message serialization/deserialization |
| Success criteria | Connects, receives messages, reconnects on drop |
| Status | ⬜ Deferred — requires browser WebSocket mocking or Playwright |
| Notes | Protocol serialization/parsing tested via unit tests (see 4f) |

### 4b. Audio Capture & Resampling

| Item | Detail |
|------|--------|
| What to test | `getUserMedia` integration, AudioWorklet processor, resampling to 16kHz, float32→PCM16, 20ms frame buffering (320 samples) |
| Success criteria | Audio frames are correct format/size, resampling produces valid PCM16 |
| Status | ✅ **PASS** (resampler unit tests) |
| Result | 9/9 tests pass: downsample 48kHz→16kHz, 44.1kHz→16kHz, float32→PCM16 with correct clamping, identity passthrough. AudioCapture/AudioWorklet require browser — deferred. |

### 4c. Event Callbacks

| Item | Detail |
|------|--------|
| What to test | All SDK callbacks fire correctly: `onTranscriptionInterim`, `onTranscriptionFinal`, `onTranslationInterim`, `onTranslationFinal`, `onStatusChange`, `onError` |
| Success criteria | Each event type triggers correct callback with correct data shape |
| Status | ✅ **PASS** (EventEmitter unit tests) |
| Result | 6/6 tests pass: emit/on/off, multiple listeners, removeAll, error swallowing in callbacks |

### 4d. Full SDK Lifecycle

| Item | Detail |
|------|--------|
| What to test | `TranslateSDK.init()` → `start()` → recording + receiving messages → `stop()` → `destroy()` |
| Success criteria | Clean lifecycle, no resource leaks, state transitions correct |
| Status | ⬜ Deferred — requires browser environment (getUserMedia, AudioContext) |

### 4e. Reconnection Under Load

| Item | Detail |
|------|--------|
| What to test | Drop WebSocket mid-stream → verify auto-reconnect → verify audio buffering during reconnect → verify session resumes |
| Success criteria | Reconnects within backoff window, buffered audio sent after reconnect |
| Status | ⬜ Deferred — requires browser WebSocket and controlled network conditions |

### 4f. Unit Tests (pure logic modules)

| Item | Detail |
|------|--------|
| What to test | EventEmitter, SessionState, protocol serialization/parsing, resampler math |
| Success criteria | All unit tests pass, typecheck clean, build succeeds |
| Status | ✅ **PASS** (32/32 tests, typecheck ✅, build ✅) |
| Result | `sdk/tests/`: emitter.test.ts (6), session-state.test.ts (8), protocol.test.ts (9), resampler.test.ts (9). SDK builds to UMD+ESM bundles. |

---

## Phase 5: Frontend

Test React app integration with SDK. Requires SDK from Phase 4 to be validated.

### 5a. useTranslator Hook

| Item | Detail |
|------|--------|
| What to test | SDK initialization via hook, event→Zustand store wiring, cleanup on unmount |
| Success criteria | Store updates correctly for all SDK events |
| Status | ⬜ Deferred — requires @testing-library/react or Playwright |

### 5b. Zustand Store

| Item | Detail |
|------|--------|
| What to test | State mutations: `addSentence`, `setInterimSource`, `setInterimTranslation`, `setTranslation`, `setConnectionStatus`, `setError` |
| Success criteria | All mutations produce correct state shape |
| Status | ✅ **PASS** (11/11 tests) |
| Result | `frontend/tests/useTranslatorStore.test.ts`: default state, setRecording, setConnectionStatus, setShowTranscription, addSentence (clears interims), setTranslation (valid + invalid index), setInterimSource, setInterimTranslation, setError, reset. Typecheck ✅, build ✅. |

### 5c. Component Rendering

| Item | Detail |
|------|--------|
| What to test | `SentenceRow` displays source + translation, `StatusBar` reflects connection state, `RecordButton` toggles recording, `AudioVisualizer` animates on input |
| Success criteria | Visual output matches state |
| Status | ⬜ Deferred — requires @testing-library/react or Playwright |

### 5d. Full User Flow

| Item | Detail |
|------|--------|
| What to test | Open app → navigate to Translate → click record → speak Korean → see live transcription → see interim translation → see final translation → stop recording |
| Success criteria | End-to-end flow works in browser with real audio |
| Status | ⬜ Deferred — requires Playwright with mic mocking |

---

## Test Sentences (Korean)

Standard test pairs for translation validation:

| # | Korean (반말) | Korean (존댓말) | Expected English (gist) |
|---|--------------|----------------|------------------------|
| 1 | 나 오늘 너무 피곤해 | 저는 오늘 너무 피곤합니다 | I'm so tired today |
| 2 | 이거 어떻게 하는 거야? | 이것은 어떻게 하는 건가요? | How do you do this? |
| 3 | 밥 먹었어? | 식사하셨습니까? | Have you eaten? |
| 4 | 내일 같이 갈래? | 내일 함께 가시겠습니까? | Do you want to go together tomorrow? |
| 5 | 그거 진짜 대박이다 | 그것은 정말 대단합니다 | That's really amazing |
