#!/usr/bin/env bash
# Sobe a API em modo dev (com auto-reload). Uso: backend/scripts/dev.sh [porta]
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${1:-8000}"
exec .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port "$PORT" --reload --reload-dir app
