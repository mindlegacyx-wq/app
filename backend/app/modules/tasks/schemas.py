import datetime as dt
import re
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.modules.tasks.models import TaskPriority, TaskStatus

_HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


def _validate_color(value: str) -> str:
    if not _HEX.match(value):
        raise ValueError("Cor inválida. Use o formato #RRGGBB.")
    return value.upper()


# --- Categorias --------------------------------------------------------------------------


class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    color: str

    @field_validator("color")
    @classmethod
    def _color(cls, v: str) -> str:
        return _validate_color(v)


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=40)
    color: str | None = None

    @field_validator("color")
    @classmethod
    def _color(cls, v: str | None) -> str | None:
        return _validate_color(v) if v is not None else None


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    color: str
    sort_order: int


# --- Tarefas -----------------------------------------------------------------------------


class TaskIn(BaseModel):
    title: str = Field(min_length=1, max_length=140)
    notes: str | None = Field(default=None, max_length=2000)
    date: dt.date | None = None  # padrão: hoje no fuso do usuário
    priority: TaskPriority = TaskPriority.medium
    category_id: UUID | None = None


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=140)
    notes: str | None = Field(default=None, max_length=2000)
    date: dt.date | None = None
    priority: TaskPriority | None = None
    category_id: UUID | None = None
    status: TaskStatus | None = None
    # Distingue "não mexer na categoria" de "remover a categoria".
    clear_category: bool = False
    clear_notes: bool = False


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    notes: str | None
    date: dt.date
    priority: TaskPriority
    status: TaskStatus
    category_id: UUID | None
    recurrence_id: UUID | None  # veio de uma tarefa fixa
    completed_at: dt.datetime | None
    sort_order: int


class TasksDayOut(BaseModel):
    date: dt.date
    tasks: list[TaskOut]  # planejadas para o dia (pendentes, feitas e canceladas)
    overdue: list[TaskOut]  # pendentes de dias anteriores
    planned: int  # exclui canceladas
    completed: int


# --- Tarefas fixas (a regra, não a tarefa do dia) -----------------------------------------


def _validate_days(value: list[int]) -> list[int]:
    if not value:
        raise ValueError("Escolha pelo menos um dia da semana.")
    days = sorted(set(value))
    if any(d < 0 or d > 6 for d in days):
        raise ValueError("Dia da semana inválido.")
    return days


class RecurrenceIn(BaseModel):
    title: str = Field(min_length=1, max_length=140)
    notes: str | None = Field(default=None, max_length=2000)
    days_of_week: list[int]
    priority: TaskPriority = TaskPriority.medium
    category_id: UUID | None = None

    @field_validator("days_of_week")
    @classmethod
    def _days(cls, v: list[int]) -> list[int]:
        return _validate_days(v)


class RecurrenceUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=140)
    notes: str | None = Field(default=None, max_length=2000)
    days_of_week: list[int] | None = None
    priority: TaskPriority | None = None
    category_id: UUID | None = None
    is_active: bool | None = None
    clear_category: bool = False
    clear_notes: bool = False

    @field_validator("days_of_week")
    @classmethod
    def _days(cls, v: list[int] | None) -> list[int] | None:
        return _validate_days(v) if v is not None else None


class RecurrenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    notes: str | None
    days_of_week: list[int]
    priority: TaskPriority
    category_id: UUID | None
    is_active: bool
    start_date: dt.date
    sort_order: int
