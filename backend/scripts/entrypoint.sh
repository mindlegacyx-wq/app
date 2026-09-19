#!/usr/bin/env bash
# Aplica migrações e sobe a API.
#   WEB_CONCURRENCY → nº de workers (1 em planos gratuitos de 512 MB)
#   PORT            → porta (o Render define; padrão 8000)
set -euo pipefail

echo "[api] aplicando migrações..."
alembic upgrade head

WORKERS="${WEB_CONCURRENCY:-2}"
PORT="${PORT:-8000}"
echo "[api] iniciando uvicorn na porta ${PORT} com ${WORKERS} worker(s)"
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${PORT}" \
  --workers "${WORKERS}" \
  --proxy-headers \
  --forwarded-allow-ips '*' \
  --no-access-log
