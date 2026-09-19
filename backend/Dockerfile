FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /srv

# Dependências primeiro (cache de camada)
COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install .

COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./
COPY scripts/entrypoint.sh ./scripts/entrypoint.sh
RUN chmod +x ./scripts/entrypoint.sh

# Usuário sem privilégios
RUN useradd --create-home --uid 10001 api && chown -R api:api /srv
USER api

EXPOSE 8000
ENTRYPOINT ["./scripts/entrypoint.sh"]
