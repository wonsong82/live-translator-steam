# Korean ↔ English Real-Time Translation Service

Real-time speech translation. Speak Korean, see English instantly. Built with four interchangeable ASR providers and a hybrid translation pipeline.

---

## Table of Contents

- [How It Works](#how-it-works)
- [Quick Start](#quick-start)
- [Choosing Your Providers](#choosing-your-providers)
  - [ASR (Speech Recognition)](#asr-speech-recognition)
  - [Translation](#translation)
- [Getting API Keys & Credentials](#getting-api-keys--credentials)
  - [Deepgram](#deepgram)
  - [Google Cloud](#google-cloud)
  - [OpenAI](#openai)
  - [Anthropic (Claude)](#anthropic-claude)
- [Configuration Reference](#configuration-reference)
- [Running Local Models (Mac)](#running-local-models-mac)
- [Running the App](#running-the-app)

---

## How It Works

```
Your voice → Mic capture → ASR provider → Korean transcript → Translation → English
```

Two steps happen per sentence:
1. **Interim** - as you speak, a fast translation appears and updates in real time
2. **Final** - when you finish the sentence, a higher-quality translation replaces it

---

## Quick Start

**Requirements**: Docker Desktop installed and running.

```bash
# 1. Clone the repo
git clone <repo-url>
cd translate2

# 2. Create your config file
cp .env.example .env

# 3. Fill in your API keys (see sections below)
# edit .env

# 4. Add your Google credentials file (if using Google)
# cp ~/Downloads/your-key.json secrets/google-creds.json

# 5. Start everything
docker compose up -d

# 6. Open the app
open http://localhost:3000
```

---

## Choosing Your Providers

You need to choose:
- **One ASR provider** (does the speech-to-text)
- **Translation is automatic** - Google NMT handles interim, your chosen LLM handles final

### ASR (Speech Recognition)

Set `ASR_PROVIDER` in your `.env` to one of these:

| Provider | `.env` value | Best For | Requires |
|----------|-------------|----------|---------|
| **Deepgram** | `deepgram` | Fastest, easiest setup, great Korean accuracy | API key only |
| **Google Cloud STT** | `google` | High accuracy, enterprise-grade | Service account JSON file |
| **OpenAI** | `openai` | Good accuracy, familiar brand | API key only |
| **Qwen3-ASR** | `qwen3-asr` | Free, self-hosted, privacy-first | NVIDIA GPU (Linux) or Apple Silicon (Mac) |

> **Recommended for getting started**: Deepgram. Sign up in 2 minutes, free tier available, no JSON files.

#### Deepgram Models

Set `ASR_MODEL=nova-3` (default, works well for Korean):

| Model | Speed | Best For |
|-------|-------|----------|
| `nova-3` | ⚡ Fast | General conversation (default) |
| `nova-2` | ⚡ Fast | Alternative if nova-3 unavailable |

#### Google Cloud STT Models

Set `ASR_MODEL=latest_long` (default):

| Model | Speed | Best For |
|-------|-------|----------|
| `latest_long` | Medium | Long conversations, best Korean accuracy (default) |
| `latest_short` | ⚡ Fast | Short phrases, commands |
| `chirp_2` | Medium | Newest multilingual model |

#### OpenAI Realtime Models

Set `ASR_MODEL=gpt-4o-transcribe` (default):

| Model | Speed | Cost |
|-------|-------|------|
| `gpt-4o-transcribe` | Medium | Standard (default) |
| `gpt-4o-mini-transcribe` | ⚡ Fast | Cheaper, slightly lower accuracy |

---

### Translation

Translation is split into two stages. You configure each separately:

| Stage | When | Available Providers | `.env` key |
|-------|------|-------------------|-----------|
| **Interim** (fast) | While speaking | `google-nmt`, `google-tllm`, `claude`, `qwen-local` | `TRANSLATION_INTERIM_PROVIDER` |
| **Final** (quality) | After sentence | `google-nmt`, `google-tllm`, `claude`, `qwen-local` | `TRANSLATION_FINAL_PROVIDER` |

#### Final Translation: Google TLLM vs Claude

| | Google TLLM | Claude |
|--|-------------|--------|
| Speed | ~400ms | ~600ms |
| Quality | High | High, better cultural nuance |
| Cost | Pay per character | Pay per token |
| Setup | Included with Google credentials | Separate Anthropic API key |

To use Claude for final translations:
```bash
TRANSLATION_FINAL_PROVIDER=claude
CLAUDE_API_KEY=sk-ant-...
```

#### Claude Models

Set `TRANSLATION_FINAL_MODEL` when using Claude (leave blank for default):

| Model | Speed | Quality | Cost |
|-------|-------|---------|------|
| `claude-haiku-4-20250514` | ⚡ Fastest | Good | Lowest |
| `claude-sonnet-4-20250514` | Medium | Best balance (default) | Medium |
| `claude-opus-4-20250514` | Slow | Highest quality | Highest |

#### Local Translation: Qwen3-30B-A3B (Self-Hosted)

Run translations entirely on your own hardware. No API keys, no cloud dependency, no per-request cost.

| | Qwen3-30B-A3B |
|--|---------------|
| Parameters | 30B total, 3B active (MoE) |
| RAM (Mac) | ~8GB |
| Speed (M4 Max) | ~13 tokens/sec |
| License | Apache 2.0 |
| Korean quality | Very good, 100+ languages |

To use for both interim and final:
```bash
TRANSLATION_INTERIM_PROVIDER=qwen-local
TRANSLATION_FINAL_PROVIDER=qwen-local
QWEN_TRANSLATION_URL=http://localhost:8002/v1
QWEN_TRANSLATION_MODEL=Qwen/Qwen3-30B-A3B
```

See [Running Local Models](#running-local-models-mac) for setup.

---

## Getting API Keys & Credentials

### Deepgram

**Time needed: ~5 minutes. Free tier: 12,000 minutes/year.**

1. Go to [console.deepgram.com](https://console.deepgram.com)
2. Sign up for a free account
3. Click **API Keys** in the left sidebar
4. Click **Create a New API Key**
5. Give it a name (e.g. "translate-service") → click **Create Key**
6. Copy the key shown. You won't see it again
7. Add to `.env`:
   ```
   DEEPGRAM_API_KEY=your_key_here
   ASR_PROVIDER=deepgram
   ASR_MODEL=nova-3
   ```

---

### Google Cloud

**Time needed: ~15 minutes. Required for: Google STT (ASR) and/or Google Translation (NMT + TLLM).**

You only need this if you're using Google as your ASR provider, or for translation (NMT is always Google).

#### Step 1: Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click the project dropdown at the top → **New Project**
3. Enter a project name (e.g. `translate-service`) → **Create**
4. Wait ~30 seconds for it to be created, then select it
5. Note your **Project ID** (shown on the dashboard, e.g. `translate-service-123456`)

#### Step 2: Enable the APIs you need

Go to **APIs & Services → Library** and enable:

- If using Google for ASR: search `Cloud Speech-to-Text API` → Enable
- Required for translation: search `Cloud Translation API` → Enable

#### Step 3: Create a service account

1. Go to **IAM & Admin → Service Accounts**
2. Click **+ Create Service Account**
3. Name: `translate-server` → click **Create and Continue**
4. Assign roles based on what you're using:
   - For ASR (Google STT): add `Cloud Speech Client`
   - For translation: add `Cloud Translation API User`
5. Click **Done**

#### Step 4: Download the credentials file

1. Click on the service account you just created
2. Go to the **Keys** tab
3. Click **Add Key → Create new key**
4. Select **JSON** → click **Create**
5. A file downloads automatically. Rename it `google-creds.json`
6. Move it into the `secrets/` folder of this project:
   ```bash
   mv ~/Downloads/google-creds.json /path/to/translate2/secrets/google-creds.json
   ```

#### Step 5: Add to `.env`

```bash
GOOGLE_APPLICATION_CREDENTIALS=/secrets/google-creds.json
GOOGLE_TRANSLATION_PROJECT_ID=your-project-id-here
GOOGLE_TRANSLATION_LOCATION=us-central1
```

> The path `/secrets/google-creds.json` is the path inside the Docker container. Docker mounts your local `secrets/` folder there automatically. Don't change this path.

---

### OpenAI

**Time needed: ~3 minutes.**

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Click **+ Create new secret key**
3. Give it a name → **Create secret key**
4. Copy the key. You won't see it again
5. Add to `.env`:
   ```bash
   OPENAI_API_KEY=sk-...
   ASR_PROVIDER=openai
   ASR_MODEL=gpt-4o-transcribe
   ```

> Note: OpenAI Realtime API is pay-per-use. Check [openai.com/pricing](https://openai.com/pricing) for current rates.

---

### Anthropic (Claude)

**Time needed: ~3 minutes. Only needed if using Claude for final translations.**

1. Go to [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
2. Click **Create Key**
3. Give it a name → copy the key
4. Add to `.env`:
   ```bash
   CLAUDE_API_KEY=sk-ant-...
   TRANSLATION_LLM_PROVIDER=claude
   TRANSLATION_LLM_MODEL=claude-sonnet-4-20250514
   ```

---

## Configuration Reference

Full list of every setting in your `.env` file:

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Port the server listens on |
| `NODE_ENV` | `development` | `development` or `production` |
| `LOG_LEVEL` | `debug` | `error`, `warn`, `info`, or `debug` |

### ASR Provider

| Variable | Default | Description |
|----------|---------|-------------|
| `ASR_PROVIDER` | `deepgram` | Which provider handles speech recognition: `deepgram`, `google`, `openai`, `qwen3-asr` |
| `ASR_MODEL` | *(provider default)* | Model override. Leave blank to use the provider's default. |

### ASR Credentials

| Variable | Required For | Description |
|----------|-------------|-------------|
| `DEEPGRAM_API_KEY` | Deepgram ASR | Your Deepgram API key |
| `GOOGLE_APPLICATION_CREDENTIALS` | Google ASR + Translation | Path to your `google-creds.json` file (inside Docker: `/secrets/google-creds.json`) |
| `OPENAI_API_KEY` | OpenAI ASR | Your OpenAI API key |

### Translation

| Variable | Default | Description |
|----------|---------|-------------|
| `TRANSLATION_INTERIM_PROVIDER` | `google-nmt` | Fast translation while speaking. Options: `google-nmt`, `google-tllm`, `claude`, `qwen-local` |
| `TRANSLATION_FINAL_PROVIDER` | `google-tllm` | Quality translation after sentence ends. Options: `google-nmt`, `google-tllm`, `claude`, `qwen-local` |
| `TRANSLATION_INTERIM_MODEL` | *(provider default)* | Model override for interim translation engine. |
| `TRANSLATION_FINAL_MODEL` | *(provider default)* | Model override for final translation engine. |
| `GOOGLE_TRANSLATION_PROJECT_ID` | *(required)* | Your Google Cloud project ID |
| `GOOGLE_TRANSLATION_LOCATION` | `us-central1` | Google Cloud region. Use `us-central1` for TLLM, `global` is also OK for NMT. |
| `CLAUDE_API_KEY` | *(optional)* | Your Anthropic API key (required if using Claude for translation) |
| `QWEN_TRANSLATION_URL` | `http://localhost:8002/v1` | URL of local Qwen3 translation server |
| `QWEN_TRANSLATION_MODEL` | `Qwen/Qwen3-30B-A3B` | Model name for local Qwen3 translation |

### Qwen3-ASR (Self-Hosted)

| Variable | Default | Description |
|----------|---------|-------------|
| `QWEN3_ASR_ENABLED` | `false` | Set to `true` to enable the self-hosted ASR engine |
| `QWEN3_ASR_HOST` | `qwen3-asr` | Hostname of the Qwen3-ASR container |
| `QWEN3_ASR_PORT` | `8001` | Port of the Qwen3-ASR container |

### Infrastructure

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | `redis://redis:6379` | Redis connection string (no change needed for Docker Compose) |
| `DATABASE_URL` | `postgresql://user:pass@db:5432/translate` | Postgres connection string (no change needed for Docker Compose) |

### Frontend

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_WS_URL` | `ws://localhost:8080/ws` | WebSocket URL the browser connects to |

---

## Running Local Models (Mac)

Apple Silicon Macs (M1/M2/M3/M4) can run both ASR and translation models locally. No cloud APIs needed.

**Requirements**: macOS with Apple Silicon, Python 3.10+, ~16GB RAM recommended.

### Local ASR: Qwen3-ASR on Mac

Uses `mlx-qwen3-asr` (MLX backend, Metal GPU acceleration):

```bash
# Starts Qwen3-ASR on port 8001
./scripts/run-mac-asr.sh
```

First run creates a Python venv and downloads the model (~2GB). Set in `.env`:
```bash
ASR_PROVIDER=qwen3-asr
QWEN3_ASR_HOST=localhost
QWEN3_ASR_PORT=8001
```

Note: Runs natively (not in Docker) because Docker Desktop cannot access Metal GPU.

### Local Translation: Qwen3-30B-A3B

Uses vLLM-Metal (OpenAI-compatible API):

```bash
# Starts Qwen3 translation model on port 8002
./scripts/run-mac-translation.sh
```

First run creates a venv and downloads the model (~17GB). Set in `.env`:
```bash
TRANSLATION_INTERIM_PROVIDER=qwen-local
TRANSLATION_FINAL_PROVIDER=qwen-local
QWEN_TRANSLATION_URL=http://localhost:8002/v1
QWEN_TRANSLATION_MODEL=Qwen/Qwen3-30B-A3B
```

### Fully Local Setup (No Cloud)

Run everything on your Mac. Zero API keys needed:

```bash
# Terminal 1: Start ASR
./scripts/run-mac-asr.sh

# Terminal 2: Start translation model
./scripts/run-mac-translation.sh

# Terminal 3: Start server + frontend
docker compose up -d db redis server frontend

# Open http://localhost:3000
```

`.env` for fully local:
```bash
ASR_PROVIDER=qwen3-asr
QWEN3_ASR_HOST=host.docker.internal
QWEN3_ASR_PORT=8001
TRANSLATION_INTERIM_PROVIDER=qwen-local
TRANSLATION_FINAL_PROVIDER=qwen-local
QWEN_TRANSLATION_URL=http://host.docker.internal:8002/v1
```

`host.docker.internal` allows Docker containers to reach services running on the Mac host.

---

## Running the App

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f server

# Stop everything
docker compose down

# Rebuild after code changes
docker compose build && docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Minimum Config Examples

**Deepgram + Google Translation (recommended for getting started)**
```bash
ASR_PROVIDER=deepgram
DEEPGRAM_API_KEY=your_deepgram_key

TRANSLATION_INTERIM_PROVIDER=google-nmt
TRANSLATION_FINAL_PROVIDER=google-tllm
GOOGLE_APPLICATION_CREDENTIALS=/secrets/google-creds.json
GOOGLE_TRANSLATION_PROJECT_ID=your-project-id
```

**Deepgram + Claude Translation**
```bash
ASR_PROVIDER=deepgram
DEEPGRAM_API_KEY=your_deepgram_key

TRANSLATION_INTERIM_PROVIDER=google-nmt
TRANSLATION_FINAL_PROVIDER=claude
GOOGLE_APPLICATION_CREDENTIALS=/secrets/google-creds.json
GOOGLE_TRANSLATION_PROJECT_ID=your-project-id
CLAUDE_API_KEY=sk-ant-...
```

**All Google**
```bash
ASR_PROVIDER=google
TRANSLATION_INTERIM_PROVIDER=google-nmt
TRANSLATION_FINAL_PROVIDER=google-tllm
GOOGLE_APPLICATION_CREDENTIALS=/secrets/google-creds.json
GOOGLE_TRANSLATION_PROJECT_ID=your-project-id
```

**Fully Local (Mac, no API keys)**
```bash
ASR_PROVIDER=qwen3-asr
QWEN3_ASR_HOST=host.docker.internal
QWEN3_ASR_PORT=8001

TRANSLATION_INTERIM_PROVIDER=qwen-local
TRANSLATION_FINAL_PROVIDER=qwen-local
QWEN_TRANSLATION_URL=http://host.docker.internal:8002/v1
QWEN_TRANSLATION_MODEL=Qwen/Qwen3-30B-A3B
```
