"""Regras dos treinos.

- Um plano ativo com pelo menos um exercício e com o dia da semana marcado **está planejado**
  naquele dia. Cada plano conta como 1 no percentual (não cada exercício).
- A sessão nasce ao iniciar o treino (ou ao marcar o primeiro exercício). Uma por plano por dia.
- **Concluído** = sessão com status completed. Pular registra a decisão (Hoje deixa de cobrar),
  mas continua contando como planejado e não concluído: o número é honesto.
- Sessões só podem ser criadas/alteradas em dia aberto (hoje, ou ontem antes do corte).
"""

import re
from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dates import ensure_recordable_day, is_day_open, now_utc, user_today, weekday_index
from app.core.errors import ConflictError, NotFoundError
from app.core.softdelete import TrashKind
from app.modules.workouts.library import CATALOG, GOALS, GOALS_BY_KEY, MUSCLES
from app.modules.workouts.models import (
    BodyWeight,
    LoadMode,
    SessionStatus,
    Workout,
    WorkoutExercise,
    WorkoutSession,
    WorkoutSessionExercise,
    WorkoutSet,
)
from app.modules.workouts.schemas import (
    BodyWeightHistoryOut,
    BodyWeightIn,
    BodyWeightOut,
    DayExerciseOut,
    DayWorkoutOut,
    ExerciseHistoryOut,
    ExerciseHistoryPointOut,
    ExerciseIn,
    ExerciseOut,
    ExerciseProgressOut,
    ExerciseUpdate,
    GoalOut,
    HistoryItemOut,
    HistoryOut,
    LibraryExerciseOut,
    LibraryGroupOut,
    LibraryOut,
    PreviousSetOut,
    SessionDetailOut,
    SessionExerciseOut,
    SessionOut,
    SetIn,
    SetOut,
    SetUpdate,
    WorkoutIn,
    WorkoutsDayOut,
    WorkoutUpdate,
)

# --- Consultas ---------------------------------------------------------------------------


def _alive_workouts(user_id: UUID):
    return (
        select(Workout)
        .where(Workout.user_id == user_id, Workout.deleted_at.is_(None))
        .options(selectinload(Workout.exercises.and_(WorkoutExercise.deleted_at.is_(None))))
        .order_by(Workout.sort_order, Workout.created_at)
    )


async def list_workouts(db: AsyncSession, user_id: UUID) -> list[Workout]:
    return list((await db.scalars(_alive_workouts(user_id))).unique())


async def get_workout(db: AsyncSession, user_id: UUID, workout_id: UUID) -> Workout:
    w = (
        (await db.scalars(_alive_workouts(user_id).where(Workout.id == workout_id)))
        .unique()
        .one_or_none()
    )
    if w is None:
        raise NotFoundError("Treino não encontrado.")
    return w


async def _get_exercise(db: AsyncSession, user_id: UUID, exercise_id: UUID) -> WorkoutExercise:
    e = await db.scalar(
        select(WorkoutExercise).where(
            WorkoutExercise.id == exercise_id,
            WorkoutExercise.user_id == user_id,
            WorkoutExercise.deleted_at.is_(None),
        )
    )
    if e is None:
        raise NotFoundError("Exercício não encontrado.")
    return e


async def _get_session(db: AsyncSession, user_id: UUID, session_id: UUID) -> WorkoutSession:
    s = await db.scalar(
        select(WorkoutSession).where(
            WorkoutSession.id == session_id, WorkoutSession.user_id == user_id
        )
    )
    if s is None:
        raise NotFoundError("Sessão não encontrada.")
    return s


# --- Planos ------------------------------------------------------------------------------


async def create_workout(db: AsyncSession, user_id: UUID, data: WorkoutIn) -> Workout:
    next_order = await db.scalar(
        select(func.coalesce(func.max(Workout.sort_order), -1) + 1).where(
            Workout.user_id == user_id
        )
    )
    w = Workout(
        user_id=user_id,
        name=data.name,
        days_of_week=data.days_of_week,
        notes=data.notes,
        goal=data.goal,
        is_active=True,
        sort_order=next_order or 0,
    )
    db.add(w)
    await db.flush()
    return await get_workout(db, user_id, w.id)


async def update_workout(
    db: AsyncSession, user_id: UUID, workout_id: UUID, data: WorkoutUpdate
) -> Workout:
    w = await get_workout(db, user_id, workout_id)
    for field, value in data.model_dump(exclude_unset=True, exclude={"clear_notes"}).items():
        if value is not None:
            setattr(w, field, value)
    if data.clear_notes:
        w.notes = None
    await db.flush()
    return w


async def ensure_days(
    db: AsyncSession, user_id: UUID, workout_id: UUID, weekdays: list[int]
) -> Workout:
    """Garante que o plano acontece nesses dias (usado quando a agenda marca um treino).

    O plano continua sendo a fonte de verdade de "em que dias eu treino" (é o que entra no
    percentual e na tela Hoje); a agenda só acrescenta o horário. Marcar um treino num dia em
    que o plano não existia é o usuário dizendo que passou a treinar nesse dia.
    """
    w = await get_workout(db, user_id, workout_id)
    missing = [d for d in weekdays if d not in w.days_of_week]
    if missing:
        w.days_of_week = sorted({*w.days_of_week, *missing})
        await db.flush()
    return w


async def delete_workout(db: AsyncSession, user_id: UUID, workout_id: UUID) -> None:
    w = await get_workout(db, user_id, workout_id)
    w.deleted_at = now_utc()
    await db.flush()


# --- Exercícios --------------------------------------------------------------------------


async def add_exercise(
    db: AsyncSession, user_id: UUID, workout_id: UUID, data: ExerciseIn
) -> WorkoutExercise:
    """Cria o exercício. Vindo da biblioteca, herda ícone, modo de carga, barra e descanso."""
    w = await get_workout(db, user_id, workout_id)
    next_order = max((e.sort_order for e in w.exercises), default=-1) + 1
    from app.modules.workouts.library import BY_KEY

    preset = BY_KEY.get(data.library_key or "")
    goal = GOALS_BY_KEY.get(data.goal or w.goal or "")
    e = WorkoutExercise(
        workout_id=w.id,
        user_id=user_id,
        name=data.name,
        sets=data.sets or (goal.sets if goal else None),
        reps=data.reps or (goal.reps if goal else None),
        load=data.load,
        rest_seconds=data.rest_seconds
        or (goal.rest if goal else None)
        or (preset.rest if preset else None),
        sort_order=next_order,
        goal=data.goal or w.goal,
        start_weight=Decimal(str(data.start_weight)) if data.start_weight is not None else None,
        library_key=data.library_key,
        muscle=data.muscle or (preset.muscle if preset else None),
        icon=data.icon or (preset.icon if preset else None),
        load_mode=LoadMode(data.load_mode or (preset.load_mode if preset else LoadMode.total)),
        bar_weight=Decimal(
            str(
                data.bar_weight
                if data.bar_weight is not None
                else (preset.bar_weight if preset else 0)
            )
        ),
        increment=Decimal(
            str(
                data.increment
                if data.increment is not None
                else (preset.increment if preset else 2.5)
            )
        ),
    )
    db.add(e)
    await db.flush()
    return e


async def update_exercise(
    db: AsyncSession, user_id: UUID, exercise_id: UUID, data: ExerciseUpdate
) -> WorkoutExercise:
    e = await _get_exercise(db, user_id, exercise_id)
    for field, value in data.model_dump(exclude_unset=True, exclude={"clear"}).items():
        if value is None:
            continue
        if field in ("bar_weight", "increment", "start_weight"):
            value = Decimal(str(value))
        setattr(e, field, value)
    for field in data.clear:
        if field in ("sets", "reps", "load", "rest_seconds", "start_weight"):
            setattr(e, field, None)
    await db.flush()
    return e


async def delete_exercise(db: AsyncSession, user_id: UUID, exercise_id: UUID) -> None:
    e = await _get_exercise(db, user_id, exercise_id)
    e.deleted_at = now_utc()
    await db.flush()


async def reorder_exercises(
    db: AsyncSession, user_id: UUID, workout_id: UUID, exercise_ids: list[UUID]
) -> Workout:
    w = await get_workout(db, user_id, workout_id)
    by_id = {e.id: e for e in w.exercises}
    if set(exercise_ids) != set(by_id):
        raise ConflictError("A lista de exercícios está desatualizada. Recarregue e tente de novo.")
    for position, eid in enumerate(exercise_ids):
        by_id[eid].sort_order = position
    await db.flush()
    w.exercises.sort(key=lambda e: e.sort_order)
    return w


# --- Dia ---------------------------------------------------------------------------------


async def workouts_for_day(db: AsyncSession, user_id: UUID, day: date) -> list[Workout]:
    weekday = weekday_index(day)
    return [
        w
        for w in await list_workouts(db, user_id)
        if w.is_active and weekday in w.days_of_week and w.exercises
    ]


async def _sessions_for_day(
    db: AsyncSession, user_id: UUID, day: date
) -> dict[UUID, WorkoutSession]:
    rows = await db.scalars(
        select(WorkoutSession).where(WorkoutSession.user_id == user_id, WorkoutSession.date == day)
    )
    return {s.workout_id: s for s in rows}


def _day_workout(w: Workout, s: WorkoutSession | None) -> DayWorkoutOut:
    done_ids = {x.exercise_id for x in (s.exercises if s else []) if x.completed}
    exercises = [
        DayExerciseOut(
            id=e.id,
            name=e.name,
            sets=e.sets,
            reps=e.reps,
            load=e.load,
            rest_seconds=e.rest_seconds,
            completed=e.id in done_ids,
        )
        for e in w.exercises
    ]
    return DayWorkoutOut(
        workout_id=w.id,
        name=w.name,
        exercises=exercises,
        exercises_done=sum(1 for e in exercises if e.completed),
        session=SessionOut.model_validate(s) if s else None,
    )


async def day_overview(db: AsyncSession, user_id: UUID, day: date) -> WorkoutsDayOut:
    planned = await workouts_for_day(db, user_id, day)
    sessions = await _sessions_for_day(db, user_id, day)
    # Sessões de planos fora do dia da semana (treino extra) também aparecem no dia.
    extra_ids = [wid for wid in sessions if wid not in {w.id for w in planned}]
    extras = []
    if extra_ids:
        rows = await db.scalars(_alive_workouts(user_id).where(Workout.id.in_(extra_ids)))
        extras = list(rows.unique())
    items = [_day_workout(w, sessions.get(w.id)) for w in [*planned, *extras]]
    return WorkoutsDayOut(
        date=day,
        workouts=items,
        planned=len(items),
        completed=sum(
            1 for i in items if i.session and i.session.status == SessionStatus.completed
        ),
    )


# --- Sessões -----------------------------------------------------------------------------


async def start_session(
    db: AsyncSession, user_id: UUID, timezone: str, workout_id: UUID, day: date
) -> WorkoutSession:
    """Idempotente: devolve a sessão do dia se já existe."""
    ensure_recordable_day(day, timezone)
    w = await get_workout(db, user_id, workout_id)
    existing = await db.scalar(
        select(WorkoutSession).where(WorkoutSession.workout_id == w.id, WorkoutSession.date == day)
    )
    if existing is not None:
        return existing
    s = WorkoutSession(
        user_id=user_id,
        workout_id=w.id,
        date=day,
        status=SessionStatus.in_progress,
        started_at=now_utc(),
    )
    db.add(s)
    await db.flush()
    await db.refresh(s)
    return s


async def set_exercise_done(
    db: AsyncSession,
    user_id: UUID,
    timezone: str,
    session_id: UUID,
    exercise_id: UUID,
    completed: bool,
) -> WorkoutSession:
    s = await _get_session(db, user_id, session_id)
    ensure_recordable_day(s.date, timezone)
    e = await _get_exercise(db, user_id, exercise_id)
    if e.workout_id != s.workout_id:
        raise ConflictError("Esse exercício não pertence a este treino.")
    row = next((x for x in s.exercises if x.exercise_id == e.id), None)
    if row is None:
        row = WorkoutSessionExercise(session_id=s.id, exercise_id=e.id, completed=False)
        db.add(row)
        s.exercises.append(row)
    row.completed = completed
    row.completed_at = now_utc() if completed else None
    if s.status != SessionStatus.in_progress and completed:
        # Marcar algo depois de pular/concluir reabre a sessão: o registro reflete o que houve.
        s.status = SessionStatus.in_progress
        s.completed_at = None
    await db.flush()
    return s


async def set_session_status(
    db: AsyncSession,
    user_id: UUID,
    timezone: str,
    session_id: UUID,
    status: SessionStatus | None,
    notes: str | None,
    duration_seconds: int | None = None,
) -> WorkoutSession:
    s = await _get_session(db, user_id, session_id)
    ensure_recordable_day(s.date, timezone)
    if status is not None:
        s.status = status
        s.completed_at = now_utc() if status == SessionStatus.completed else None
    if notes is not None:
        s.notes = notes
    if duration_seconds is not None:
        s.duration_seconds = duration_seconds
    await db.flush()
    return s


# --- Histórico ---------------------------------------------------------------------------


async def history(db: AsyncSession, user_id: UUID, start: date, end: date) -> HistoryOut:
    rows = (
        await db.execute(
            select(WorkoutSession, Workout.name)
            .join(Workout, Workout.id == WorkoutSession.workout_id)
            .where(
                WorkoutSession.user_id == user_id,
                WorkoutSession.date >= start,
                WorkoutSession.date <= end,
                WorkoutSession.status != SessionStatus.in_progress,
            )
            .order_by(WorkoutSession.date.desc())
        )
    ).all()
    totals: dict[UUID, int] = {}
    if rows:
        counts = await db.execute(
            select(WorkoutExercise.workout_id, func.count())
            .where(
                WorkoutExercise.workout_id.in_({s.workout_id for s, _ in rows}),
                WorkoutExercise.deleted_at.is_(None),
            )
            .group_by(WorkoutExercise.workout_id)
        )
        totals = {wid: n for wid, n in counts.all()}
    return HistoryOut(
        start=start,
        end=end,
        items=[
            HistoryItemOut(
                date=s.date,
                workout_id=s.workout_id,
                workout_name=name,
                status=s.status,
                exercises_done=sum(1 for x in s.exercises if x.completed),
                exercises_total=totals.get(s.workout_id, 0),
            )
            for s, name in rows
        ],
    )


# --- Lixeira -----------------------------------------------------------------------------


def _workout_has_sessions(model: type[Workout]):
    return select(WorkoutSession.id).where(WorkoutSession.workout_id == model.id).exists()


def _exercise_has_history(model: type[WorkoutExercise]):
    return (
        select(WorkoutSessionExercise.exercise_id)
        .where(WorkoutSessionExercise.exercise_id == model.id)
        .exists()
    )


TRASH_KINDS = [
    TrashKind(
        kind="workout",
        label="Treinos",
        model=Workout,
        title=lambda w: w.name,
        history=_workout_has_sessions,
    ),
    TrashKind(
        kind="exercise",
        label="Exercícios",
        model=WorkoutExercise,
        title=lambda e: e.name,
        parent=(Workout, "workout_id"),
        history=_exercise_has_history,
    ),
]


# --- Carga por série, progressão e peso corporal (Fase 16) -------------------------------


def reps_top(text: str | None) -> int | None:
    """Topo da faixa de repetições: "8-12" → 12, "12" → 12, "30s" → None."""
    if not text:
        return None
    numbers = [int(n) for n in re.findall(r"\d+", text)]
    if not numbers or "s" in text.lower().replace("séries", "").replace("series", ""):
        return None
    return max(numbers)


def real_weight(exercise: WorkoutExercise, typed: Decimal | float | None) -> Decimal | None:
    """Converte o que foi digitado em peso real. "20 de cada lado" numa barra de 20 = 60 kg."""
    if typed is None:
        return None
    value = Decimal(str(typed))
    if exercise.load_mode == LoadMode.per_side:
        return value * 2 + Decimal(exercise.bar_weight or 0)
    return value


async def _last_session_sets(
    db: AsyncSession, user_id: UUID, exercise_id: UUID, before: date
) -> tuple[date | None, list[WorkoutSet]]:
    """Séries feitas na última vez que este exercício foi treinado antes de `before`."""
    row = await db.execute(
        select(WorkoutSession.date)
        .join(WorkoutSet, WorkoutSet.session_id == WorkoutSession.id)
        .where(
            WorkoutSet.user_id == user_id,
            WorkoutSet.exercise_id == exercise_id,
            WorkoutSet.done.is_(True),
            WorkoutSession.date < before,
        )
        .order_by(WorkoutSession.date.desc())
        .limit(1)
    )
    day = row.scalar_one_or_none()
    if day is None:
        return None, []
    sets = list(
        await db.scalars(
            select(WorkoutSet)
            .join(WorkoutSession, WorkoutSession.id == WorkoutSet.session_id)
            .where(
                WorkoutSet.user_id == user_id,
                WorkoutSet.exercise_id == exercise_id,
                WorkoutSet.done.is_(True),
                WorkoutSession.date == day,
            )
            .order_by(WorkoutSet.set_number)
        )
    )
    return day, sets


async def exercise_progress(
    db: AsyncSession, user_id: UUID, exercise: WorkoutExercise, day: date
) -> ExerciseProgressOut:
    """Carga anterior, recorde e a sugestão de hoje.

    A regra da sugestão é conservadora de propósito: só convida a subir quando **todas** as
    séries da última vez bateram o topo da faixa de repetições. Subir carga sem ter fechado o
    número é como marcar item que não fez.
    """
    last_date, last = await _last_session_sets(db, user_id, exercise.id, day)
    best = await db.execute(
        select(WorkoutSet.weight, WorkoutSession.date)
        .join(WorkoutSession, WorkoutSession.id == WorkoutSet.session_id)
        .where(
            WorkoutSet.user_id == user_id,
            WorkoutSet.exercise_id == exercise.id,
            WorkoutSet.done.is_(True),
            WorkoutSet.weight.is_not(None),
        )
        .order_by(WorkoutSet.weight.desc(), WorkoutSession.date.desc())
        .limit(1)
    )
    best_row = best.first()
    top = reps_top(exercise.reps)
    last_weight = max((s.weight for s in last if s.weight is not None), default=None)
    closed_everything = bool(
        last and top and all(s.reps is not None and s.reps >= top for s in last)
    )
    suggested = last_weight if last_weight is not None else exercise.start_weight
    if closed_everything and last_weight is not None:
        suggested = last_weight + Decimal(exercise.increment or 0)
    return ExerciseProgressOut(
        exercise_id=exercise.id,
        last_date=last_date,
        last_sets=[PreviousSetOut(weight=s.weight, reps=s.reps, seconds=s.seconds) for s in last],
        best_weight=best_row[0] if best_row else None,
        best_date=best_row[1] if best_row else None,
        suggested_weight=suggested,
        should_increase=closed_everything,
    )


async def ensure_sets(db: AsyncSession, user_id: UUID, session: WorkoutSession) -> None:
    """Cria as séries planejadas do treino, já preenchidas com o da última vez.

    Idempotente: exercício que já tem série não é tocado (não sobrescreve o que o usuário fez).
    """
    workout = await get_workout(db, user_id, session.workout_id)
    existing = {(s.exercise_id, s.set_number) for s in session.sets}
    for exercise in workout.exercises:
        if exercise.deleted_at is not None:
            continue
        planned = exercise.sets or 3
        progress = await exercise_progress(db, user_id, exercise, session.date)
        top = reps_top(exercise.reps)
        for number in range(1, planned + 1):
            if (exercise.id, number) in existing:
                continue
            previous = (
                progress.last_sets[number - 1]
                if len(progress.last_sets) >= number
                else (progress.last_sets[-1] if progress.last_sets else None)
            )
            db.add(
                WorkoutSet(
                    user_id=user_id,
                    session_id=session.id,
                    exercise_id=exercise.id,
                    exercise_sort=exercise.sort_order,
                    set_number=number,
                    weight=progress.suggested_weight,
                    reps=(previous.reps if previous else top),
                    seconds=previous.seconds if previous else None,
                    done=False,
                )
            )
    await db.flush()
    await db.refresh(session)


async def _get_set(db: AsyncSession, user_id: UUID, set_id: UUID) -> WorkoutSet:
    row = await db.scalar(
        select(WorkoutSet).where(WorkoutSet.id == set_id, WorkoutSet.user_id == user_id)
    )
    if row is None:
        raise NotFoundError("Série não encontrada.")
    return row


async def add_set(
    db: AsyncSession, user_id: UUID, timezone: str, session_id: UUID, data: SetIn
) -> WorkoutSet:
    session = await _get_session(db, user_id, session_id)
    ensure_recordable_day(session.date, timezone)
    exercise = await _get_exercise(db, user_id, data.exercise_id)
    if exercise.workout_id != session.workout_id:
        raise ConflictError("Esse exercício não pertence a este treino.")
    last_number = max(
        (s.set_number for s in session.sets if s.exercise_id == exercise.id), default=0
    )
    row = WorkoutSet(
        user_id=user_id,
        session_id=session.id,
        exercise_id=exercise.id,
        exercise_sort=exercise.sort_order,
        set_number=last_number + 1,
        weight=Decimal(str(data.weight)) if data.weight is not None else None,
        reps=data.reps,
        seconds=data.seconds,
        done=False,
    )
    db.add(row)
    await db.flush()
    return row


async def update_set(
    db: AsyncSession, user_id: UUID, timezone: str, set_id: UUID, data: SetUpdate
) -> WorkoutSet:
    row = await _get_set(db, user_id, set_id)
    session = await _get_session(db, user_id, row.session_id)
    ensure_recordable_day(session.date, timezone)
    if data.weight is not None:
        row.weight = Decimal(str(data.weight))
    if data.clear_weight:
        row.weight = None
    if data.reps is not None:
        row.reps = data.reps
    if data.seconds is not None:
        row.seconds = data.seconds
    if data.done is not None:
        row.done = data.done
        row.completed_at = now_utc() if data.done else None
        # Marcar série mantém a sessão viva (o dia conta o treino como feito no fechamento).
        if data.done and session.status != SessionStatus.in_progress:
            session.status = SessionStatus.in_progress
            session.completed_at = None
        await _sync_exercise_flag(db, session, row.exercise_id)
    await db.flush()
    return row


async def _sync_exercise_flag(db: AsyncSession, session: WorkoutSession, exercise_id: UUID) -> None:
    """Exercício com todas as séries feitas conta como concluído na visão do dia.

    Sem isso, a tela Hoje e a tela do treino contariam coisas diferentes — e o número do dia
    deixaria de bater com o que a pessoa fez.
    """
    await db.flush()
    sets = [s for s in session.sets if s.exercise_id == exercise_id]
    complete = bool(sets) and all(s.done for s in sets)
    row = next((x for x in session.exercises if x.exercise_id == exercise_id), None)
    if row is None:
        row = WorkoutSessionExercise(
            session_id=session.id, exercise_id=exercise_id, completed=False
        )
        db.add(row)
        session.exercises.append(row)
    if row.completed != complete:
        row.completed = complete
        row.completed_at = now_utc() if complete else None


async def delete_set(db: AsyncSession, user_id: UUID, timezone: str, set_id: UUID) -> None:
    row = await _get_set(db, user_id, set_id)
    session = await _get_session(db, user_id, row.session_id)
    ensure_recordable_day(session.date, timezone)
    await db.delete(row)
    await db.flush()


async def session_detail(
    db: AsyncSession, user_id: UUID, timezone: str, session_id: UUID
) -> SessionDetailOut:
    session = await _get_session(db, user_id, session_id)
    workout = await get_workout(db, user_id, session.workout_id)
    await ensure_sets(db, user_id, session)
    by_exercise: dict[UUID, list[WorkoutSet]] = {}
    for row in session.sets:
        by_exercise.setdefault(row.exercise_id, []).append(row)

    items: list[SessionExerciseOut] = []
    volume = Decimal(0)
    done = planned = 0
    for exercise in workout.exercises:
        if exercise.deleted_at is not None:
            continue
        rows = sorted(by_exercise.get(exercise.id, []), key=lambda r: r.set_number)
        planned += len(rows)
        for row in rows:
            if row.done:
                done += 1
                if row.weight is not None and row.reps:
                    volume += row.weight * row.reps
        items.append(
            SessionExerciseOut(
                exercise=ExerciseOut.model_validate(exercise),
                sets=[SetOut.model_validate(r) for r in rows],
                progress=await exercise_progress(db, user_id, exercise, session.date),
            )
        )

    return SessionDetailOut(
        id=session.id,
        workout_id=workout.id,
        workout_name=workout.name,
        date=session.date,
        status=session.status,
        started_at=session.started_at,
        completed_at=session.completed_at,
        duration_seconds=session.duration_seconds,
        notes=session.notes,
        editable=is_day_open(session.date, timezone),
        exercises=items,
        total_volume=volume,
        done_sets=done,
        planned_sets=planned,
    )


async def exercise_history(
    db: AsyncSession, user_id: UUID, exercise_id: UUID, limit: int = 12
) -> ExerciseHistoryOut:
    exercise = await _get_exercise(db, user_id, exercise_id)
    rows = list(
        await db.execute(
            select(WorkoutSet, WorkoutSession.date)
            .join(WorkoutSession, WorkoutSession.id == WorkoutSet.session_id)
            .where(
                WorkoutSet.user_id == user_id,
                WorkoutSet.exercise_id == exercise_id,
                WorkoutSet.done.is_(True),
            )
            .order_by(WorkoutSession.date.desc(), WorkoutSet.set_number)
        )
    )
    by_day: dict[date, list[WorkoutSet]] = {}
    for row, day in rows:
        by_day.setdefault(day, []).append(row)
    points = []
    for day in sorted(by_day)[-limit:]:
        sets = by_day[day]
        best = max((s.weight for s in sets if s.weight is not None), default=None)
        total = sum(
            (s.weight * s.reps for s in sets if s.weight is not None and s.reps), Decimal(0)
        )
        points.append(
            ExerciseHistoryPointOut(
                date=day,
                best_weight=best,
                total_volume=total,
                sets=[
                    PreviousSetOut(weight=s.weight, reps=s.reps, seconds=s.seconds) for s in sets
                ],
            )
        )
    return ExerciseHistoryOut(exercise_id=exercise.id, name=exercise.name, points=points)


# --- Peso corporal -----------------------------------------------------------------------


async def set_body_weight(
    db: AsyncSession, user_id: UUID, timezone: str, data: BodyWeightIn
) -> BodyWeight:
    day = data.date or user_today(timezone)
    row = await db.scalar(
        select(BodyWeight).where(BodyWeight.user_id == user_id, BodyWeight.date == day)
    )
    if row is None:
        row = BodyWeight(user_id=user_id, date=day, weight=Decimal(str(data.weight)))
        db.add(row)
    else:
        row.weight = Decimal(str(data.weight))
    await db.flush()
    return row


async def body_weight_history(
    db: AsyncSession, user_id: UUID, timezone: str, days: int = 180
) -> BodyWeightHistoryOut:
    today = user_today(timezone)
    start = today - timedelta(days=days)
    rows = list(
        await db.scalars(
            select(BodyWeight)
            .where(BodyWeight.user_id == user_id, BodyWeight.date >= start)
            .order_by(BodyWeight.date)
        )
    )
    latest = rows[-1].weight if rows else None
    change = None
    if latest is not None:
        target = today - timedelta(days=30)
        older = [r for r in rows if r.date <= target]
        reference = older[-1] if older else (rows[0] if len(rows) > 1 else None)
        if reference is not None and reference.date != rows[-1].date:
            change = latest - reference.weight
    return BodyWeightHistoryOut(
        entries=[BodyWeightOut.model_validate(r) for r in rows],
        latest=latest,
        change_30d=change,
    )


async def delete_body_weight(db: AsyncSession, user_id: UUID, day: date) -> None:
    row = await db.scalar(
        select(BodyWeight).where(BodyWeight.user_id == user_id, BodyWeight.date == day)
    )
    if row is not None:
        await db.delete(row)
        await db.flush()


def library() -> LibraryOut:
    groups = []
    for muscle, label in MUSCLES:
        items = [
            LibraryExerciseOut(
                key=e.key,
                name=e.name,
                muscle=e.muscle,
                icon=e.icon,
                load_mode=LoadMode(e.load_mode),
                bar_weight=e.bar_weight,
                increment=e.increment,
                rest=e.rest,
            )
            for e in CATALOG
            if e.muscle == muscle
        ]
        groups.append(LibraryGroupOut(muscle=muscle, label=label, exercises=items))
    goals = [
        GoalOut(key=g.key, label=g.label, hint=g.hint, reps=g.reps, sets=g.sets, rest=g.rest)
        for g in GOALS
    ]
    return LibraryOut(groups=groups, goals=goals)
