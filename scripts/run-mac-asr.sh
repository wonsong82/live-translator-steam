#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ASR_DIR="$PROJECT_ROOT/qwen3-asr"
VENV_DIR="$ASR_DIR/.venv-mac"

if [[ "$(uname -m)" != "arm64" ]]; then
  echo "Error: This script requires Apple Silicon (M1/M2/M3/M4)."
  exit 1
fi

if [[ ! -d "$VENV_DIR" ]]; then
  echo "Creating Python virtual environment..."
  python3 -m venv "$VENV_DIR"
  source "$VENV_DIR/bin/activate"
  pip install --upgrade pip
  pip install -r "$ASR_DIR/requirements-mac.txt"
else
  source "$VENV_DIR/bin/activate"
fi

export QWEN3_ASR_MODEL="${QWEN3_ASR_MODEL:-mlx-community/Qwen3-ASR-1.7B-6bit}"
export QWEN3_ASR_HOST="${QWEN3_ASR_HOST:-0.0.0.0}"
export QWEN3_ASR_PORT="${QWEN3_ASR_PORT:-8001}"

echo "Starting Qwen3-ASR on Mac (MLX backend)"
echo "  Model: $QWEN3_ASR_MODEL"
echo "  Port:  $QWEN3_ASR_PORT"

python "$ASR_DIR/src/server_mac.py"
