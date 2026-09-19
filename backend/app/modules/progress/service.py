"""Percentual de disciplina, sequência e fechamento do dia.

Como o número é calculado:
- Cada módulo diz o que estava **planejado** e o que foi **concluído** no dia: rotinas
  (itens das rotinas ativas daquele dia da semana), acordar (1 se há horário configurado),
  tarefas (planejadas para o dia, exceto canceladas), metas (ações de metas ativas com data
  no dia). Treino entra na Fase 5.
- Percentual = concluído ÷ planejado. Peso igual para tudo (decisão do fundador).
- Dia cumprido = planejado > 0 e percentual ≥ meta. **Dia sem nada planejado é 0% e quebra
  a sequência** (decisão do fundador: sem plano, sem disciplina).
- Sequência do dia D = sequência de D-1 + 1 se D cumprido; senão 0.

Ciclo de vida de um dia:
- Aberto: calculado ao vivo, sem linha em daily_scores.
- Fechado pelo usuário ("Fechar o dia"): linha com closed_by=user; pode reabrir até o corte.
- Finalizado pelo job (03:00 do dia seguinte): closed_by=system ou finalized_at preenchido;
  imutável. O job também preenche dias que ficaram para trás (autocura).
"""

from dataclasses import dataclass, field
from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dates import (
    ensure_recordable_day,
    is_day_open,
    last_finalizable_day,
    now_utc,
    user_today,
)
from app.core.errors import AppError, ConflictError
from app.modules.alarms import service as alarms_service
from app.modules.goals import service as goals_service
from app.modules.progress.models import ClosedBy, DailyScore
from app.modules.progress.schemas import ComponentOut, DayScoreOut, MissingItemOut
from app.modules.routines import service as routines_service
from app.modules.tasks import service as tasks_service
from app.modules.tasks.models import TaskStatus
from app.modules.users.models import User

MAX_BACKFILL_DAYS = 400


class DayNotClosableError(AppError):
    code = "day_not_closable"


@dataclass
class Snapshot:
    planned: int
    completed: int
    pct: int
    hit_target: bool
    target: int
    breakdown: dict[str, dict[str, int]]
    missing: list[dict[str, str]] = field(default_factory=list)


# --- Cálculo do dia ----------------------------------------------------------------------


async def compute_snapshot(db: AsyncSession, user: User, day: date) -> Snapshot:
    """Compõe o dia a partir dos serviços dos módulos. Nunca consulta tabelas alheias."""
    wake = await alarms_service.day_status(db, user.id, user.timezone, user.settings.wake_time, day)
    routines = await routines_service.day_overview(db, user.id, day)
    tasks = await tasks_service.day_overview(db, user.id, day)
    goals = await goals_service.day_overview(db, user.id, day)

    breakdown = {
        "wake": {
            "planned": 1 if wake.scheduled_time else 0,
            "completed": 1 if wake.confirmed_at else 0,
        },
        "routines": {"planned": routines.planned, "completed": routines.completed},
        "tasks": {"planned": tasks.planned, "completed": tasks.completed},
        "workout": {"planned": 0, "completed": 0},  # Fase 5
        "goals": {"planned": goals.planned, "completed": goals.completed},
    }
    planned = sum(c["planned"] for c in breakdown.values())
    completed = sum(c["completed"] for c in breakdown.values())
    pct = round(completed * 100 / planned) if planned else 0
    target = user.settings.discipline_target

    missing: list[dict[str, str]] = []
    if wake.scheduled_time and not wake.confirmed_at:
        missing.append({"kind": "wake", "title": "Confirmar que levantou"})
    for r in routines.routines:
        for item in r.items:
            if item.completed_at is None:
                missing.append({"kind": "routines", "title": f"{r.name}: {item.title}"})
    for t in tasks.tasks:
        if t.status == TaskStatus.pending:
            missing.append({"kind": "tasks", "title": t.title})
    for a in goals.actions:
        if not a.is_done:
            missing.append({"kind": "goals", "title": f"{a.goal_title}: {a.title}"})

    return Snapshot(
        planned=planned,
        completed=completed,
        pct=pct,
        hit_target=planned > 0 and pct >= target,
        target=target,
        breakdown=breakdown,
        missing=missing[:30],
    )


# --- Linhas fechadas ---------------------------------------------------------------------


async def _get_row(db: AsyncSession, user_id: UUID, day: date) -> DailyScore | None:
    return await db.scalar(
        select(DailyScore).where(DailyScore.user_id == user_id, DailyScore.date == day)
    )


async def _last_row_before(db: AsyncSession, user_id: UUID, day: date) -> DailyScore | None:
    return await db.scalar(
        select(DailyScore)
        .where(DailyScore.user_id == user_id, DailyScore.date < day)
        .order_by(DailyScore.date.desc())
        .limit(1)
    )


def _first_day(user: User) -> date:
    return user_today(user.timezone, user.created_at)


async def _streak_before(db: AsyncSession, user: User, day: date) -> int:
    """Sequência acumulada até o dia anterior a `day`.

    Garante que todos os dias finalizáveis antes de `day` têm linha; se o dia anterior ainda
    está aberto (só acontece para hoje antes do corte), calcula-o ao vivo.
    """
    prev = day - timedelta(days=1)
    if prev < _first_day(user):
        return 0
    await ensure_finalized_through(db, user, min(prev, last_finalizable_day(user.timezone)))
    row = await _get_row(db, user.id, prev)
    if row is not None:
        return row.streak_day
    # prev está aberto e sem fechamento manual: calcular ao vivo
    snap = await compute_snapshot(db, user, prev)
    return (await _streak_before(db, user, prev)) + 1 if snap.hit_target else 0


async def ensure_finalized_through(db: AsyncSession, user: User, through: date) -> int:
    """Cria (ou finaliza) as linhas de todos os dias até `through`. Idempotente.

    Devolve quantos dias foram finalizados nesta chamada.
    """
    start = _first_day(user)
    if through < start:
        return 0
    last = await _last_row_before(db, user.id, through + timedelta(days=1))
    # Recomeça do dia seguinte à última linha finalizada; linhas fechadas pelo usuário
    # mas ainda não finalizadas são finalizadas no caminho.
    cursor = start
    streak = 0
    if last is not None and last.finalized_at is not None:
        cursor = last.date + timedelta(days=1)
        streak = last.streak_day
    elif last is not None:
        cursor = last.date
        prev = await _last_row_before(db, user.id, last.date)
        streak = prev.streak_day if prev is not None else 0

    if (through - cursor).days > MAX_BACKFILL_DAYS:
        cursor = through - timedelta(days=MAX_BACKFILL_DAYS)
        streak = 0

    count = 0
    now = now_utc()
    while cursor <= through:
        row = await _get_row(db, user.id, cursor)
        if row is None:
            snap = await compute_snapshot(db, user, cursor)
            streak = streak + 1 if snap.hit_target else 0
            db.add(
                DailyScore(
                    user_id=user.id,
                    date=cursor,
                    planned_count=snap.planned,
                    completed_count=snap.completed,
                    discipline_pct=snap.pct,
                    target_pct=snap.target,
                    hit_target=snap.hit_target,
                    streak_day=streak,
                    breakdown={**snap.breakdown, "missing": snap.missing},
                    closed_at=now,
                    closed_by=ClosedBy.system,
                    finalized_at=now,
                )
            )
        else:
            # Fechado pelo usuário: mantém os números, só torna definitivo (recalcula a
            # sequência para o caso de a linha anterior ter mudado).
            streak = streak + 1 if row.hit_target else 0
            row.streak_day = streak
            if row.finalized_at is None:
                row.finalized_at = now
        count += 1
        cursor += timedelta(days=1)
    await db.flush()
    return count


# --- Leitura -----------------------------------------------------------------------------


async def _best_streak(db: AsyncSession, user_id: UUID) -> int:
    best = await db.scalar(
        select(func.coalesce(func.max(DailyScore.streak_day), 0)).where(
            DailyScore.user_id == user_id
        )
    )
    return int(best or 0)


def _to_out(
    day: date, snap: Snapshot, streak: int, best: int, row: DailyScore | None, timezone: str
) -> DayScoreOut:
    open_ = is_day_open(day, timezone)
    finalized = row is not None and (
        row.finalized_at is not None or row.closed_by == ClosedBy.system
    )
    return DayScoreOut(
        date=day,
        planned=snap.planned,
        completed=snap.completed,
        pct=snap.pct,
        target=snap.target,
        hit_target=snap.hit_target,
        streak=streak,
        best_streak=max(best, streak),
        breakdown={k: ComponentOut(**v) for k, v in snap.breakdown.items()},  # type: ignore[misc]
        missing=[MissingItemOut(**m) for m in snap.missing],  # type: ignore[arg-type]
        is_open=open_ and row is None,
        closed_at=row.closed_at if row else None,
        closed_by=row.closed_by if row else None,
        finalized=finalized,
        can_close=open_ and row is None and snap.planned > 0,
        can_reopen=row is not None and row.closed_by == ClosedBy.user and not finalized and open_,
    )


def _snapshot_from_row(row: DailyScore) -> Snapshot:
    bd = dict(row.breakdown)
    missing = bd.pop("missing", [])
    return Snapshot(
        planned=row.planned_count,
        completed=row.completed_count,
        pct=row.discipline_pct,
        hit_target=row.hit_target,
        target=row.target_pct,
        breakdown=bd,
        missing=missing,
    )


async def day_score(db: AsyncSession, user: User, day: date) -> DayScoreOut:
    # Mantém o histórico em dia a cada leitura (barato quando não há nada para fazer).
    await ensure_finalized_through(
        db, user, min(day - timedelta(days=1), last_finalizable_day(user.timezone))
    )
    row = await _get_row(db, user.id, day)
    best = await _best_streak(db, user.id)
    if row is not None:
        return _to_out(day, _snapshot_from_row(row), row.streak_day, best, row, user.timezone)
    snap = await compute_snapshot(db, user, day)
    streak = (await _streak_before(db, user, day)) + 1 if snap.hit_target else 0
    return _to_out(day, snap, streak, best, None, user.timezone)


# --- Fechar / reabrir --------------------------------------------------------------------


async def close_day(db: AsyncSession, user: User, day: date) -> DayScoreOut:
    ensure_recordable_day(day, user.timezone)
    if await _get_row(db, user.id, day) is not None:
        raise ConflictError("Esse dia já está fechado.")
    snap = await compute_snapshot(db, user, day)
    if snap.planned == 0:
        raise DayNotClosableError("Não há nada planejado para fechar neste dia.")
    streak = (await _streak_before(db, user, day)) + 1 if snap.hit_target else 0
    db.add(
        DailyScore(
            user_id=user.id,
            date=day,
            planned_count=snap.planned,
            completed_count=snap.completed,
            discipline_pct=snap.pct,
            target_pct=snap.target,
            hit_target=snap.hit_target,
            streak_day=streak,
            breakdown={**snap.breakdown, "missing": snap.missing},
            closed_at=now_utc(),
            closed_by=ClosedBy.user,
            finalized_at=None,
        )
    )
    await db.flush()
    return await day_score(db, user, day)


async def reopen_day(db: AsyncSession, user: User, day: date) -> DayScoreOut:
    row = await _get_row(db, user.id, day)
    if row is None:
        raise ConflictError("Esse dia não está fechado.")
    if (
        row.closed_by != ClosedBy.user
        or row.finalized_at is not None
        or not is_day_open(day, user.timezone)
    ):
        raise ConflictError("Esse dia já foi finalizado e não pode ser reaberto.")
    await db.delete(row)
    await db.flush()
    return await day_score(db, user, day)


# --- Job ---------------------------------------------------------------------------------


async def finalize_due_days_for_user(db: AsyncSession, user: User) -> int:
    return await ensure_finalized_through(db, user, last_finalizable_day(user.timezone))
