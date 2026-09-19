import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

# Importa todos os models para que o autogenerate enxergue as tabelas.
import app.modules.alarms.models  # noqa: F401
import app.modules.auth.models  # noqa: F401
import app.modules.goals.models  # noqa: F401
import app.modules.grades.models  # noqa: F401
import app.modules.progress.models  # noqa: F401
import app.modules.routines.models  # noqa: F401
import app.modules.schedule.models  # noqa: F401
import app.modules.studies.models  # noqa: F401
import app.modules.tasks.models  # noqa: F401
import app.modules.users.models  # noqa: F401
import app.modules.workouts.models  # noqa: F401
from app.core.config import get_settings
from app.core.db import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# A URL vai direto (não pelo alembic.ini): evita a interpolação de "%" do configparser em
# senhas e aceita o formato dos provedores (postgres://…?sslmode=require).
settings = get_settings()
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=settings.sqlalchemy_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = create_async_engine(
        settings.sqlalchemy_url,
        connect_args=settings.db_connect_args,
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
