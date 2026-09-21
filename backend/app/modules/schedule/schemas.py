import datetime as dt
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.modules.schedule.models import SUBJECT_COLORS, BlockKind


def _validate_days(days: list[int]) -> list[int]:
    if not days:
        raise ValueError("Escolha pelo menos um dia da semana.")
    if any(d < 0 or d > 6 for d in days):
        raise ValueError("Dia da semana inválido.")
    return sorted(set(days))


def _minute(v: object) -> object:
    if isinstance(v, dt.time):
        return v.replace(second=0, microsecond=0)
    if isinstance(v, str) and len(v) > 5:
        return v[:5]
    return v


# --- Matérias ----------------------------------------------------------------------------


class SubjectIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    color: str = Field(default=SUBJECT_COLORS[1], pattern=r"^#[0-9A-Fa-f]{6}$")
    teacher: str | None = Field(default=None, max_length=60)


class SubjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    teacher: str | None = Field(default=None, max_length=60)
    clear_teacher: bool = False
    is_active: bool | None = None


class SubjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    color: str
    teacher: str | None
    is_active: bool
    sort_order: int
    area_id: UUID | None = None  # área de conhecimento nas notas (Fase 21)
    grade_entry_mode: str = "final"


# --- Blocos ------------------------------------------------------------------------------


class BlockIn(BaseModel):
    title: str = Field(min_length=1, max_length=60)
    kind: BlockKind = BlockKind.class_
    subject_id: UUID | None = None
    workout_id: UUID | None = None
    weekdays: list[int] = Field(min_length=1)
    start_time: dt.time
    end_time: dt.time
    location: str | None = Field(default=None, max_length=60)

    @field_validator("weekdays")
    @classmethod
    def _days(cls, v: list[int]) -> list[int]:
        return _validate_days(v)

    @field_validator("start_time", "end_time", mode="before")
    @classmethod
    def _min(cls, v: object) -> object:
        return _minute(v)

    @model_validator(mode="after")
    def _order(self) -> "BlockIn":
        if self.end_time <= self.start_time:
            raise ValueError("O fim precisa ser depois do início.")
        return self


class BlockUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=60)
    kind: BlockKind | None = None
    subject_id: UUID | None = None
    clear_subject: bool = False
    workout_id: UUID | None = None
    clear_workout: bool = False
    weekday: int | None = Field(default=None, ge=0, le=6)
    start_time: dt.time | None = None
    end_time: dt.time | None = None
    location: str | None = Field(default=None, max_length=60)
    clear_location: bool = False
    is_active: bool | None = None

    @field_validator("start_time", "end_time", mode="before")
    @classmethod
    def _min(cls, v: object) -> object:
        return _minute(v)


class BlockOut(BaseModel):
    id: UUID
    title: str
    kind: BlockKind
    subject_id: UUID | None
    subject_name: str | None
    subject_color: str | None
    workout_id: UUID | None
    weekday: int
    start_time: dt.time
    end_time: dt.time
    duration_minutes: int
    location: str | None
    is_active: bool


class WeekDayOut(BaseModel):
    weekday: int
    blocks: list[BlockOut]
    total_minutes: int


class WeekOut(BaseModel):
    days: list[WeekDayOut]  # sempre 7, segunda a domingo
    subjects: list[SubjectOut]


class WindowOut(BaseModel):
    start: dt.time
    end: dt.time
    minutes: int


class DayOut(BaseModel):
    date: dt.date
    weekday: int
    blocks: list[BlockOut]
    free: list[WindowOut]  # janelas livres entre blocos (dentro do dia útil)


class CopyDayIn(BaseModel):
    to_weekdays: list[int] = Field(min_length=1)

    @field_validator("to_weekdays")
    @classmethod
    def _days(cls, v: list[int]) -> list[int]:
        return _validate_days(v)


class CopyDayOut(BaseModel):
    created: int
    skipped: int  # conflitos de horário no destino
