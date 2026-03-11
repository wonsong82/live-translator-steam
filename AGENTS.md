# AGENTS.md — Agent Guidelines & Project Conventions
## Korean ↔ English Real-Time Translation Service

**Version**: 1.0  
**Last Updated**: 2026-02-21  
**Purpose**: This document defines the rules, conventions, and standards that ALL agents (AI developers, human developers, CI pipelines) must follow when working on this project. Read this document FIRST before making any changes.

---

## 1. Golden Rules

These rules are non-negotiable. Violating any of them requires explicit approval from the project owner.

### 1.1 Always Update Documentation

**Every code change MUST be accompanied by documentation updates. all documentations under /docs folder**

| What Changed | Update Required |
|-------------|----------------|
| New feature / module | TRD.md (implementation details) + TKD.md (if new concepts introduced) |
| Bug fix affecting architecture | TRD.md (affected section) |
| New convention or standard | AGENTS.md (this document) |
| Provider API change | TKD.md (provider section) + TRD.md (adapter implementation) |
| New dependency | TRD.md (technology stack) + relevant Dockerfile |
| Configuration change | TRD.md + `.env.example` |

If you're unsure whether a doc update is needed, **update it**. Stale docs are worse than no docs.

### 1.2 Always Commit

**Commit after every meaningful change.** Do not batch unrelated changes into a single commit.

```bash
# Commit message format
<type>(<scope>): <description>

# Types
feat:     New feature
fix:      Bug fix
refactor: Code restructuring (no behavior change)
docs:     Documentation only
test:     Adding or fixing tests
chore:    Build, CI, dependency updates
perf:     Performance improvement

# Scopes
sdk:      Injectable JS SDK
server:   Translation server
qwen3-asr: Qwen3-ASR engine
frontend: Frontend app
asr:      ASR provider adapters
translate: Translation engines
infra:    Docker, CI/CD, deployment
docs:     TRD, TKD, AGENTS

# Examples
feat(asr): add Deepgram Nova-3 streaming adapter
fix(sdk): handle WebSocket reconnection during active recording
docs(tkd): add Qwen3-ASR streaming architecture explanation
refactor(server): extract session manager into separate module
test(asr): add Google STT adapter integration tests
```

**Commit frequency**: After completing each logical unit of work. A "logical unit" is the smallest change that leaves the codebase in a working state.

### 1.3 Docker-First Development

**All development, testing, and running happens inside Docker containers.** Never install dependencies or run services directly on the host machine.

```bash
# Starting development environment
docker compose up -d

# Running tests
docker compose exec server npm test
docker compose exec sdk npm test

# Adding a dependency
docker compose exec server npm install <package>
# Then rebuild: docker compose build server

# Viewing logs
docker compose logs -f server

# Never do this:
# npm install  ← NO, use docker compose exec
# python server.py  ← NO, use docker compose up
```

**Why Docker-first?**
- Reproducible environments across all developers and agents
- Qwen3-ASR requires GPU passthrough — Docker handles this
- Multi-service architecture needs orchestration
- Production parity from day one

---

## 2. Architecture Principles

### 2.1 Provider Agnosticism

The server MUST NOT contain provider-specific logic outside of adapter classes. The flow is:

```
Audio in → Universal format → Provider Adapter → Provider-specific format
Provider response → Provider Adapter → Universal format → Client
```

**Test**: If you remove a provider adapter file, the server should still compile and run (just without that provider). If removing a provider breaks compilation elsewhere, you have a coupling violation.

### 2.2 Interface-First Development

When adding a new provider or engine:

1. Define or extend the interface FIRST (`IASRProvider`, `ITranslationEngine`)
2. Write tests against the interface
3. Implement the adapter
4. Register in the router/factory

Never add provider-specific types to shared interfaces. Provider-specific data goes in the `metadata` field.

### 2.3 Separation of Concerns

```
SDK:     Audio capture, WebSocket transport, event callbacks to host app
         ↕ (WebSocket with defined protocol)
Server:  Session management, provider routing, translation orchestration
         ↕ (Provider-specific protocols)
Providers: ASR transcription, translation
Frontend: UI rendering (uses SDK callbacks to display transcript + translation)
```

The SDK knows nothing about ASR providers or UI rendering. The server knows nothing about rendering. Providers know nothing about sessions or clients. The frontend app (or any consuming app) owns all UI rendering.

---

## 3. Code Standards

### 3.1 Language & Runtime

| Component | Language | Runtime | Rationale |
|-----------|---------|---------|-----------|
| SDK | TypeScript | Browser | Type safety for public API, UMD bundle for universal compatibility |
| Server | TypeScript (Node.js) | Node.js 20+ | Consistent language with SDK, strong WS support, Google/Deepgram SDK availability |
| Qwen3-ASR Engine | Python 3.11+ | Python | vLLM + qwen-asr package |
| Frontend | TypeScript + React | Vite | Modern, fast, type-safe |

### 3.2 TypeScript Rules

```typescript
// ALWAYS use strict TypeScript
// tsconfig.json: "strict": true

// ALWAYS type function parameters and return types
function processAudio(chunk: Buffer): TranscriptResult { ... }

// NEVER use `any` — use `unknown` and narrow
// ❌ function handle(data: any) { ... }
// ✅ function handle(data: unknown) { ... }

// ALWAYS use interfaces for contracts between modules
interface IASRProvider { ... }

// Use type aliases for unions and utility types
type ConnectionState = 'disconnected' | 'connecting' | 'connected';

// ALWAYS use readonly for immutable data
interface TranscriptResult {
  readonly text: string;
  readonly isFinal: boolean;
  readonly confidence: number;
}
```

### 3.3 Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | kebab-case | `ws-client.ts`, `google-adapter.ts` |
| Interfaces | PascalCase, prefix with I for contracts | `IASRProvider`, `ITranslationEngine` |
| Classes | PascalCase | `GoogleAdapter`, `SessionManager` |
| Functions | camelCase | `sendAudio()`, `processTranscript()` |
| Constants | UPPER_SNAKE_CASE | `MAX_RECONNECT_ATTEMPTS`, `DEFAULT_SAMPLE_RATE` |
| Environment variables | UPPER_SNAKE_CASE | `DEEPGRAM_API_KEY`, `REDIS_URL` |
| Type aliases | PascalCase | `ConnectionState`, `ProviderType` |
| Test files | `<module>.test.ts` | `google-adapter.test.ts` |

### 3.4 Error Handling

```typescript
// ALWAYS use typed error classes, never throw raw strings
class ASRError extends Error {
  constructor(
    message: string,
    public readonly code: ASRErrorCode,
    public readonly provider: string,
    public readonly recoverable: boolean,
  ) {
    super(message);
    this.name = 'ASRError';
  }
}

// ALWAYS handle errors at the boundary, propagate typed errors internally
// SDK boundary: display user-friendly message
// Server boundary: log details, send error code to client
// Provider boundary: map provider errors to ASRError

// NEVER swallow errors silently
// ❌ try { ... } catch (e) { /* ignore */ }
// ✅ try { ... } catch (e) { logger.error('Context', e); throw new ASRError(...); }
```

### 3.5 Logging

```typescript
// Use structured logging (JSON format in production)
// Log levels: error, warn, info, debug

// ALWAYS include context
logger.info('ASR connection established', { 
  provider: 'deepgram', 
  sessionId: session.id,
  model: 'nova-3' 
});

// ALWAYS log at provider boundaries
logger.debug('Sending audio chunk', { size: chunk.length, provider: 'google' });
logger.info('Transcript received', { isFinal: true, text: '안녕하세요', confidence: 0.95 });

// NEVER log sensitive data
// ❌ logger.info('API key', { key: apiKey });
// ✅ logger.info('Provider configured', { provider: 'deepgram', keyPrefix: apiKey.slice(0, 8) });
```

---

## 4. Testing Standards

### 4.1 Test Structure

```
tests/
├── unit/          # Fast, no external dependencies, mocked I/O
├── integration/   # Tests module boundaries, uses test containers
└── e2e/           # Full pipeline tests with real/mock providers
```

### 4.2 Test Rules

1. **Every adapter must have unit tests** with mocked provider responses
2. **Every interface method must be tested** against the interface contract
3. **Use factory pattern for test data** — never hardcode Korean text strings inline
4. **Integration tests run in Docker** — never depend on local installations
5. **Test both interim and final paths** — these have different behavior
6. **Test reconnection scenarios** — connection drops are common in real-time audio

### 4.3 Test Data

Maintain a corpus of Korean test audio and expected transcriptions:

```
scripts/benchmark/
├── korean-test-audio/
│   ├── conversational-01.wav    # Casual conversation with fillers
│   ├── formal-01.wav            # Business Korean (존댓말)
│   ├── fast-speech-01.wav       # Rapid Korean with elisions
│   ├── noisy-01.wav             # Background noise
│   └── expected/
│       ├── conversational-01.txt
│       ├── formal-01.txt
│       └── ...
└── evaluate.py                  # CER calculation script
```

---

## 5. Git Workflow

### 5.1 Branch Strategy

```
main              ← production-ready, all tests pass
├── develop       ← integration branch, features merge here
├── feat/*        ← feature branches
├── fix/*         ← bug fix branches
└── docs/*        ← documentation-only branches
```

### 5.2 Branch Rules

- Never push directly to `main` or `develop`
- All changes via pull requests
- Feature branches branch from `develop`, merge back to `develop`
- `develop` merges to `main` for releases
- Delete branches after merge

### 5.3 Pre-Commit Checklist

Before committing, verify:

- [ ] Code compiles with no TypeScript errors (`tsc --noEmit`)
- [ ] Linter passes (`eslint .`)
- [ ] Relevant unit tests pass
- [ ] Documentation updated (TRD/TKD/AGENTS if applicable)
- [ ] `.env.example` updated if new env vars added
- [ ] Docker build succeeds (`docker compose build`)
- [ ] Commit message follows convention (see 1.2)

---

## 6. Configuration Management

### 6.1 Environment Variables

**All configuration via environment variables.** No hardcoded values for anything that might change between environments.

```bash
# .env.example — ALWAYS keep this in sync with actual env vars used

# Server
PORT=8080
NODE_ENV=development
LOG_LEVEL=debug

# ASR Provider (server-managed, not client-controlled)
ASR_PROVIDER=deepgram                    # google | deepgram | openai | qwen-local
ASR_MODEL=nova-3                         # provider-specific model name

# ASR Provider Credentials
GOOGLE_APPLICATION_CREDENTIALS=/secrets/google-creds.json
DEEPGRAM_API_KEY=
OPENAI_API_KEY=

# Translation (providers server-managed, mode from SDK per session)
TRANSLATION_INTERIM_PROVIDER=google      # google | claude | openai | qwen-local
TRANSLATION_INTERIM_MODEL=nmt            # google: nmt|tllm, claude/openai: model id
TRANSLATION_FINAL_PROVIDER=google        # google | claude | openai | qwen-local
TRANSLATION_FINAL_MODEL=tllm             # google: nmt|tllm, claude/openai: model id
CLAUDE_API_KEY=
GOOGLE_TRANSLATION_PROJECT_ID=

# Qwen3-ASR
QWEN3_ASR_ENABLED=false
QWEN3_ASR_HOST=qwen3-asr
QWEN3_ASR_PORT=8001

# Infrastructure
REDIS_URL=redis://redis:6379
DATABASE_URL=postgresql://user:pass@db:5432/translate

# SDK / Frontend
VITE_WS_URL=ws://localhost:8080/ws
```

### 6.2 Secrets

- **Never commit secrets** to git. Use `.env` (gitignored) or secret managers.
- **Google credentials**: Mount as volume in Docker, reference via `GOOGLE_APPLICATION_CREDENTIALS`
- **API keys**: Environment variables, never in code
- **Client-facing keys**: Always use scoped/ephemeral tokens, never expose raw provider API keys

---

## 7. Docker Standards

### 7.1 Dockerfile Rules

```dockerfile
# ALWAYS use specific version tags, never :latest
FROM node:20-alpine

# ALWAYS use multi-stage builds for production images
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/index.js"]

# ALWAYS add healthcheck
HEALTHCHECK --interval=30s --timeout=5s \
  CMD curl -f http://localhost:8080/health || exit 1
```

### 7.2 Docker Compose Rules

- Every service has a healthcheck
- Dependencies declared with `depends_on` + `condition: service_healthy`
- Volumes for persistent data only (database)
- No host networking — use Docker networks
- GPU passthrough only for Qwen3-ASR container

---

## 8. Performance Monitoring

### 8.1 Metrics to Track

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| WS connection time | < 200ms | > 500ms |
| Audio-to-interim latency | < 500ms | > 1000ms |
| Audio-to-final latency | < 2s | > 3s |
| NMT translation latency | < 200ms | > 500ms |
| LLM translation latency | < 800ms | > 2000ms |
| Memory per session | < 50MB | > 100MB |
| Active sessions per instance | ≥ 100 | > 80% capacity |

### 8.2 Logging for Latency Tracking

Every message through the pipeline gets a timestamp chain:

```typescript
{
  audioTimestamp: 1708500000000,    // when audio was recorded
  serverReceived: 1708500000050,   // when server got the audio
  providerSent: 1708500000055,     // when sent to ASR provider
  providerReceived: 1708500000400, // when result came back
  translationSent: 1708500000405,  // when sent to translator
  translationReceived: 1708500000650, // when translation came back
  clientSent: 1708500000655,       // when sent to client WS
}
```

---

## 9. Adding a New ASR Provider

Step-by-step checklist for agents adding a new ASR provider:

1. **Research**: Document the provider's streaming API in TKD.md
2. **Interface**: Verify `IASRProvider` interface covers the provider's capabilities. Extend interface ONLY if the new capability is universal (not provider-specific).
3. **Adapter**: Create `server/src/asr/<provider>.ts` implementing `IASRProvider`
4. **Config**: Add provider config schema to `server/src/config/providers.ts`
5. **Router**: Register in `server/src/asr/router.ts` factory
6. **Environment**: Add required env vars to `.env.example`
7. **Docker**: Update `docker-compose.yml` if new service needed
8. **Tests**: Unit tests with mocked responses + integration test with real API
9. **Benchmark**: Run Korean test audio through provider, record CER in TKD.md
10. **Docs**: Update TRD.md (adapter implementation) + TKD.md (provider deep dive)
11. **Commit**: `feat(asr): add <provider> streaming adapter`

---

## 10. Adding a New Translation Engine

Step-by-step checklist:

1. **Research**: Document the engine's API, latency, cost in TKD.md
2. **Interface**: Verify `ITranslationEngine` interface is sufficient
3. **Engine**: Create `server/src/translation/<engine>.ts` implementing `ITranslationEngine`
4. **Config**: Add engine config
5. **Router**: Register in translation router
6. **Tests**: Test with Korean→English sentence pairs covering formality registers
7. **Benchmark**: Compare output quality against existing engines
8. **Docs**: Update TRD.md + TKD.md
9. **Commit**: `feat(translate): add <engine> translation engine`

---

## 11. SDK Release Checklist

When publishing a new version of the injectable SDK:

1. **Version bump**: Update `sdk/package.json` version following semver
2. **Bundle**: Build UMD bundle (`npm run build`)
3. **Size check**: Verify bundle < 15KB gzipped
4. **Browser test**: Test in Chrome, Firefox, Safari, Edge (mic capture + WS)
5. **Integration test**: Test with standalone frontend app via callbacks
6. **CDN deploy**: Upload to CDN
7. **Changelog**: Update CHANGELOG.md
8. **Tag**: Git tag `sdk-v<version>`
9. **Docs**: Update integration examples if public API changed

---

## 12. Known Gotchas & Pitfalls

### 12.1 Korean-Specific

- **Never translate interim results in final-only mode** — incomplete Korean produces garbage English
- **Korean spacing is inconsistent** — don't rely on space-based word splitting for anything
- **Sentence-ending particles are critical** — if ASR cuts them off, meaning changes entirely
- **반말/존댓말 distinction** — LLM prompts must instruct preservation of formality register

### 12.2 WebSocket

- **Browser WS has no header support** — can't send auth headers on connection. Use query params or first-message auth.
- **WS connections timeout** — send pings every 30s. Without keepalive, load balancers/proxies will kill idle connections.
- **Binary vs text frames** — audio is BINARY, control messages are TEXT. Don't mix.

### 12.3 Audio

- **getUserMedia permission** — must be triggered by user gesture (click). Cannot auto-start mic on page load.
- **Sample rate varies by device** — always check `AudioContext.sampleRate` and resample to 16kHz
- **Mobile browsers** — iOS Safari requires AudioContext resume on user interaction
- **Echo cancellation** — enable `echoCancellation: true` in getUserMedia constraints if speaker output might feed back

### 12.4 gRPC (Google)

- **Streaming sessions timeout** — Google STT streaming has a 5-minute limit per stream. Must reconnect and start new stream for longer sessions.
- **Credentials file** — must be a service account JSON, not a user credential
- **Billing** — 15-second increments. A 1-second utterance costs as much as a 15-second one.

---

## 13. Decision Log

Record significant architectural decisions here. When a decision is made, add an entry.

| Date | Decision | Rationale | Alternatives Considered |
|------|----------|-----------|------------------------|
| 2026-02-21 | Use streaming ASR, not chunked | Korean SOV requires progressive refinement; static chunking destroys sentence boundaries | Fixed-window chunking with VAD |
| 2026-02-21 | Support 4 ASR providers | Different cost/quality trade-offs; provider agnosticism reduces vendor lock-in | Single provider (Google) |
| 2026-02-21 | Hybrid translation (NMT interim + LLM final) | Balances speed and quality; users see instant feedback while waiting for accurate translation | LLM-only (too slow for interim), NMT-only (quality too low for final) |
| 2026-02-21 | Provider is server-managed, mode is client-controlled | Provider is an implementation detail the SDK shouldn't know. Mode (hybrid/final-only) is a UX decision the consuming app should control. Server→client messages never expose provider or engine names. | Both server-managed (limits app flexibility), both client-managed (leaks provider details) |
| 2026-02-21 | Injectable JS SDK — headless, no UI | SDK is a pure transport/capture layer. Consuming apps own their UI via event callbacks. Keeps SDK small (<15KB), avoids style conflicts, gives app developers full control. | SDK with built-in shadow DOM UI (adds weight, limits customization, style conflict risk) |
| 2026-02-21 | Server-side provider routing | Keeps API keys secure, enables provider switching without client changes, allows server-side session persistence | Direct-to-provider from browser (exposes keys, limits Google gRPC) |
| 2026-02-21 | CER over WER for Korean benchmarks | Korean spacing ambiguity makes WER unreliable; CER is the standard for CJK evaluation | WER with normalized spacing |
| 2026-02-21 | Docker-first development | Qwen3-ASR requires GPU passthrough, multi-service orchestration needed, production parity from day one | Local development with virtual environments |
| 2026-03-11 | In-memory room broadcast via Session.onSend() listener | Single EC2 instance, 20-200 viewers per room — no Redis needed. Session.onSend() hook keeps Session room-unaware while enabling broadcast. JSON.stringify once + ws.send() × N with per-viewer try/catch prevents slow clients blocking the loop. Room destroyed immediately on presenter disconnect. | Redis pub/sub (overkill for single instance), WebSocket fan-out via server-sent events (more complex), direct Session modification (coupling violation) |

---

## 14. Updating This Document

When should AGENTS.md be updated?

- New convention or standard established → add to relevant section
- New pitfall discovered → add to section 12
- Architectural decision made → add to section 13
- New provider/engine addition process refined → update sections 9/10
- Team workflow changes → update section 5

**Format**: Keep entries concise. Use tables for structured data. Use code blocks for concrete examples. Avoid prose paragraphs — this is a reference document, not a narrative.
