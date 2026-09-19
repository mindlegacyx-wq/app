"""Normaliza a DATABASE_URL para o SQLAlchemy + asyncpg.

Provedores de banco (Aiven, Render, Neon, Supabase…) entregam a URL no formato do libpq:

    postgres://usuario:senha@host:porta/banco?sslmode=require

O asyncpg não aceita `sslmode` como argumento e o SQLAlchemy precisa do prefixo
`postgresql+asyncpg://`. Aqui a URL é convertida e o pedido de SSL vira
`connect_args={"ssl": "require"}` — assim a mesma variável funciona no PC (sem SSL) e na nuvem.
"""

from __future__ import annotations

from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

# Parâmetros que só o libpq entende; o asyncpg recusaria como argumento desconhecido.
_LIBPQ_ONLY = {"sslmode", "ssl", "channel_binding", "sslcert", "sslkey", "sslrootcert"}
_NO_SSL = {"disable", "allow", "false", "0", "off"}


def normalize_database_url(raw: str) -> tuple[str, dict[str, object]]:
    """Devolve (url para o SQLAlchemy, connect_args para o asyncpg)."""
    parts = urlsplit(raw.strip())
    scheme = parts.scheme.lower()
    if scheme in {"postgres", "postgresql", "postgresql+psycopg2", "postgresql+psycopg"}:
        scheme = "postgresql+asyncpg"

    connect_args: dict[str, object] = {}
    kept: list[tuple[str, str]] = []
    for key, value in parse_qsl(parts.query, keep_blank_values=True):
        if key.lower() in {"sslmode", "ssl"}:
            if value.lower() not in _NO_SSL:
                # "require" cifra a conexão sem exigir o certificado da autoridade do provedor
                # (é o que Aiven/Render/Neon pedem por padrão).
                connect_args["ssl"] = "require"
            continue
        if key.lower() in _LIBPQ_ONLY:
            continue
        kept.append((key, value))

    url = urlunsplit((scheme, parts.netloc, parts.path, urlencode(kept), parts.fragment))
    return url, connect_args
