#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$PROJECT_ROOT/.venv-translation"

if [[ "$(uname -m)" != "arm64" ]]; then
  echo "Error: This script requires Apple Silicon (M1/M2/M3/M4)."
  exit 1
fi

MODEL="${QWEN_TRANSLATION_MODEL:-Qwen/Qwen3-30B-A3B}"
HOST="${QWEN_TRANSLATION_HOST:-0.0.0.0}"
PORT="${QWEN_TRANSLATION_PORT:-8002}"

if [[ ! -d "$VENV_DIR" ]]; then
  echo "Creating Python virtual environment..."
  python3 -m venv "$VENV_DIR"
  source "$VENV_DIR/bin/activate"
  pip install --upgrade pip
  pip install vllm-metal
else
  source "$VENV_DIR/bin/activate"
fi

echo "Starting Qwen3 translation model (vLLM-Metal)"
echo "  Model: $MODEL"
echo "  Port:  $PORT"
echo "  Note:  First run downloads the model (~17GB). This may take a while."

vllm serve "$MODEL" \
  --host "$HOST" \
  --port "$PORT" \
  --max-model-len 4096 \
  --dtype bfloat16
