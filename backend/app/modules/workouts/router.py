from datetime import date, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, status

from app.core.dates import user_today
from app.core.deps import DB, CurrentUser
from app.core.errors import AppError
from app.modules.workouts import service
from app.modules.workouts.schemas import (
    BodyWeightHistoryOut,
    BodyWeightIn,
    BodyWeightOut,
    ExerciseHistoryOut,
    ExerciseIn,
    ExerciseOut,
    ExerciseUpdate,
    HistoryOut,
    LibraryOut,
    ReorderIn,
    SessionDetailOut,
    SessionExerciseIn,
    SessionOut,
    SessionStartIn,
    SessionStatusIn,
    SetIn,
    SetOut,
    SetUpdate,
    WorkoutIn,
    WorkoutOut,
    WorkoutsDayOut,
    WorkoutUpdate,
)

router = APIRouter(prefix="/workouts", tags=["workouts"])

# Rotas de um segmento só vêm ANTES de /{workout_id}, senão o FastAPI tenta ler
# "library" como UUID do plano.


@router.get("/library", response_model=LibraryOut)
async def library(user: CurrentUser) -> LibraryOut:
    """Catálogo de exercícios prontos, agrupado por músculo."""
    return service.library()


@router.get("/body-weight", response_model=BodyWeightHistoryOut)
async def body_weight(
    user: CurrentUser,
    db: DB,
    days: Annotated[int, Query(ge=7, le=1095)] = 180,
) -> BodyWeightHistoryOut:
    return await service.body_weight_history(db, user.id, user.timezone, days)


@router.post("/body-weight", response_model=BodyWeightOut, status_code=status.HTTP_201_CREATED)
async def set_body_weight(data: BodyWeightIn, user: CurrentUser, db: DB) -> BodyWeightOut:
    row = await service.set_body_weight(db, user.id, user.timezone, data)
    await db.commit()
    return BodyWeightOut.model_validate(row)


# --- Dia, histórico, exercícios e sessões (antes de /{workout_id}) ------------------------


@router.get("/day", response_model=WorkoutsDayOut)
async def day(
    user: CurrentUser,
    db: DB,
    on: Annotated[date | None, Query(alias="date")] = None,
) -> WorkoutsDayOut:
    return await service.day_overview(db, user.id, on or user_today(user.timezone))


@router.get("/history", response_model=HistoryOut)
async def history(
    user: CurrentUser,
    db: DB,
    start: Annotated[date | None, Query()] = None,
    end: Annotated[date | None, Query()] = None,
) -> HistoryOut:
    end_ = end or user_today(user.timezone)
    start_ = start or (end_ - timedelta(days=41))
    if start_ > end_ or (end_ - start_).days > 366:
        raise AppError("Período inválido (máximo de 366 dias).")
    return await service.history(db, user.id, start_, end_)


@router.patch("/exercises/{exercise_id}", response_model=ExerciseOut)
async def update_exercise(
    exercise_id: UUID, data: ExerciseUpdate, user: CurrentUser, db: DB
) -> ExerciseOut:
    e = await service.update_exercise(db, user.id, exercise_id, data)
    await db.commit()
    return ExerciseOut.model_validate(e)


@router.delete("/exercises/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_exercise(exercise_id: UUID, user: CurrentUser, db: DB) -> None:
    await service.delete_exercise(db, user.id, exercise_id)
    await db.commit()


@router.put(
    "/sessions/{session_id}/exercises/{exercise_id}",
    response_model=SessionOut,
)
async def set_exercise_done(
    session_id: UUID, exercise_id: UUID, data: SessionExerciseIn, user: CurrentUser, db: DB
) -> SessionOut:
    s = await service.set_exercise_done(
        db, user.id, user.timezone, session_id, exercise_id, data.completed
    )
    await db.commit()
    return SessionOut.model_validate(s)


@router.patch("/sessions/{session_id}", response_model=SessionOut)
async def set_session_status(
    session_id: UUID, data: SessionStatusIn, user: CurrentUser, db: DB
) -> SessionOut:
    s = await service.set_session_status(
        db, user.id, user.timezone, session_id, data.status, data.notes, data.duration_seconds
    )
    await db.commit()
    return SessionOut.model_validate(s)


# --- Planos ------------------------------------------------------------------------------


@router.get("", response_model=list[WorkoutOut])
async def list_workouts(user: CurrentUser, db: DB) -> list[WorkoutOut]:
    return [WorkoutOut.model_validate(w) for w in await service.list_workouts(db, user.id)]


@router.post("", response_model=WorkoutOut, status_code=status.HTTP_201_CREATED)
async def create_workout(data: WorkoutIn, user: CurrentUser, db: DB) -> WorkoutOut:
    w = await service.create_workout(db, user.id, data)
    await db.commit()
    return WorkoutOut.model_validate(w)


@router.get("/{workout_id}", response_model=WorkoutOut)
async def get_workout(workout_id: UUID, user: CurrentUser, db: DB) -> WorkoutOut:
    return WorkoutOut.model_validate(await service.get_workout(db, user.id, workout_id))


@router.patch("/{workout_id}", response_model=WorkoutOut)
async def update_workout(
    workout_id: UUID, data: WorkoutUpdate, user: CurrentUser, db: DB
) -> WorkoutOut:
    w = await service.update_workout(db, user.id, workout_id, data)
    await db.commit()
    return WorkoutOut.model_validate(w)


@router.delete("/{workout_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workout(workout_id: UUID, user: CurrentUser, db: DB) -> None:
    await service.delete_workout(db, user.id, workout_id)
    await db.commit()


@router.post(
    "/{workout_id}/exercises", response_model=ExerciseOut, status_code=status.HTTP_201_CREATED
)
async def add_exercise(
    workout_id: UUID, data: ExerciseIn, user: CurrentUser, db: DB
) -> ExerciseOut:
    e = await service.add_exercise(db, user.id, workout_id, data)
    await db.commit()
    return ExerciseOut.model_validate(e)


@router.put("/{workout_id}/exercises/order", response_model=WorkoutOut)
async def reorder_exercises(
    workout_id: UUID, data: ReorderIn, user: CurrentUser, db: DB
) -> WorkoutOut:
    w = await service.reorder_exercises(db, user.id, workout_id, data.exercise_ids)
    await db.commit()
    return WorkoutOut.model_validate(w)


@router.post("/{workout_id}/sessions", response_model=SessionOut)
async def start_session(
    workout_id: UUID, data: SessionStartIn, user: CurrentUser, db: DB
) -> SessionOut:
    s = await service.start_session(db, user.id, user.timezone, workout_id, data.date)
    await db.commit()
    return SessionOut.model_validate(s)


# --- Carga por série, biblioteca e peso corporal (Fase 16) -------------------------------
@router.get("/sessions/{session_id}", response_model=SessionDetailOut)
async def session_detail(session_id: UUID, user: CurrentUser, db: DB) -> SessionDetailOut:
    out = await service.session_detail(db, user.id, user.timezone, session_id)
    await db.commit()
    return out


@router.post(
    "/sessions/{session_id}/sets", response_model=SetOut, status_code=status.HTTP_201_CREATED
)
async def add_set(session_id: UUID, data: SetIn, user: CurrentUser, db: DB) -> SetOut:
    row = await service.add_set(db, user.id, user.timezone, session_id, data)
    await db.commit()
    return SetOut.model_validate(row)


@router.patch("/sets/{set_id}", response_model=SetOut)
async def update_set(set_id: UUID, data: SetUpdate, user: CurrentUser, db: DB) -> SetOut:
    row = await service.update_set(db, user.id, user.timezone, set_id, data)
    await db.commit()
    return SetOut.model_validate(row)


@router.delete("/sets/{set_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_set(set_id: UUID, user: CurrentUser, db: DB) -> None:
    await service.delete_set(db, user.id, user.timezone, set_id)
    await db.commit()


@router.get("/exercises/{exercise_id}/history", response_model=ExerciseHistoryOut)
async def exercise_history(
    exercise_id: UUID,
    user: CurrentUser,
    db: DB,
    limit: Annotated[int, Query(ge=1, le=60)] = 12,
) -> ExerciseHistoryOut:
    return await service.exercise_history(db, user.id, exercise_id, limit)


@router.delete("/body-weight/{day}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_body_weight(day: date, user: CurrentUser, db: DB) -> None:
    await service.delete_body_weight(db, user.id, day)
    await db.commit()
