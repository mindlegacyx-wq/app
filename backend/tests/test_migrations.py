"""As migrações têm que produzir o mesmo banco que os modelos.

Os outros testes criam o schema a partir dos modelos (rápido); o servidor de verdade nasce
das migrações. Sem esta comparação, uma coluna esquecida numa migração só aparece em
produção — foi assim que `created_at` sem default derrubou a criação de tarefa fixa.
"""

import asyncio
import os
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.db import Base

BACKEND = Path(__file__).resolve().parents[1]
URL = os.environ["DATABASE_URL"].replace("_test", "_migcheck")


async def _schema_from_migrations() -> dict[str, dict[str, Any]]:
    name = URL.rsplit("/", 1)[1]
    admin = create_async_engine(URL.rsplit("/", 1)[0] + "/postgres", isolation_level="AUTOCOMMIT")
    try:
        async with admin.connect() as conn:
            await conn.execute(text(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))
            await conn.execute(text(f'CREATE DATABASE "{name}"'))
    finally:
        await admin.dispose()

    process = await asyncio.create_subprocess_exec(
        str(BACKEND / ".venv/bin/alembic"),
        "upgrade",
        "head",
        cwd=BACKEND,
        env={**os.environ, "DATABASE_URL": URL},
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await process.communicate()
    assert process.returncode == 0, stderr.decode()[-2000:]

    engine = create_async_engine(URL)
    try:
        async with engine.connect() as conn:
            return await conn.run_sync(
                lambda sync: {
                    table: {c["name"]: c for c in inspect(sync).get_columns(table)}
                    for table in inspect(sync).get_table_names()
                    if table != "alembic_version"
                }
            )
    finally:
        await engine.dispose()


async def test_migrations_match_the_models() -> None:
    try:
        schema = await _schema_from_migrations()
    except OSError as exc:  # pragma: no cover - ambiente sem Postgres administrável
        pytest.skip(f"não deu para preparar o banco de verificação: {exc}")

    missing_tables = set(Base.metadata.tables) - set(schema)
    assert missing_tables == set(), f"tabelas só nos modelos: {missing_tables}"

    problems: list[str] = []
    for name, table in sorted(Base.metadata.tables.items()):
        columns = schema[name]
        for column in table.columns:
            actual = columns.get(column.name)
            if actual is None:
                problems.append(f"{name}.{column.name}: falta na migração")
                continue
            if column.nullable != actual["nullable"]:
                problems.append(f"{name}.{column.name}: nullable diferente")
            # NOT NULL cujo valor vem do banco: sem default, todo INSERT quebra.
            if column.server_default is not None and actual["default"] is None:
                problems.append(f"{name}.{column.name}: sem o default que o modelo espera")
    assert problems == [], "\n".join(problems)
