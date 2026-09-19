import datetime as dt
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.modules.goals.models import GoalArea, GoalStatus

# --- Ações -------------------------------------------------------------------------------


class ActionIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    due_date: dt.date | None = None


class ActionUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    due_date: dt.date | None = None
    clear_due_date: bool = False
    is_done: bool | None = None


class ActionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    goal_id: UUID
    title: str
    due_date: dt.date | None
    is_done: bool
    done_at: dt.datetime | None
    sort_order: int


class ReorderIn(BaseModel):
    action_ids: list[UUID] = Field(min_length=1)


# --- Metas -------------------------------------------------------------------------------


class GoalIn(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=2000)
    area: GoalArea = GoalArea.personal
    deadline: dt.date | None = None


class GoalUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=2000)
    clear_description: bool = False
    area: GoalArea | None = None
    deadline: dt.date | None = None
    clear_deadline: bool = False
    status: GoalStatus | None = None


class GoalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str | None
    area: GoalArea
    deadline: dt.date | None
    status: GoalStatus
    completed_at: dt.datetime | None
    sort_order: int
    actions: list[ActionOut]
    actions_total: int
    actions_done: int
    progress_pct: int


# --- Dia ---------------------------------------------------------------------------------


class DayActionOut(BaseModel):
    id: UUID
    goal_id: UUID
    goal_title: str
    title: str
    due_date: dt.date
    is_done: bool
    done_at: dt.datetime | None


class GoalsDayOut(BaseModel):
    date: dt.date
    actions: list[DayActionOut]  # ações de metas ativas com data = dia
    overdue: list[DayActionOut]  # pendentes de dias anteriores
    planned: int
    completed: int
