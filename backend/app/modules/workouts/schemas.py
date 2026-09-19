import datetime as dt
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.modules.workouts.models import SessionStatus


def _validate_days(days: list[int]) -> list[int]:
    if not days:
        raise ValueError("Escolha pelo menos um dia da semana.")
    if any(d < 0 or d > 6 for d in days):
        raise ValueError("Dia da semana inválido.")
    return sorted(set(days))


# --- Exercícios --------------------------------------------------------------------------


class ExerciseIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    sets: int | None = Field(default=None, ge=1, le=50)
    reps: str | None = Field(default=None, max_length=20)
    load: str | None = Field(default=None, max_length=20)
    rest_seconds: int | None = Field(default=None, ge=5, le=900)


class ExerciseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    sets: int | None = Field(default=None, ge=1, le=50)
    reps: str | None = Field(default=None, max_length=20)
    load: str | None = Field(default=None, max_length=20)
    rest_seconds: int | None = Field(default=None, ge=5, le=900)
    clear: list[str] = Field(
        default_factory=list
    )  # campos a limpar: sets, reps, load, rest_seconds


class ExerciseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    sets: int | None
    reps: str | None
    load: str | None
    rest_seconds: int | None
    sort_order: int


class ReorderIn(BaseModel):
    exercise_ids: list[UUID] = Field(min_length=1)


# --- Planos ------------------------------------------------------------------------------


class WorkoutIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    days_of_week: list[int] = Field(default=[0, 2, 4])
    notes: str | None = Field(default=None, max_length=1000)

    @field_validator("days_of_week")
    @classmethod
    def _days(cls, v: list[int]) -> list[int]:
        return _validate_days(v)


class WorkoutUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    days_of_week: list[int] | None = None
    notes: str | None = Field(default=None, max_length=1000)
    clear_notes: bool = False
    is_active: bool | None = None

    @field_validator("days_of_week")
    @classmethod
    def _days(cls, v: list[int] | None) -> list[int] | None:
        return _validate_days(v) if v is not None else None


class WorkoutOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    days_of_week: list[int]
    notes: str | None
    is_active: bool
    sort_order: int
    exercises: list[ExerciseOut]


# --- Sessões / dia -----------------------------------------------------------------------


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workout_id: UUID
    date: dt.date
    status: SessionStatus
    started_at: dt.datetime | None
    completed_at: dt.datetime | None
    notes: str | None


class DayExerciseOut(BaseModel):
    id: UUID
    name: str
    sets: int | None
    reps: str | None
    load: str | None
    rest_seconds: int | None
    completed: bool


class DayWorkoutOut(BaseModel):
    workout_id: UUID
    name: str
    exercises: list[DayExerciseOut]
    exercises_done: int
    session: SessionOut | None


class WorkoutsDayOut(BaseModel):
    date: dt.date
    workouts: list[DayWorkoutOut]
    planned: int
    completed: int


class SessionStartIn(BaseModel):
    date: dt.date


class SessionExerciseIn(BaseModel):
    completed: bool = True


class SessionStatusIn(BaseModel):
    status: SessionStatus
    notes: str | None = Field(default=None, max_length=1000)


class HistoryItemOut(BaseModel):
    date: dt.date
    workout_id: UUID
    workout_name: str
    status: SessionStatus
    exercises_done: int
    exercises_total: int


class HistoryOut(BaseModel):
    start: dt.date
    end: dt.date
    items: list[HistoryItemOut]
