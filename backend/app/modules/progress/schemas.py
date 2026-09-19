import datetime as dt
from typing import Literal

from pydantic import BaseModel

from app.modules.progress.models import ClosedBy

Component = Literal["wake", "routines", "tasks", "workout", "goals"]


class ComponentOut(BaseModel):
    planned: int
    completed: int


class MissingItemOut(BaseModel):
    kind: Component
    title: str


class DayScoreOut(BaseModel):
    date: dt.date
    planned: int
    completed: int
    pct: int
    target: int
    hit_target: bool
    streak: int  # sequência contando este dia (0 se não bateu ou dia vazio)
    best_streak: int
    breakdown: dict[Component, ComponentOut]
    missing: list[MissingItemOut]
    is_open: bool  # ainda aceita registros (hoje, ou ontem antes do corte)
    closed_at: dt.datetime | None
    closed_by: ClosedBy | None
    finalized: bool
    can_close: bool
    can_reopen: bool


class DayRef(BaseModel):
    date: dt.date
