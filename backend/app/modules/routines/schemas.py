from datetime import date, datetime, time
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.modules.routines.models import RoutineKind


def _validate_days(days: list[int]) -> list[int]:
    if not days:
        raise ValueError("Escolha pelo menos um dia da semana.")
    if any(d < 0 or d > 6 for d in days):
        raise ValueError("Dia da semana inválido.")
    return sorted(set(days))


# --- Itens -------------------------------------------------------------------------------


class RoutineItemIn(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    duration_minutes: int | None = Field(default=None, ge=1, le=600)


class RoutineItemUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=80)
    duration_minutes: int | None = Field(default=None, ge=1, le=600)
    is_active: bool | None = None


class RoutineItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    duration_minutes: int | None
    sort_order: int
    is_active: bool


class ReorderIn(BaseModel):
    item_ids: list[UUID] = Field(min_length=1)


# --- Rotinas -----------------------------------------------------------------------------


class RoutineIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    kind: RoutineKind = RoutineKind.custom
    start_time: time | None = None
    days_of_week: list[int] = Field(default=[0, 1, 2, 3, 4, 5, 6])

    @field_validator("days_of_week")
    @classmethod
    def _days(cls, v: list[int]) -> list[int]:
        return _validate_days(v)


class RoutineUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    start_time: time | None = None
    days_of_week: list[int] | None = None
    is_active: bool | None = None

    @field_validator("days_of_week")
    @classmethod
    def _days(cls, v: list[int] | None) -> list[int] | None:
        return _validate_days(v) if v is not None else None


class RoutineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    kind: RoutineKind
    start_time: time | None
    days_of_week: list[int]
    is_active: bool
    sort_order: int
    items: list[RoutineItemOut]


# --- Dia ---------------------------------------------------------------------------------


class DayItemOut(BaseModel):
    id: UUID
    title: str
    duration_minutes: int | None
    completed_at: datetime | None


class DayRoutineOut(BaseModel):
    id: UUID
    name: str
    kind: RoutineKind
    start_time: time | None
    items: list[DayItemOut]
    planned: int
    completed: int


class DayOut(BaseModel):
    date: date
    routines: list[DayRoutineOut]
    planned: int
    completed: int


class CheckIn(BaseModel):
    date: date
    done: bool = True
