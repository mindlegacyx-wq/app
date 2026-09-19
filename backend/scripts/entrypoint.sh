#!/usr/bin/env bash
# Aplica migrações e sobe a API. Em produção, WEB_CONCURRENCY define o nº de workers.
set -euo pipefail

echo "[api] aplicando migrações..."
alembic upgrade head

WORKERS="${WEB_CONCURRENCY:-2}"
echo "[api] iniciando uvicorn com ${WORKERS} worker(s)"
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers "${WORKERS}" \
  --proxy-headers \
  --forwarded-allow-ips '*' \
  --no-access-log
