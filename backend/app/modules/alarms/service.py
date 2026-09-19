"""Despertador: alarmes recorrentes, disparo, soneca, confirmação e histórico de acordar.

Regras do produto:
- O "acordar" do dia é planejado quando existe alarme ativo naquele dia da semana. Quem não
  tem alarme nenhum cai no `wake_time` das configurações.
- O disparo cria um `wake_log` pendente (um por dia) e envia Web Push a todos os dispositivos.
  Com o app aberto, o cliente também pode disparar via `ring()` (mesma regra, idempotente).
- Sem confirmação em `alarm_missed_minutes` após o primeiro toque, o registro vira `missed`.
- "Levantei" manual do dia D libera a partir do corte de fechamento (03:00) de D; antes disso
  você ainda está na noite de D-1. Alarme perdido pode ser confirmado manualmente (vira `manual`).
"""

import logging
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import push
from app.core.config import get_settings
from app.core.dates import (
    DateNotAllowedError,
    close_cutoff_hour,
    ensure_recordable_day,
    local_now,
    local_to_utc,
    now_utc,
    user_today,
    weekday_index,
)
from app.core.errors import AppError, NotFoundError
from app.modules.alarms.models import Alarm, WakeLog, WakeStatus
from app.modules.alarms.schemas import (
    AlarmIn,
    AlarmOut,
    AlarmsOut,
    AlarmUpdate,
    NextRingOut,
    WakeAlarmOut,
    WakeDayOut,
    WakeHistoryDayOut,
    WakeHistoryOut,
)
from app.modules.users import push_service
from app.modules.users.models import User

log = logging.getLogger("disciplina.alarms")

RING_GRACE = timedelta(minutes=3)  # o job pode atrasar um pouco; um alarme não some por isso
RING_AHEAD = timedelta(seconds=60)  # o cliente pode pedir o toque até 1 min antes


class WakeNotRingingError(AppError):
    code = "wake_not_ringing"


# --- Alarmes: consultas ------------------------------------------------------------------


def _alive_alarms(user_id: UUID):
    return (
        select(Alarm)
        .where(Alarm.user_id == user_id, Alarm.deleted_at.is_(None))
        .order_by(Alarm.time, Alarm.created_at)
    )


async def list_alarms(db: AsyncSession, user_id: UUID) -> list[Alarm]:
    return list(await db.scalars(_alive_alarms(user_id)))


async def get_alarm(db: AsyncSession, user_id: UUID, alarm_id: UUID) -> Alarm:
    alarm = await db.scalar(_alive_alarms(user_id).where(Alarm.id == alarm_id))
    if alarm is None:
        raise NotFoundError("Alarme não encontrado.")
    return alarm


def next_ring_of(alarm: Alarm, timezone: str, at: datetime | None = None) -> datetime | None:
    """Próximo instante (UTC) em que este alarme toca, ou None se estiver inativo."""
    if not alarm.is_active or not alarm.days_of_week:
        return None
    now = at or now_utc()
    today = user_today(timezone, now)
    for offset in range(8):
        day = today + timedelta(days=offset)
        if weekday_index(day) in alarm.days_of_week:
            candidate = local_to_utc(day, alarm.time, timezone)
            if candidate > now:
                return candidate
    return None


def alarm_for_day(alarms: list[Alarm], day: date) -> Alarm | None:
    """Primeiro alarme ativo do dia (o que define o horário planejado de acordar)."""
    due = [a for a in alarms if a.is_active and weekday_index(day) in a.days_of_week]
    return min(due, key=lambda a: a.time) if due else None


def to_out(alarm: Alarm, timezone: str) -> AlarmOut:
    out = AlarmOut.model_validate(alarm)
    out.next_ring_at = next_ring_of(alarm, timezone)
    return out


async def overview(db: AsyncSession, user_id: UUID, timezone: str) -> AlarmsOut:
    alarms = await list_alarms(db, user_id)
    outs = [to_out(a, timezone) for a in alarms]
    upcoming = [(o.next_ring_at, o) for o in outs if o.next_ring_at is not None]
    nxt = None
    if upcoming:
        at, o = min(upcoming, key=lambda p: p[0])
        nxt = NextRingOut(alarm_id=o.id, label=o.label, at=at, sound=o.sound)
    return AlarmsOut(alarms=outs, next=nxt, push_enabled=get_settings().push_enabled)


# --- Alarmes: escrita --------------------------------------------------------------------


async def create_alarm(db: AsyncSession, user_id: UUID, data: AlarmIn) -> Alarm:
    alarm = Alarm(user_id=user_id, **data.model_dump())
    db.add(alarm)
    await db.flush()
    return alarm


async def update_alarm(db: AsyncSession, user_id: UUID, alarm_id: UUID, data: AlarmUpdate) -> Alarm:
    alarm = await get_alarm(db, user_id, alarm_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(alarm, field, value)
    await db.flush()
    return alarm


async def delete_alarm(db: AsyncSession, user_id: UUID, alarm_id: UUID) -> None:
    alarm = await get_alarm(db, user_id, alarm_id)
    alarm.deleted_at = now_utc()
    await db.flush()


async def ensure_default_alarm(db: AsyncSession, user_id: UUID, wake_time: time) -> None:
    """Setup inicial: cria o alarme "Acordar" no horário informado se ainda não há alarme."""
    if await list_alarms(db, user_id):
        return
    await create_alarm(db, user_id, AlarmIn(label="Acordar", time=wake_time))


# --- Acordar: estado do dia --------------------------------------------------------------


async def _get_log(db: AsyncSession, user_id: UUID, day: date) -> WakeLog | None:
    return await db.scalar(select(WakeLog).where(WakeLog.user_id == user_id, WakeLog.date == day))


def _manual_window_open(day: date, timezone: str, at: datetime | None = None) -> bool:
    """ "Levantei" manual do dia D vale a partir do corte (03:00) de D no fuso do usuário."""
    opens_at = datetime.combine(day, time(close_cutoff_hour(), 0), tzinfo=ZoneInfo(timezone))
    return local_now(timezone, at) >= opens_at


@dataclass
class _DayPlan:
    scheduled_time: time | None
    alarm: Alarm | None


async def _plan_for(
    db: AsyncSession, user_id: UUID, wake_time: time | None, day: date, log: WakeLog | None
) -> _DayPlan:
    alarms = await list_alarms(db, user_id)
    if log is not None and log.alarm_id is not None:
        # O registro já nasceu de um alarme: ele manda, mesmo que o alarme tenha mudado depois.
        alarm = next((a for a in alarms if a.id == log.alarm_id), None)
        if alarm is None:
            alarm = await db.get(Alarm, log.alarm_id)
        return _DayPlan(scheduled_time=alarm.time if alarm else wake_time, alarm=alarm)
    if alarms:
        alarm = alarm_for_day(alarms, day)
        return _DayPlan(scheduled_time=alarm.time if alarm else None, alarm=alarm)
    return _DayPlan(scheduled_time=wake_time, alarm=None)


def _to_out(day: date, log: WakeLog | None, plan: _DayPlan, timezone: str) -> WakeDayOut:
    now = now_utc()
    scheduled_at = log.scheduled_at if log and log.scheduled_at else None
    if scheduled_at is None and plan.scheduled_time:
        scheduled_at = local_to_utc(day, plan.scheduled_time, timezone)
    delay = None
    if log and log.confirmed_at and scheduled_at:
        delay = round((log.confirmed_at - scheduled_at).total_seconds() / 60)
    pending = bool(log and log.status == WakeStatus.pending)
    ringing = pending and (log.next_ring_at is None or log.next_ring_at <= now)  # type: ignore[union-attr]
    max_snoozes = plan.alarm.max_snoozes if plan.alarm else 1
    return WakeDayOut(
        date=day,
        scheduled_time=plan.scheduled_time,
        scheduled_at=scheduled_at,
        rang_at=log.rang_at if log else None,
        next_ring_at=log.next_ring_at if log else None,
        confirmed_at=log.confirmed_at if log else None,
        delay_minutes=delay,
        snooze_count=log.snooze_count if log else 0,
        status=log.status if log else None,
        alarm=WakeAlarmOut.model_validate(plan.alarm, from_attributes=True) if plan.alarm else None,
        ringing=ringing,
        can_snooze=pending and log.snooze_count < max_snoozes,  # type: ignore[union-attr]
        can_confirm=bool(log and log.status in (WakeStatus.pending, WakeStatus.missed))
        or (log is None and _manual_window_open(day, timezone)),
        can_undo=bool(log and log.status == WakeStatus.manual and day == user_today(timezone)),
    )


async def day_status(
    db: AsyncSession, user_id: UUID, timezone: str, wake_time: time | None, day: date
) -> WakeDayOut:
    log = await _get_log(db, user_id, day)
    plan = await _plan_for(db, user_id, wake_time, day, log)
    return _to_out(day, log, plan, timezone)


# --- Acordar: confirmação, soneca, desfazer ----------------------------------------------


async def confirm(
    db: AsyncSession, user_id: UUID, timezone: str, wake_time: time | None, day: date
) -> WakeDayOut:
    """Confirma que levantou. Idempotente: registro já confirmado é devolvido sem alteração.

    - pendente (alarme tocou) → `confirmed`
    - perdido → `manual` (confirmou depois da janela do alarme)
    - sem registro → `manual`, se a janela do dia já abriu
    """
    ensure_recordable_day(day, timezone)
    log = await _get_log(db, user_id, day)
    now = now_utc()
    if log is None:
        if not _manual_window_open(day, timezone):
            raise DateNotAllowedError(
                f'Ainda é madrugada. O "Levantei" de hoje libera a partir das '
                f"{close_cutoff_hour():02d}:00."
            )
        plan = await _plan_for(db, user_id, wake_time, day, None)
        log = WakeLog(
            user_id=user_id,
            alarm_id=None,
            date=day,
            scheduled_at=(
                local_to_utc(day, plan.scheduled_time, timezone) if plan.scheduled_time else None
            ),
            confirmed_at=now,
            snooze_count=0,
            status=WakeStatus.manual,
            created_at=now,
        )
        db.add(log)
        await db.flush()
    elif log.status == WakeStatus.pending:
        log.status = WakeStatus.confirmed
        log.confirmed_at = now
        log.next_ring_at = None
        await db.flush()
    elif log.status == WakeStatus.missed:
        log.status = WakeStatus.manual
        log.confirmed_at = now
        await db.flush()
    plan = await _plan_for(db, user_id, wake_time, day, log)
    return _to_out(day, log, plan, timezone)


async def snooze(
    db: AsyncSession, user_id: UUID, timezone: str, wake_time: time | None
) -> WakeDayOut:
    """Adia o alarme pendente de hoje em `snooze_minutes`, até `max_snoozes` vezes."""
    day = user_today(timezone)
    log = await _get_log(db, user_id, day)
    if log is None or log.status != WakeStatus.pending:
        raise WakeNotRingingError("Não há alarme tocando agora.")
    plan = await _plan_for(db, user_id, wake_time, day, log)
    max_snoozes = plan.alarm.max_snoozes if plan.alarm else 1
    minutes = plan.alarm.snooze_minutes if plan.alarm else 5
    if log.snooze_count >= max_snoozes:
        raise WakeNotRingingError("Você já usou todas as sonecas de hoje.")
    log.snooze_count += 1
    log.next_ring_at = now_utc() + timedelta(minutes=minutes)
    await db.flush()
    return _to_out(day, log, plan, timezone)


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


# --- Disparo -----------------------------------------------------------------------------


def _payload(user: User, alarm: Alarm, log: WakeLog) -> dict[str, object]:
    return {
        "type": "alarm",
        "wake_log_id": str(log.id),
        "alarm_id": str(alarm.id),
        "label": alarm.label,
        "time": alarm.time.strftime("%H:%M"),
        "sound": alarm.sound,
        "can_snooze": log.snooze_count < alarm.max_snoozes,
        "url": "/alarme",
    }


async def _notify(db: AsyncSession, user: User, payload: dict[str, object]) -> int:
    """Envia o payload a todos os dispositivos do usuário; apaga assinaturas mortas."""
    if not user.settings.notifications_enabled:
        return 0
    sent = 0
    for sub in await push_service.list_for_user(db, user.id):
        try:
            if await push.send(push_service.subscription_info(sub), payload):
                sub.last_used_at = now_utc()
                sent += 1
        except push.PushGoneError:
            await db.delete(sub)
    await db.flush()
    return sent


async def _ring(
    db: AsyncSession, user: User, alarm: Alarm, day: date, scheduled_at: datetime, now: datetime
) -> WakeLog | None:
    """Toca um alarme para o dia: cria o registro pendente (ou reaproveita o pendente) e
    notifica. Devolve None quando não há o que tocar (dia já confirmado/perdido)."""
    log = await _get_log(db, user.id, day)
    if log is None:
        log = WakeLog(
            user_id=user.id,
            alarm_id=alarm.id,
            date=day,
            scheduled_at=scheduled_at,
            rang_at=now,
            next_ring_at=None,
            snooze_count=0,
            status=WakeStatus.pending,
            created_at=now,
        )
        db.add(log)
        await db.flush()
    elif log.status == WakeStatus.pending:
        log.next_ring_at = None
        await db.flush()
    else:
        return None
    await _notify(db, user, _payload(user, alarm, log))
    return log


async def ring(
    db: AsyncSession, user: User, alarm_id: UUID, at: datetime | None = None
) -> WakeDayOut:
    """Disparo pedido pelo cliente (app aberto na hora do alarme). Mesma regra do job."""
    now = at or now_utc()
    alarm = await get_alarm(db, user.id, alarm_id)
    day = user_today(user.timezone, now)
    scheduled_at = local_to_utc(day, alarm.time, user.timezone)
    missed_after = timedelta(minutes=get_settings().alarm_missed_minutes)
    in_window = scheduled_at - RING_AHEAD <= now < scheduled_at + missed_after
    if not alarm.is_active or weekday_index(day) not in alarm.days_of_week or not in_window:
        raise WakeNotRingingError("Este alarme não está na hora de tocar.")
    log = await _get_log(db, user.id, day)
    if log is None or log.status == WakeStatus.pending:
        await _ring(db, user, alarm, day, scheduled_at, now)
    return await day_status(db, user.id, user.timezone, user.settings.wake_time, day)


async def dispatch_for_user(db: AsyncSession, user: User, now: datetime | None = None) -> int:
    """Um passo do job para um usuário: toca alarmes devidos, reenvia sonecas vencidas e marca
    perdidos. Devolve quantos toques foram disparados."""
    now = now or now_utc()
    day = user_today(user.timezone, now)
    rings = 0
    log = await _get_log(db, user.id, day)

    # 1) Alarmes devidos neste minuto (com tolerância a atraso do job).
    if log is None or log.status == WakeStatus.pending:
        for alarm in await list_alarms(db, user.id):
            if not alarm.is_active or weekday_index(day) not in alarm.days_of_week:
                continue
            scheduled_at = local_to_utc(day, alarm.time, user.timezone)
            if not (now - RING_GRACE < scheduled_at <= now):
                continue
            if log is None:
                log = await _ring(db, user, alarm, day, scheduled_at, now)
                rings += 1
            elif log.alarm_id != alarm.id and scheduled_at > now - timedelta(minutes=1):
                # Segundo alarme do dia enquanto o primeiro segue pendente: toca de novo.
                await _ring(db, user, alarm, day, scheduled_at, now)
                rings += 1

    # 2) Soneca vencida → toca de novo.
    if log and log.status == WakeStatus.pending and log.next_ring_at and log.next_ring_at <= now:
        snoozed = await db.get(Alarm, log.alarm_id) if log.alarm_id else None
        if snoozed is not None:
            await _ring(db, user, snoozed, day, log.scheduled_at or now, now)
            rings += 1
        else:
            log.next_ring_at = None

    # 3) Sem confirmação depois do limite → perdido. Vale para hoje e para a véspera.
    missed_after = timedelta(minutes=get_settings().alarm_missed_minutes)
    for candidate in (log, await _get_log(db, user.id, day - timedelta(days=1))):
        if (
            candidate is not None
            and candidate.status == WakeStatus.pending
            and candidate.rang_at is not None
            and candidate.rang_at + missed_after <= now
        ):
            candidate.status = WakeStatus.missed
            candidate.next_ring_at = None
    await db.flush()
    return rings


# --- Histórico ---------------------------------------------------------------------------


async def history(
    db: AsyncSession, user_id: UUID, timezone: str, start: date, end: date
) -> WakeHistoryOut:
    logs = list(
        await db.scalars(
            select(WakeLog)
            .where(WakeLog.user_id == user_id, WakeLog.date >= start, WakeLog.date <= end)
            .order_by(WakeLog.date.desc())
        )
    )
    alarm_ids = {lg.alarm_id for lg in logs if lg.alarm_id}
    labels: dict[UUID, str] = {}
    if alarm_ids:
        for alarm in await db.scalars(select(Alarm).where(Alarm.id.in_(alarm_ids))):
            labels[alarm.id] = alarm.label
    days: list[WakeHistoryDayOut] = []
    delays: list[int] = []
    for lg in logs:
        delay = None
        if lg.confirmed_at and lg.scheduled_at:
            delay = round((lg.confirmed_at - lg.scheduled_at).total_seconds() / 60)
            delays.append(delay)
        days.append(
            WakeHistoryDayOut(
                date=lg.date,
                label=labels.get(lg.alarm_id) if lg.alarm_id else None,
                scheduled_at=lg.scheduled_at,
                rang_at=lg.rang_at,
                confirmed_at=lg.confirmed_at,
                delay_minutes=delay,
                snooze_count=lg.snooze_count,
                status=lg.status,
            )
        )
    return WakeHistoryOut(
        start=start,
        end=end,
        days=days,
        confirmed=sum(1 for d in days if d.confirmed_at is not None),
        missed=sum(1 for d in days if d.status == WakeStatus.missed),
        average_delay_minutes=round(sum(delays) / len(delays)) if delays else None,
    )
