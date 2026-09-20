import datetime as dt
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.schemas import Num
from app.modules.workouts.models import LoadMode, SessionStatus


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
    # Fase 16 — vindos da biblioteca (ou escolhidos à mão)
    library_key: str | None = Field(default=None, max_length=40)
    muscle: str | None = Field(default=None, max_length=12)
    icon: str | None = Field(default=None, max_length=12)
    load_mode: LoadMode | None = None
    bar_weight: float | None = Field(default=None, ge=0, le=100)
    increment: float | None = Field(default=None, gt=0, le=50)
    goal: str | None = Field(default=None, max_length=12)
    start_weight: float | None = Field(default=None, ge=0, le=999)


class ExerciseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    sets: int | None = Field(default=None, ge=1, le=50)
    reps: str | None = Field(default=None, max_length=20)
    load: str | None = Field(default=None, max_length=20)
    rest_seconds: int | None = Field(default=None, ge=5, le=900)
    load_mode: LoadMode | None = None
    bar_weight: float | None = Field(default=None, ge=0, le=100)
    increment: float | None = Field(default=None, gt=0, le=50)
    goal: str | None = Field(default=None, max_length=12)
    start_weight: float | None = Field(default=None, ge=0, le=999)
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
    library_key: str | None = None
    muscle: str | None = None
    icon: str | None = None
    load_mode: LoadMode = LoadMode.total
    bar_weight: Num = Decimal("0")
    increment: Num = Decimal("2.5")
    goal: str | None = None
    start_weight: Num | None = None


class ReorderIn(BaseModel):
    exercise_ids: list[UUID] = Field(min_length=1)


# --- Planos ------------------------------------------------------------------------------


class WorkoutIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    goal: str | None = Field(default=None, max_length=12)
    days_of_week: list[int] = Field(default=[0, 2, 4])
    notes: str | None = Field(default=None, max_length=1000)

    @field_validator("days_of_week")
    @classmethod
    def _days(cls, v: list[int]) -> list[int]:
        return _validate_days(v)


class WorkoutUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    goal: str | None = Field(default=None, max_length=12)
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
    goal: str | None = None
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
    duration_seconds: int | None = None


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
    """Uma rota só para mexer na sessão: estado, anotação e o cronômetro do treino."""

    status: SessionStatus | None = None
    notes: str | None = Field(default=None, max_length=1000)
    duration_seconds: int | None = Field(default=None, ge=0, le=86_400)


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


# --- Séries, carga e peso corporal (Fase 16) ---------------------------------------------


class SetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    exercise_id: UUID
    set_number: int
    weight: Num | None
    reps: int | None
    seconds: int | None
    done: bool


class SetIn(BaseModel):
    """Série nova (o botão "+ série" na tela do treino)."""

    exercise_id: UUID
    weight: float | None = Field(default=None, ge=0, le=999)
    reps: int | None = Field(default=None, ge=0, le=999)
    seconds: int | None = Field(default=None, ge=0, le=7200)


class SetUpdate(BaseModel):
    weight: float | None = Field(default=None, ge=0, le=999)
    reps: int | None = Field(default=None, ge=0, le=999)
    seconds: int | None = Field(default=None, ge=0, le=7200)
    done: bool | None = None
    clear_weight: bool = False


class PreviousSetOut(BaseModel):
    weight: Num | None
    reps: int | None
    seconds: int | None


class ExerciseProgressOut(BaseModel):
    """O que a tela mostra acima das séries: o que você fez da última vez e o convite a subir."""

    exercise_id: UUID
    last_date: dt.date | None
    last_sets: list[PreviousSetOut]
    best_weight: Num | None
    best_date: dt.date | None
    suggested_weight: Num | None  # sugestão de carga para hoje
    should_increase: bool  # fechou tudo da última vez


class SessionExerciseOut(BaseModel):
    exercise: ExerciseOut
    sets: list[SetOut]
    progress: ExerciseProgressOut


class SessionDetailOut(BaseModel):
    id: UUID
    workout_id: UUID
    workout_name: str
    date: dt.date
    status: SessionStatus
    started_at: dt.datetime | None
    completed_at: dt.datetime | None
    duration_seconds: int | None
    notes: str | None
    editable: bool
    exercises: list[SessionExerciseOut]
    total_volume: Num  # soma de peso × reps das séries feitas
    done_sets: int
    planned_sets: int


class LibraryExerciseOut(BaseModel):
    key: str
    name: str
    muscle: str
    icon: str
    load_mode: LoadMode
    bar_weight: float
    increment: float
    rest: int


class LibraryGroupOut(BaseModel):
    muscle: str
    label: str
    exercises: list[LibraryExerciseOut]


class GoalOut(BaseModel):
    key: str
    label: str
    hint: str
    reps: str
    sets: int
    rest: int


class LibraryOut(BaseModel):
    groups: list[LibraryGroupOut]
    goals: list[GoalOut]


class BodyWeightIn(BaseModel):
    weight: float = Field(gt=20, le=400)
    date: dt.date | None = None


class BodyWeightOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    date: dt.date
    weight: Num


class BodyWeightHistoryOut(BaseModel):
    entries: list[BodyWeightOut]
    latest: Num | None
    change_30d: Num | None  # diferença para o registro mais próximo de 30 dias atrás


class ExerciseHistoryPointOut(BaseModel):
    date: dt.date
    best_weight: Num | None
    total_volume: Num
    sets: list[PreviousSetOut]


class ExerciseHistoryOut(BaseModel):
    exercise_id: UUID
    name: str
    points: list[ExerciseHistoryPointOut]
