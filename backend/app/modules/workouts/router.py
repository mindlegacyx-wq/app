from datetime import date, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, status

from app.core.dates import user_today
from app.core.deps import DB, CurrentUser
from app.core.errors import AppError
from app.modules.workouts import service
from app.modules.workouts.schemas import (
    ExerciseIn,
    ExerciseOut,
    ExerciseUpdate,
    HistoryOut,
    ReorderIn,
    SessionExerciseIn,
    SessionOut,
    SessionStartIn,
    SessionStatusIn,
    WorkoutIn,
    WorkoutOut,
    WorkoutsDayOut,
    WorkoutUpdate,
)

router = APIRouter(prefix="/workouts", tags=["workouts"])


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
        db, user.id, user.timezone, session_id, data.status, data.notes
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
