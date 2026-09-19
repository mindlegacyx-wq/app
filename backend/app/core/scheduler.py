"""Jobs em background (MVP: APScheduler no processo da API).

- `finalize_due_days`: a cada N minutos, finaliza os dias que passaram do corte (03:00 no fuso
  de cada usuário).
- `dispatch_alarms`: a cada minuto, toca os alarmes devidos no fuso de cada usuário (cria o
  registro de acordar pendente e envia Web Push), reenvia sonecas vencidas e marca perdidos.
- `purge_trash`: uma vez por dia, apaga em definitivo o que está na lixeira há mais de 30 dias.

Um advisory lock do Postgres por job garante que só uma réplica/worker executa por vez; os
jobs são idempotentes. Ao escalar, as mesmas funções vão para um worker dedicado sem mudar
os services.
"""

import logging
from collections.abc import Awaitable, Callable

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.modules.alarms import service as alarms_service
from app.modules.progress import service as progress_service
from app.modules.trash import service as trash_service
from app.modules.users.models import User

log = logging.getLogger("disciplina.scheduler")

FINALIZE_LOCK_KEY = 7_201_001  # qualquer inteiro fixo; identifica o job
ALARMS_LOCK_KEY = 7_201_002
PURGE_LOCK_KEY = 7_201_003


async def _for_each_active_user(
    lock_key: int, step: Callable[[AsyncSession, User], Awaitable[int]], label: str
) -> int:
    """Percorre usuários ativos sob advisory lock; um usuário com erro não derruba os demais."""
    total = 0
    async with SessionLocal() as db:
        locked = await db.scalar(text("SELECT pg_try_advisory_lock(:k)"), {"k": lock_key})
        if not locked:
            return 0
        try:
            users = (await db.scalars(select(User).where(User.is_active.is_(True)))).unique()
            for user in users:
                try:
                    total += await step(db, user)
                    await db.commit()
                except Exception:  # noqa: BLE001
                    await db.rollback()
                    log.exception("%s: falha no usuário %s", label, user.id)
        finally:
            await db.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": lock_key})
            await db.commit()
    return total


async def finalize_due_days() -> int:
    """Finaliza os dias que já passaram do corte. Devolve o total de dias finalizados."""
    total = await _for_each_active_user(
        FINALIZE_LOCK_KEY, progress_service.finalize_due_days_for_user, "finalizar dias"
    )
    if total:
        log.info("dias finalizados: %d", total)
    return total


async def dispatch_alarms() -> int:
    """Toca alarmes devidos, sonecas vencidas e marca perdidos. Devolve o total de toques."""
    total = await _for_each_active_user(
        ALARMS_LOCK_KEY, alarms_service.dispatch_for_user, "disparar alarmes"
    )
    if total:
        log.info("alarmes disparados: %d", total)
    return total


async def purge_trash() -> int:
    """Apaga em definitivo o que está na lixeira há mais de 30 dias (sem histórico ligado)."""
    async with SessionLocal() as db:
        locked = await db.scalar(text("SELECT pg_try_advisory_lock(:k)"), {"k": PURGE_LOCK_KEY})
        if not locked:
            return 0
        try:
            total = await trash_service.purge_expired(db)
            await db.commit()
        except Exception:  # noqa: BLE001
            await db.rollback()
            log.exception("limpeza da lixeira falhou")
            return 0
        finally:
            await db.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": PURGE_LOCK_KEY})
            await db.commit()
    if total:
        log.info("lixeira: %d itens apagados em definitivo", total)
    return total


def build_scheduler() -> AsyncIOScheduler:
    s = get_settings()
    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(
        finalize_due_days,
        "interval",
        minutes=s.scheduler_interval_minutes,
        id="finalize_due_days",
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        dispatch_alarms,
        "cron",
        second=0,  # todo minuto cheio, alinhado ao relógio
        id="dispatch_alarms",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=60,
    )
    scheduler.add_job(
        purge_trash,
        "cron",
        hour=4,
        minute=30,  # uma vez por dia, fora do horário de pico
        id="purge_trash",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=3600,
    )
    return scheduler
