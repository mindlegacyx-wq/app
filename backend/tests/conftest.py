"""Testes rodam contra um Postgres real (disciplina_test), com schema recriado por sessão.

Cada teste roda dentro de uma transação que é desfeita no fim: banco limpo, testes rápidos.
"""

import os
from collections.abc import AsyncIterator

os.environ.setdefault("ENV", "test")
os.environ.setdefault("JWT_SECRET", "segredo-de-teste-com-mais-de-trinta-e-dois-caracteres")
os.environ.setdefault("COOKIE_SECURE", "false")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://disciplina:disciplina@127.0.0.1:5432/disciplina_test"
)
os.environ.setdefault("AUTH_RATE_LIMIT_PER_MINUTE", "1000")
os.environ.setdefault("SCHEDULER_ENABLED", "false")

import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker  # noqa: E402

import app.modules.alarms.models  # noqa: F401,E402
import app.modules.auth.models  # noqa: F401,E402
import app.modules.goals.models  # noqa: F401,E402
import app.modules.progress.models  # noqa: F401,E402
import app.modules.routines.models  # noqa: F401,E402
import app.modules.tasks.models  # noqa: F401,E402
import app.modules.users.models  # noqa: F401,E402
from app.core.db import Base, engine, get_db  # noqa: E402
from app.core.ratelimit import auth_limiter  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
async def _create_schema() -> AsyncIterator[None]:
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS citext"))
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


@pytest.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    async with engine.connect() as conn:
        trans = await conn.begin()
        session_factory = async_sessionmaker(
            bind=conn, expire_on_commit=False, join_transaction_mode="create_savepoint"
        )
        async with session_factory() as session:
            yield session
        await trans.rollback()


@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncIterator[AsyncClient]:
    async def _override_db() -> AsyncIterator[AsyncSession]:
        yield db_session

    app.dependency_overrides[get_db] = _override_db
    auth_limiter.reset()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def credentials() -> dict[str, str]:
    return {"email": "ana@exemplo.com", "password": "senha-forte-123", "name": "Ana"}


async def register(client: AsyncClient, **overrides: str) -> dict:
    payload = {"email": "ana@exemplo.com", "password": "senha-forte-123", "name": "Ana"}
    payload.update(overrides)
    r = await client.post("/api/v1/auth/register", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}
