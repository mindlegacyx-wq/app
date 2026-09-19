"""Jobs em background (MVP: APScheduler no processo da API).

Hoje: finalizar dias vencidos de cada usuário (03:00 no fuso de cada um). Um advisory lock
do Postgres garante que só uma réplica/worker executa por vez; o job é idempotente.
Ao escalar, a mesma função vai para um worker dedicado sem mudar os services.
"""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, text

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.modules.progress import service as progress_service
from app.modules.users.models import User

log = logging.getLogger("disciplina.scheduler")

FINALIZE_LOCK_KEY = 7_201_001  # qualquer inteiro fixo; identifica este job


async def finalize_due_days() -> int:
    """Percorre usuários ativos e finaliza os dias que já passaram do corte. Devolve o total."""
    total = 0
    async with SessionLocal() as db:
        locked = await db.scalar(text("SELECT pg_try_advisory_lock(:k)"), {"k": FINALIZE_LOCK_KEY})
        if not locked:
            return 0
        try:
            users = (await db.scalars(select(User).where(User.is_active.is_(True)))).unique()
            for user in users:
                try:
                    total += await progress_service.finalize_due_days_for_user(db, user)
                    await db.commit()
                except Exception:  # noqa: BLE001 — um usuário com erro não derruba os demais
                    await db.rollback()
                    log.exception("falha ao finalizar dias do usuário %s", user.id)
        finally:
            await db.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": FINALIZE_LOCK_KEY})
            await db.commit()
    if total:
        log.info("dias finalizados: %d", total)
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
    return scheduler
