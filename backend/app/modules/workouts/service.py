"""Regras dos treinos.

- Um plano ativo com pelo menos um exercício e com o dia da semana marcado **está planejado**
  naquele dia. Cada plano conta como 1 no percentual (não cada exercício).
- A sessão nasce ao iniciar o treino (ou ao marcar o primeiro exercício). Uma por plano por dia.
- **Concluído** = sessão com status completed. Pular registra a decisão (Hoje deixa de cobrar),
  mas continua contando como planejado e não concluído: o número é honesto.
- Sessões só podem ser criadas/alteradas em dia aberto (hoje, ou ontem antes do corte).
"""

from datetime import date
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dates import ensure_recordable_day, now_utc, weekday_index
from app.core.errors import ConflictError, NotFoundError
from app.core.softdelete import TrashKind
from app.modules.workouts.models import (
    SessionStatus,
    Workout,
    WorkoutExercise,
    WorkoutSession,
    WorkoutSessionExercise,
)
from app.modules.workouts.schemas import (
    DayExerciseOut,
    DayWorkoutOut,
    ExerciseIn,
    ExerciseUpdate,
    HistoryItemOut,
    HistoryOut,
    SessionOut,
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


async def delete_workout(db: AsyncSession, user_id: UUID, workout_id: UUID) -> None:
    w = await get_workout(db, user_id, workout_id)
    w.deleted_at = now_utc()
    await db.flush()


# --- Exercícios --------------------------------------------------------------------------


async def add_exercise(
    db: AsyncSession, user_id: UUID, workout_id: UUID, data: ExerciseIn
) -> WorkoutExercise:
    w = await get_workout(db, user_id, workout_id)
    next_order = max((e.sort_order for e in w.exercises), default=-1) + 1
    e = WorkoutExercise(
        workout_id=w.id,
        user_id=user_id,
        name=data.name,
        sets=data.sets,
        reps=data.reps,
        load=data.load,
        rest_seconds=data.rest_seconds,
        sort_order=next_order,
    )
    db.add(e)
    await db.flush()
    return e


async def update_exercise(
    db: AsyncSession, user_id: UUID, exercise_id: UUID, data: ExerciseUpdate
) -> WorkoutExercise:
    e = await _get_exercise(db, user_id, exercise_id)
    for field, value in data.model_dump(exclude_unset=True, exclude={"clear"}).items():
        if value is not None:
            setattr(e, field, value)
    for field in data.clear:
        if field in ("sets", "reps", "load", "rest_seconds"):
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
    status: SessionStatus,
    notes: str | None,
) -> WorkoutSession:
    s = await _get_session(db, user_id, session_id)
    ensure_recordable_day(s.date, timezone)
    s.status = status
    s.completed_at = now_utc() if status == SessionStatus.completed else None
    if notes is not None:
        s.notes = notes
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
