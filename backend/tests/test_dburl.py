"""DATABASE_URL no formato dos provedores (Aiven/Render/Neon) vira URL + connect_args do asyncpg."""

import asyncpg
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import get_settings
from app.core.dburl import normalize_database_url


def test_provider_url_becomes_asyncpg_with_ssl() -> None:
    url, args = normalize_database_url(
        "postgres://avnadmin:p%40ss@pg-x.aivencloud.com:12345/defaultdb?sslmode=require"
    )
    assert url == "postgresql+asyncpg://avnadmin:p%40ss@pg-x.aivencloud.com:12345/defaultdb"
    assert args == {"ssl": "require"}


def test_libpq_only_params_are_dropped_and_others_kept() -> None:
    url, args = normalize_database_url(
        "postgresql://u:p@h/db?sslmode=verify-full&channel_binding=require&application_name=x"
    )
    assert url == "postgresql+asyncpg://u:p@h/db?application_name=x"
    assert args == {"ssl": "require"}


def test_local_url_is_untouched() -> None:
    raw = "postgresql+asyncpg://disciplina:disciplina@127.0.0.1:5432/disciplina"
    assert normalize_database_url(raw) == (raw, {})
    assert normalize_database_url("postgres://u:p@h/db?sslmode=disable") == (
        "postgresql+asyncpg://u:p@h/db",
        {},
    )


async def test_ssl_connection_against_local_postgres() -> None:
    """O Postgres local aceita SSL? Então `sslmode=require` tem de conectar cifrado."""
    base = get_settings().database_url.replace("postgresql+asyncpg://", "postgres://")
    url, args = normalize_database_url(base + "?sslmode=require")
    engine = create_async_engine(url, connect_args=args, pool_pre_ping=True)
    try:
        async with engine.connect() as conn:
            ssl_on = (await conn.execute(text("SHOW ssl"))).scalar()
            if ssl_on != "on":
                pytest.skip("Postgres local sem SSL")
            row = await conn.execute(
                text("SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()")
            )
            assert row.scalar() is True
    except asyncpg.InvalidAuthorizationSpecificationError:  # pragma: no cover
        pytest.skip("servidor recusa SSL")
    finally:
        await engine.dispose()
