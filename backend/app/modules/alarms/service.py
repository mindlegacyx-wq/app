"""Registro de acordar. Na Fase 1 só existe a confirmação manual ("Levantei")."""

from datetime import date, time
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dates import ensure_recordable_day, local_to_utc, now_utc, user_today
from app.modules.alarms.models import WakeLog, WakeStatus
from app.modules.alarms.schemas import WakeDayOut


async def _get_log(db: AsyncSession, user_id: UUID, day: date) -> WakeLog | None:
    return await db.scalar(select(WakeLog).where(WakeLog.user_id == user_id, WakeLog.date == day))


def _to_out(day: date, log: WakeLog | None, wake_time: time | None, timezone: str) -> WakeDayOut:
    scheduled_at = (
        log.scheduled_at if log else (local_to_utc(day, wake_time, timezone) if wake_time else None)
    )
    delay = None
    if log and log.confirmed_at and scheduled_at:
        delay = round((log.confirmed_at - scheduled_at).total_seconds() / 60)
    return WakeDayOut(
        date=day,
        scheduled_time=wake_time,
        scheduled_at=scheduled_at,
        confirmed_at=log.confirmed_at if log else None,
        delay_minutes=delay,
        status=log.status if log else None,
        can_undo=bool(log and log.status == WakeStatus.manual and day == user_today(timezone)),
    )


async def day_status(
    db: AsyncSession, user_id: UUID, timezone: str, wake_time: time | None, day: date
) -> WakeDayOut:
    return _to_out(day, await _get_log(db, user_id, day), wake_time, timezone)


async def confirm_manual(
    db: AsyncSession, user_id: UUID, timezone: str, wake_time: time | None, day: date
) -> WakeDayOut:
    """Idempotente: se já existe registro no dia, devolve o existente sem alterar."""
    ensure_recordable_day(day, timezone)
    log = await _get_log(db, user_id, day)
    if log is None:
        log = WakeLog(
            user_id=user_id,
            date=day,
            scheduled_at=local_to_utc(day, wake_time, timezone) if wake_time else None,
            confirmed_at=now_utc(),
            snooze_count=0,
            status=WakeStatus.manual,
            created_at=now_utc(),
        )
        db.add(log)
        await db.flush()
    return _to_out(day, log, wake_time, timezone)


async def undo_manual(db: AsyncSession, user_id: UUID, timezone: str, day: date) -> None:
    """Só o registro manual do dia de hoje pode ser desfeito."""
    if day != user_today(timezone):
        return
    await db.execute(
        delete(WakeLog).where(
            WakeLog.user_id == user_id,
            WakeLog.date == day,
            WakeLog.status == WakeStatus.manual,
        )
    )
    await db.flush()
