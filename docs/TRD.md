# TRD — Technical Requirements Document
## Korean ↔ English Real-Time Translation Service

**Version**: 1.0  
**Last Updated**: 2026-02-21  
**Status**: Phase 1 — MVP

---

## 1. Product Overview

A real-time translation platform consisting of:

1. **Injectable JS SDK** (`translate-sdk.js`) — a drop-in headless script that any web app can embed to get real-time Korean↔English translation. Handles mic capture, WebSocket connections, and data transmission. Provides event callbacks — the consuming app renders its own UI.
2. **Translation Server** — a backend service that receives audio from the SDK, routes it to configured ASR providers, receives transcriptions, sends them to translation engines, and returns results to the SDK.
3. **Frontend App** — a standalone web application demonstrating the full translation experience.

### Phase 1 Scope

- Korean → English translation direction
- 4 ASR providers: Google Cloud STT, Deepgram, OpenAI Realtime, Qwen3-ASR (self-hosted)
- Hybrid translation: NMT for interim, LLM for final
- Injectable JS SDK + standalone frontend app

---

## 2. System Architecture

### 2.1 High-Level Flow

```
┌─────────────────────────────────────────────────────────┐
│  Client (Browser)                                       │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Injectable JS SDK (translate-sdk.js)             │  │
│  │  ┌─────────┐  ┌──────────┐  ┌─────────────────┐  │  │
│  │  │ Mic     │→ │ Audio    │→ │ WebSocket       │  │  │
│  │  │ Capture │  │ Encoder  │  │ Client          │  │  │
│  │  └─────────┘  └──────────┘  └────────┬────────┘  │  │
│  │                                      │           │  │
│  │  ┌─────────────────────────────────┐ │           │  │
│  │  │ Event Emitter                   │ │           │  │
│  │  │ (callbacks to host app)         │←┘           │  │
│  │  └─────────────────────────────────┘             │  │
│  └───────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │ WebSocket (wss://)
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Translation Server                                     │
│  ┌──────────────┐  ┌─────────────────────────────────┐  │
│  │ WS Gateway   │→ │ Session Manager                 │  │
│  └──────────────┘  │ (per-connection state)           │  │
│                    └──────────┬──────────────────────┘  │
│                               │                         │
│  ┌────────────────────────────▼──────────────────────┐  │
│  │ ASR Provider Router                               │  │
│  │ ┌──────────┐ ┌──────────┐ ┌────────┐ ┌────────┐  │  │
│  │ │ Google   │ │ Deepgram │ │ OpenAI │ │Qwen3  │  │  │
│  │ │ Adapter  │ │ Adapter  │ │Adapter │ │Adapter │  │  │
│  │ └────┬─────┘ └────┬─────┘ └───┬────┘ └───┬────┘  │  │
│  └──────┼────────────┼───────────┼───────────┼───────┘  │
│         │            │           │           │          │
│         │ gRPC       │ WS        │ WS        │ local    │
│         ▼            ▼           ▼           ▼          │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Unified ASR Response (TranscriptResult)         │    │
│  └───────────────────────┬─────────────────────────┘    │
│                          │                              │
│  ┌───────────────────────▼─────────────────────────┐    │
│  │ Translation Router                              │    │
│  │ ┌──────────────────┐  ┌──────────────────────┐  │    │
│  │ │ NMT Engine       │  │ LLM Engine           │  │    │
│  │ │ (interim → fast) │  │ (final → quality)    │  │    │
│  │ └──────────────────┘  └──────────────────────┘  │    │
│  └───────────────────────┬─────────────────────────┘    │
│                          │                              │
│  ┌───────────────────────▼─────────────────────────┐    │
│  │ Unified Response → WS Gateway → Client          │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Component Breakdown

| Component | Technology | Responsibility |
|-----------|-----------|---------------|
| Injectable JS SDK | TypeScript, compiled to UMD bundle | Mic capture, WS connection, event callbacks |
| WS Gateway | Node.js (`ws` library) | Accept client connections, route to session manager |
| Session Manager | Server-side per-connection state | Track active sessions, provider config, audio buffers |
| ASR Provider Adapters | TypeScript classes implementing `IASRProvider` | Translate between universal format and provider-specific APIs |
| Translation Router | Server-side module | Route interim→NMT, final→LLM |
| Qwen3-ASR Engine | Python + vLLM | Self-hosted ASR inference |
| Frontend App | React + TypeScript | Standalone translation UI |

---

## 3. Injectable JS SDK (`translate-sdk.js`)

### 3.1 Integration API

The SDK is a **headless transport/capture library**. It handles microphone capture, WebSocket connections, and data transmission only. It does NOT render any UI — the consuming app is responsible for all UI rendering using the SDK's event callbacks.

```html
<!-- Drop-in integration -->
<script src="https://cdn.yourdomain.com/translate-sdk.min.js"></script>
<script>
  const translator = TranslateSDK.init({
    apiKey: 'client-api-key',
    sourceLanguage: 'ko',
    targetLanguage: 'en',
    mode: 'hybrid',           // 'hybrid' | 'final-only'

    // Event callbacks — app developer uses these to build their own UI
    onTranscriptionInterim: (data) => {},   // interim transcription received
    onTranscriptionFinal: (data) => {},     // final transcription received
    onTranslationInterim: (data) => {},     // interim translation received (hybrid mode)
    onTranslationFinal: (data) => {},       // final translation received
    onStatusChange: (status) => {},         // connection status changed
    onError: (err) => {},                   // error occurred
  });

  // Lifecycle methods
  translator.start();    // begin recording + streaming
  translator.stop();     // stop recording, keep connection
  translator.destroy();  // full cleanup, close WS

  // Runtime configuration — changes take effect on next utterance
  translator.setSourceLanguage('ko');   // change source language
  translator.setTargetLanguage('en');   // change target language
  translator.setMode('final-only');     // change translation mode

  // State accessors
  translator.getStatus();        // 'disconnected' | 'connecting' | 'connected' | 'error'
  translator.isRecording();      // boolean
  translator.getTranscript();    // { finals: string[], currentInterim: string }
  translator.getTranslations();  // { [sentenceIndex]: string }
</script>
```

**React usage example (app developer's responsibility):**
```jsx
function TranslatePanel() {
  const [transcriptionInterim, setTranscriptionInterim] = useState('');
  const [transcriptionFinals, setTranscriptionFinals] = useState([]);
  const [translations, setTranslations] = useState({});

  useEffect(() => {
    const translator = TranslateSDK.init({
      apiKey: 'key',
      sourceLanguage: 'ko',
      targetLanguage: 'en',
      mode: 'hybrid',
      onTranscriptionInterim: (data) => setTranscriptionInterim(data.text),
      onTranscriptionFinal: (data) => {
        setTranscriptionFinals(prev => [...prev, data.text]);
        setTranscriptionInterim('');
      },
      onTranslationFinal: (data) => {
        setTranslations(prev => ({ ...prev, [data.sentenceIndex]: data.translatedText }));
      },
    });
    translator.start();
    return () => translator.destroy();
  }, []);

  return (
    <div>
      {transcriptionFinals.map((s, i) => (
        <div key={i}>
          <span>{s}</span> → <span>{translations[i] || '...'}</span>
        </div>
      ))}
      {transcriptionInterim && <div style={{ opacity: 0.5 }}>{transcriptionInterim}</div>}
    </div>
  );
}
```

### 3.2 SDK Internal Modules

**AudioCapture Module**
```
- Uses navigator.mediaDevices.getUserMedia({ audio: true })
- AudioContext with AudioWorklet for audio processing
- Output: PCM16, 16kHz, mono
- Frame size: 20ms chunks (640 bytes per frame at 16kHz/16-bit)
- Resampling: if mic sample rate != 16kHz, resample via AudioWorklet
```

**WebSocket Client Module**
```
- Server URL hardcoded in SDK build (e.g., wss://api.yourdomain.com/ws)
- Not configurable by consuming app — no endpoint leakage
- Sends: audio frames as binary, control messages as JSON
- Receives: JSON messages (interim, final, translation, error)
- Auto-reconnect with exponential backoff (1s, 2s, 4s, 8s, max 30s)
- Heartbeat/ping every 30s to keep connection alive
- Buffers audio frames during reconnection gap
```

**Event Emitter Module**
```
- Internal event bus for transcription (interim/final), translation (interim/final), status, error
- Callbacks registered via init():
    onTranscriptionInterim, onTranscriptionFinal,
    onTranslationInterim, onTranslationFinal,
    onStatusChange, onError
- State accessors (getTranscript, getTranslations, getStatus) read from internal state
- Internal state updated on every event — app developers can poll or use callbacks
```

### 3.3 Message Protocol (SDK ↔ Server)

**Client → Server Messages**

```typescript
// Session initialization
{
  type: 'session.start',
  config: {
    sourceLanguage: 'ko',
    targetLanguage: 'en',
    mode: 'hybrid',          // 'hybrid' | 'final-only' — client decides
    audioFormat: {
      encoding: 'pcm16',
      sampleRate: 16000,
      channels: 1,
    }
  }
}

// NOTE: provider is NOT sent by the SDK — managed server-side.
// mode IS sent by the SDK — the consuming app decides whether it wants
// interim translations (hybrid) or only final translations (final-only).

// Audio data (binary frame)
// Raw PCM16 bytes, no JSON wrapper — sent as binary WS message

// Runtime config update (sent when setSourceLanguage/setTargetLanguage/setMode called)
{
  type: 'session.update',
  config: {
    sourceLanguage?: 'ko',    // only include changed fields
    targetLanguage?: 'en',
    mode?: 'final-only',
  }
}

// Session end
{ type: 'session.end' }
```

**Server → Client Messages**

```typescript
// Interim transcription result
{
  type: 'transcription.interim',
  text: '안녕하세',
  language: 'ko',
  timestamp: 1708500000000,
  confidence: 0.72,
}

// Final transcription result
{
  type: 'transcription.final',
  text: '안녕하세요',
  language: 'ko',
  timestamp: 1708500000500,
  confidence: 0.95,
  sentenceIndex: 0,
}

// Translation result (interim — only sent in hybrid mode)
{
  type: 'translation.interim',
  sourceText: '안녕하세',
  translatedText: 'Hello',
  sentenceIndex: null,        // null for interim
}

// Translation result (final)
{
  type: 'translation.final',
  sourceText: '안녕하세요',
  translatedText: 'Hello.',
  sentenceIndex: 0,
}

// Error
{
  type: 'error',
  code: 'ASR_CONNECTION_FAILED',
  message: 'Failed to connect to transcription service',
}

// Session status
{
  type: 'session.status',
  status: 'connected' | 'reconnecting' | 'error',
}
```

---

## 4. Translation Server

### 4.1 Server-Side Configuration

Provider selection is **server-managed**. The SDK sends audio and receives results.

**Configuration hierarchy (highest priority first):**
1. Per-API-key config in database
2. Environment variables
3. Hardcoded defaults (Deepgram + hybrid mode)

**Client-controlled** (sent via SDK): `sourceLanguage`, `targetLanguage`, `mode`, `audioFormat`  
**Server-managed** (per-API-key or env): ASR provider, ASR model, translation NMT/LLM providers

```typescript
interface ServerProviderConfig {
  asrProvider: 'google' | 'deepgram' | 'openai' | 'qwen3-asr';
  asrModel?: string;

  translationInterimProvider: 'google-nmt' | 'google-tllm' | 'claude' | 'qwen-local';
  translationFinalProvider: 'google-nmt' | 'google-tllm' | 'claude' | 'qwen-local';
  translationInterimModel?: string;
  translationFinalModel?: string;
}
```

**Environment variables:**
```bash
ASR_PROVIDER=deepgram
ASR_MODEL=nova-3
TRANSLATION_INTERIM_PROVIDER=google-nmt
TRANSLATION_FINAL_PROVIDER=google-tllm
TRANSLATION_INTERIM_MODEL=
TRANSLATION_FINAL_MODEL=
QWEN_TRANSLATION_URL=http://localhost:8002/v1
QWEN_TRANSLATION_MODEL=Qwen/Qwen3-30B-A3B
```

### 4.2 Technology Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20+ (TypeScript) |
| WebSocket | `ws` library |
| Google STT | `@google-cloud/speech` (gRPC) |
| Deepgram | `@deepgram/sdk` |
| OpenAI | Raw WebSocket to Realtime API |
| Qwen3-ASR | Internal HTTP/WebSocket to vLLM server |
| Translation NMT | Google Cloud Translation API v3 (NMT) |
| Translation LLM | Google Cloud Translation API (Translation LLM) |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Containerization | Docker + Docker Compose |

### 4.2 ASR Provider Interface

All providers implement this interface:

```typescript
interface TranscriptResult {
  text: string;
  isFinal: boolean;
  confidence: number;
  language: string;
  timestamp: number;
  // Provider-specific metadata (optional)
  metadata?: Record<string, any>;
}

interface ASRProviderConfig {
  provider: 'google' | 'deepgram' | 'openai' | 'qwen3-asr';
  apiKey?: string;
  region?: string;
  model?: string;
  language: string;
  // Provider-specific options
  options?: Record<string, any>;
}

interface IASRProvider {
  // Lifecycle
  connect(config: ASRProviderConfig): Promise<void>;
  disconnect(): Promise<void>;

  // Audio input
  sendAudio(audioChunk: Buffer): void;

  // Event handlers
  onTranscript(callback: (result: TranscriptResult) => void): void;
  onError(callback: (error: ASRError) => void): void;
  onConnectionStateChange(callback: (state: ConnectionState) => void): void;

  // State
  getConnectionState(): ConnectionState;
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
```

### 4.3 Provider Adapter Implementations

**Google Cloud STT Adapter**

```
Connection: gRPC StreamingRecognize
Audio format mapping:
  PCM16/16kHz → config.encoding = LINEAR16, config.sampleRateHertz = 16000
Request mapping:
  audioChunk → StreamingRecognizeRequest { audio_content: chunk }
Response mapping:
  StreamingRecognizeResponse.results[0] →
    text: result.alternatives[0].transcript
    isFinal: result.is_final
    confidence: result.alternatives[0].confidence
Model: 'chirp_3' (or 'latest_long' for streaming)
Language code: 'ko-KR'
Features: interim_results = true
```

**Deepgram Adapter**

```
Connection: WebSocket to wss://api.deepgram.com/v1/listen
Query params: ?model=nova-3&language=ko&interim_results=true&punctuate=true
Audio format: raw PCM16 bytes sent directly over WS
Response mapping:
  message.channel.alternatives[0] →
    text: alternative.transcript
    isFinal: message.is_final
    confidence: alternative.confidence
```

**OpenAI Realtime Adapter**

```
Connection: WebSocket to wss://api.openai.com/v1/realtime?intent=transcription
Session config:
  {
    type: 'transcription_session.update',
    input_audio_format: 'pcm16',
    input_audio_transcription: { model: 'gpt-4o-transcribe' },
    turn_detection: { type: 'server_vad', threshold: 0.5, silence_duration_ms: 500 }
  }
Audio format: base64-encoded PCM16 in JSON wrapper
  { type: 'input_audio_buffer.append', audio: '<base64>' }
Response mapping:
  conversation.item.input_audio_transcription.delta →
    text: delta, isFinal: false
  conversation.item.input_audio_transcription.completed →
    text: transcript, isFinal: true
Auth: Ephemeral key via POST /v1/realtime/client_secrets
```

**Qwen3-ASR Adapter (Self-Hosted)**

```
Connection: Internal WebSocket to local Qwen3-ASR vLLM server
Model: Qwen/Qwen3-ASR-1.7B
Serving: vLLM with qwen-asr package
Audio format: PCM16 chunks (16kHz), 2-second chunk size
Response mapping:
  Streaming response → TranscriptResult
  Built-in endpointing via dynamic attention window
  Auto language detection (Korean auto-detected)
GPU requirement: ~4-6GB VRAM
```

### 4.4 Translation Interface

```typescript
type TranslationProviderType = 'google-nmt' | 'google-tllm' | 'claude' | 'qwen-local';

interface TranslationResult {
  sourceText: string;
  translatedText: string;
  engine: TranslationProviderType;
  latencyMs: number;
}

interface ITranslationEngine {
  translate(
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<TranslationResult>;
}
```

**Google NMT Engine (for interim)**
```
Provider: Google Cloud Translation API v3 (NMT model)
Endpoint: translateText()
Latency: ~100-200ms
Cost: $20 per million characters
```

**Google Translation LLM Engine (for final)**
```
Provider: Google Cloud Translation API (Translation LLM)
Latency: ~300-500ms
Cost: Higher than NMT
```

**Claude Engine (for interim or final)**
```
Provider: Anthropic Claude API
Latency: ~500-1000ms
Cost: Per-token pricing
```

**Qwen Local Engine (for interim or final)**
```
Provider: Self-hosted Qwen3-30B-A3B via vLLM / vLLM-Metal
API: OpenAI-compatible /v1/chat/completions
Latency: ~200-500ms (hardware dependent)
Cost: GPU/Mac hardware only, no per-request charge
```

### 4.5 Session Flow (Server-Side)

```
1. Client WS connects → Server creates Session
2. Client sends session.start → Server:
   a. Validates API key
   b. Resolves provider config (per-API-key override → env defaults)
   c. Stores client-requested mode (hybrid/final-only) in session
   d. Instantiates configured ASRProvider adapter
   e. Calls provider.connect()
   f. Sends session.status { status: 'connected' } to client

3. Client sends binary audio frames → Server:
   a. Receives raw PCM16 bytes
   b. Calls provider.sendAudio(chunk)

4. Provider sends interim result → Server:
    a. Maps to TranscriptResult { isFinal: false }
    b. Sends transcription.interim to client via WS
    c. IF client requested mode == 'hybrid':
       - Sends text to configured interim translation engine (async, non-blocking)
       - When interim engine returns, sends translation.interim to client

5. Provider sends final result → Server:
    a. Maps to TranscriptResult { isFinal: true }
    b. Stores in session transcript history
    c. Sends transcription.final to client via WS
    d. Sends text to configured final translation engine (async, non-blocking)
    e. When final engine returns, sends translation.final to client

6. Client sends session.end → Server:
   a. Calls provider.disconnect()
   b. Persists session data (transcript, translations)
   c. Closes WS connection
```

---

## 5. Qwen3-ASR Self-Hosted ASR Engine

### 5.1 Infrastructure

```
Docker: vLLM official Docker image with qwen-asr package
GPU: NVIDIA GPU with ≥ 6GB VRAM (T4+, A10+, RTX 3080+)
Model: Qwen/Qwen3-ASR-1.7B
Serving: vLLM async server
Port: 8001
```

### 5.2 Qwen3-ASR Serving Architecture

```
┌─────────────────────────────────────┐
│ Qwen3-ASR Container (GPU)           │
│                                     │
│  vLLM Server (port 8001)            │
│  ├─ /ws/transcribe (WebSocket)      │
│  │   - Receives PCM16 audio chunks  │
│  │   - 2-second chunk size          │
│  │   - Returns streaming JSON       │
│  │                                  │
│  ├─ /health (HTTP GET)              │
│  │   - GPU status, model loaded     │
│  │                                  │
│  └─ Model: Qwen3-ASR-1.7B          │
│     - Auto language identification  │
│     - Streaming + offline unified   │
└─────────────────────────────────────┘
```

### 5.3 Running Qwen3-ASR

```bash
pip install qwen-asr
qwen-asr-demo-streaming \
  --asr-model-path Qwen/Qwen3-ASR-1.7B \
  --host 0.0.0.0 \
  --port 8001 \
  --gpu-memory-utilization 0.9
```

### 5.4 VRAM & Throughput

| Model | Parameters | VRAM | Throughput |
|-------|-----------|------|-----------|
| Qwen3-ASR-0.6B | 600M | ~2-4 GB | 2000x at concurrency 128 |
| **Qwen3-ASR-1.7B (default)** | **1.7B** | **~4-6 GB** | **High (vLLM optimized)** |

### 5.5 Mac Support (Apple Silicon)

Qwen3-ASR runs natively on Apple Silicon (M1/M2/M3/M4) via the `mlx-qwen3-asr` package:

- Runtime: MLX (Apple's native ML framework, uses Metal GPU)
- Model: mlx-community/Qwen3-ASR-1.7B-6bit (~2GB)
- Performance: RTF 0.08 on M4 Pro (~5x faster than realtime)
- Docker: Not supported (Docker Desktop cannot access Metal GPU)
- Setup: `scripts/run-mac-asr.sh` (creates venv, installs deps, starts server)
- Server: FastAPI WebSocket server (`qwen3-asr/src/server_mac.py`)
- Same WebSocket protocol as GPU version — transparent to the translation server

---

## 6. Frontend App

### 6.1 Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18+ with TypeScript |
| Build | Vite |
| Styling | Tailwind CSS |
| State | Zustand |
| SDK Integration | Imports translate-sdk.js |

### 6.2 Pages and Components

```
/                    → Landing page (start translation)
/translate           → Main translation view
/settings            → Provider config, API keys, preferences

Components:
├── TranslationPanel/
│   ├── SourcePanel       (Korean transcript: interim + final)
│   ├── TargetPanel       (English translation: interim + final)
│   └── SentenceRow       (aligned source + target pair)
├── Controls/
│   ├── RecordButton      (start/stop mic)
│   └── TranscriptionToggle (show/hide source transcription)
├── StatusBar/            (connection status)
└── AudioVisualizer/      (mic input level indicator)
```

### 6.3 Zustand Store

```typescript
interface TranslatorStore {
  // Session
  isRecording: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';

  // Display
  showTranscription: boolean;

  // Transcript
  sentences: Array<{
    sourceText: string;
    translation: string | null;
    timestamp: number;
  }>;

  // Current (in-progress)
  currentInterimSource: string;
  currentInterimTranslation: string;

  // Errors
  lastError: string | null;

  // Actions
  setRecording: (isRecording: boolean) => void;
  setConnectionStatus: (status: ConnectionState) => void;
  setShowTranscription: (show: boolean) => void;
  addSentence: (text: string, timestamp: number) => void;
  setTranslation: (index: number, translation: string) => void;
  setInterimSource: (text: string) => void;
  setInterimTranslation: (text: string) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}
```

---

## 7. Infrastructure & Deployment

### 7.1 Docker Compose (Development)

```yaml
services:
  server:
    build: ./server
    ports:
      - "8080:8080"
    environment:
      # ASR Provider (server-managed)
      - ASR_PROVIDER=deepgram
      - ASR_MODEL=nova-3
      # ASR Credentials
      - GOOGLE_APPLICATION_CREDENTIALS=/secrets/google-creds.json
      - DEEPGRAM_API_KEY=${DEEPGRAM_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      # Translation (server-managed providers, mode from SDK)
      - TRANSLATION_INTERIM_PROVIDER=google-nmt
      - TRANSLATION_FINAL_PROVIDER=google-tllm
      - TRANSLATION_INTERIM_MODEL=
      - TRANSLATION_FINAL_MODEL=
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
      - GOOGLE_TRANSLATION_PROJECT_ID=${GOOGLE_TRANSLATION_PROJECT_ID}
      - QWEN_TRANSLATION_URL=http://localhost:8002/v1
      - QWEN_TRANSLATION_MODEL=Qwen/Qwen3-30B-A3B
      # Infrastructure
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgresql://user:pass@db:5432/translate
    depends_on:
      - redis
      - db
    volumes:
      - ./secrets:/secrets:ro

  qwen3-asr:
    build: ./qwen3-asr
    ports:
      - "8001:8001"
    deploy:
      resources:
        reservations:
          devices:
            - capabilities: [gpu]
    # Only needed if Qwen3-ASR provider is enabled

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - VITE_WS_URL=ws://localhost:8080/ws

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=translate
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

### 7.2 Production Deployment

```
Cloud: GCP
Compute: Cloud Run (server) + GKE with GPU node pool (Qwen3-ASR)
CDN: Cloud CDN for SDK static files
SSL: Managed certificates for WSS
Monitoring: Cloud Monitoring + structured logging
```

---

## 8. Project Structure

```
translate-service/
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── docs/
│   ├── TRD.md                  # this document
│   ├── TKD.md                  # technical knowledge
│   └── AGENTS.md               # agent guidelines
│
├── sdk/                         # Injectable JS SDK
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── rollup.config.js         # UMD bundle output
│   ├── src/
│   │   ├── index.ts             # SDK entry point & public API
│   │   ├── audio/
│   │   │   ├── capture.ts       # Mic capture + PCM encoding
│   │   │   └── resampler.ts     # Sample rate conversion
│   │   ├── transport/
│   │   │   ├── ws-client.ts     # WebSocket connection manager
│   │   │   └── protocol.ts      # Message types & serialization
│   │   ├── state/
│   │   │   └── session-state.ts # Internal state (finals, interim, translations)
│   │   ├── events/
│   │   │   └── emitter.ts       # Event emitter for callbacks
│   │   └── types.ts             # Shared type definitions
│   └── tests/
│
├── server/                       # Translation Server
│   ├── Dockerfile
│   ├── package.json              # (if Node.js)
│   ├── requirements.txt          # (if Python)
│   ├── src/
│   │   ├── index.ts              # Server entry point
│   │   ├── ws/
│   │   │   ├── gateway.ts        # WS server, connection handling
│   │   │   └── session.ts        # Session state management
│   │   ├── asr/
│   │   │   ├── types.ts          # IASRProvider, TranscriptResult
│   │   │   ├── router.ts         # Provider factory/router
│   │   │   ├── google.ts         # Google Cloud STT adapter
│   │   │   ├── deepgram.ts       # Deepgram adapter
│   │   │   ├── openai.ts         # OpenAI Realtime adapter
│   │   │   └── qwen3-asr.ts      # Qwen3-ASR adapter
│   │   ├── translation/
│   │   │   ├── types.ts          # ITranslationEngine, TranslationResult
│   │   │   ├── router.ts         # Translation engine router
│   │   │   ├── nmt.ts            # Google NMT engine
│   │   │   ├── llm.ts            # LLM engine (Google Translation LLM / Claude)
│   │   │   └── qwen-local.ts     # Qwen local engine (OpenAI-compatible endpoint)
│   │   ├── storage/
│   │   │   ├── session-store.ts  # Session persistence
│   │   │   └── usage-tracker.ts  # API usage metering
│   │   └── config/
│   │       ├── index.ts          # Environment config loader
│   │       └── providers.ts      # Provider configuration schemas
│   └── tests/
│       ├── asr/
│       │   ├── google.test.ts
│       │   ├── deepgram.test.ts
│       │   ├── openai.test.ts
│       │   └── qwen3-asr.test.ts
│       └── translation/
│           ├── nmt.test.ts
│           └── llm.test.ts
│
├── qwen3-asr/                    # Qwen3-ASR self-hosted ASR engine
│   ├── Dockerfile.gpu
│   ├── requirements.txt
│   ├── requirements-mac.txt      # MLX dependencies for Mac
│   ├── src/
│   │   ├── server.py             # qwen-asr streaming server wrapper (GPU)
│   │   ├── server_mac.py         # MLX-based server for Mac
│   │   ├── config.py             # Model & server configuration
│   │   └── health.py             # Health check endpoint
│   └── models/                   # Model cache (gitignored)
│
├── frontend/                     # Standalone Frontend App
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Landing.tsx
│   │   │   ├── Translate.tsx
│   │   │   └── Settings.tsx
│   │   ├── components/
│   │   │   ├── TranslationPanel/
│   │   │   │   ├── SourcePanel.tsx
│   │   │   │   ├── TargetPanel.tsx
│   │   │   │   └── SentenceRow.tsx
│   │   │   ├── Controls/
│   │   │   │   ├── RecordButton.tsx
│   │   │   │   └── TranscriptionToggle.tsx
│   │   │   ├── StatusBar.tsx
│   │   │   └── AudioVisualizer.tsx
│   │   ├── hooks/
│   │   │   ├── useTranslator.ts   # wraps SDK
│   │   │   └── useAudioLevel.ts
│   │   ├── store/
│   │   │   └── useTranslatorStore.ts
│   │   └── types/
│   │       └── index.ts
│   └── tests/
│
└── scripts/
    ├── setup.sh                  # One-command dev environment setup
    ├── run-mac-asr.sh            # Start Qwen3-ASR on Mac via MLX
    ├── run-mac-translation.sh    # Start Qwen3 translation on Mac via vLLM-Metal
    ├── seed-db.sql               # Database schema + seed data
    └── benchmark/
        ├── korean-test-audio/    # Test audio files
        └── evaluate.py           # CER/WER evaluation script
```

---

## 9. API Keys & Authentication

### 9.1 Client → Server Auth

```
- SDK sends apiKey in session.start message
- Server validates against database/Redis
- Rate limiting per API key (requests/min, audio minutes/month)
```

### 9.2 Server → Provider Auth

```
- Google: Service account JSON credentials (GOOGLE_APPLICATION_CREDENTIALS)
- Deepgram: API key in WS URL header
- OpenAI: Ephemeral key generated via POST /v1/realtime/client_secrets
- Qwen3-ASR: Internal service, no external auth needed
```

---

## 10. Error Handling

| Scenario | Handling |
|----------|---------|
| ASR provider connection fails | Retry 3x with backoff → send error to client |
| ASR returns empty interim | Ignore, don't forward to client |
| Translation API fails | Return transcript without translation, retry translation async |
| Client WS disconnects | Keep ASR session alive for 10s grace period, then cleanup |
| Audio quality too poor | ASR returns low confidence → forward to client with confidence score, let UI decide |
| Qwen3-ASR GPU OOM | Container health check fails → restart container → notify via monitoring |

---

## 11. Performance Targets

| Metric | Target |
|--------|--------|
| SDK bundle size | < 15KB gzipped |
| Audio-to-interim latency | < 500ms (provider-dependent) |
| Audio-to-final latency | < 2s |
| Interim translation latency (NMT) | < 200ms from interim receipt |
| Final translation latency (LLM) | < 800ms from final receipt |
| Concurrent sessions per server instance | ≥ 100 |
| WebSocket reconnection time | < 3s |

---

## 12. Testing Strategy

| Type | Scope | Tools |
|------|-------|-------|
| Unit | Provider adapters, message serialization, audio encoding | Vitest |
| Integration | End-to-end session flow with mock provider | Docker Compose test profile |
| Provider | Real API calls to each ASR provider with test audio | Benchmark scripts |
| Korean accuracy | CER evaluation on curated Korean test audio set | evaluate.py script |
| Load | Concurrent WebSocket sessions | k6 |
| SDK | Browser integration, mic capture | Playwright |

---

## 13. Phase 1 Milestones

| # | Milestone | Deliverable |
|---|-----------|-------------|
| 1 | Project scaffolding | Docker Compose, project structure, CI pipeline |
| 2 | Server core | WS gateway, session manager, message protocol |
| 3 | Deepgram adapter | First working ASR provider (easiest to integrate) |
| 4 | Translation pipeline | NMT interim + LLM final working end-to-end |
| 5 | SDK core | Audio capture + WS client + basic UI renderer |
| 6 | End-to-end demo | Speak Korean → see English translation in browser |
| 7 | Google adapter | Second ASR provider with gRPC proxy |
| 8 | OpenAI adapter | Third ASR provider |
| 9 | Qwen3-ASR adapter | Fourth ASR provider (requires GPU) |
| 10 | Frontend app | Standalone React app with full UI |
| 11 | SDK polish | Shadow DOM, themes, documentation, npm publish |
| 12 | Testing & benchmarks | Korean CER evaluation across all providers |
