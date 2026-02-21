#!/usr/bin/env bash
set -euo pipefail

echo "=== Translate Service — Dev Environment Setup ==="

if ! command -v docker &> /dev/null; then
  echo "ERROR: docker is not installed"
  exit 1
fi

if ! command -v docker compose &> /dev/null; then
  echo "ERROR: docker compose is not installed"
  exit 1
fi

if [ ! -f .env ]; then
  echo "Creating .env from .env.example..."
  cp .env.example .env
  echo "  → Edit .env to add your API keys"
fi

mkdir -p secrets

echo "Building containers..."
docker compose build

echo "Starting infrastructure (Redis + PostgreSQL)..."
docker compose up -d redis db

echo "Waiting for database..."
sleep 3

echo "Starting server..."
docker compose up -d server

echo "Starting frontend..."
docker compose up -d frontend

echo ""
echo "=== Setup Complete ==="
echo "  Server:   http://localhost:8080"
echo "  Frontend: http://localhost:3000"
echo "  Redis:    localhost:6379"
echo "  Postgres: localhost:5432"
echo ""
echo "To enable Qwen3-ASR (requires NVIDIA GPU):"
echo "  docker compose --profile gpu up -d qwen3-asr"
