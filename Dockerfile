# Imagem ÚNICA (API + PWA) para hospedagem gratuita em um container só — Render, Fly, Koyeb…
# Guia: PUBLICAR-DE-GRACA.md.  (Para VPS com Caddy, use docker-compose.yml; para testar no PC,
# docker-compose.dev.yml.)
#
#   docker build -t disciplina .
#   docker run -p 8000:8000 -e DATABASE_URL=... -e JWT_SECRET=... disciplina

# ── 1) Build do PWA ──────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ── 2) API + arquivos estáticos ──────────────────────────────────────────────────────────────
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    STATIC_DIR=/srv/static \
    WEB_CONCURRENCY=1

WORKDIR /srv

COPY backend/pyproject.toml ./
RUN pip install --upgrade pip && pip install .

COPY backend/app ./app
COPY backend/alembic ./alembic
COPY backend/alembic.ini ./
COPY backend/scripts/entrypoint.sh ./scripts/entrypoint.sh
COPY --from=web /web/dist ./static
RUN chmod +x ./scripts/entrypoint.sh \
    && useradd --create-home --uid 10001 api && chown -R api:api /srv
USER api

EXPOSE 8000
# Render define PORT; o entrypoint usa ${PORT:-8000}.
ENTRYPOINT ["./scripts/entrypoint.sh"]
