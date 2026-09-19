import datetime as dt
from typing import Literal

from pydantic import BaseModel

from app.modules.progress.models import ClosedBy

Component = Literal["wake", "routines", "tasks", "workout", "goals", "study"]


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


# --- Evolução (Fase 7) -------------------------------------------------------------------


class HistoryDayOut(BaseModel):
    date: dt.date
    planned: int
    completed: int
    pct: int
    target: int
    hit_target: bool
    streak: int
    closed_by: ClosedBy | None  # None = dia aberto, calculado ao vivo
    finalized: bool
    live: bool  # calculado agora, ainda pode mudar


class HistoryOut(BaseModel):
    start: dt.date
    end: dt.date
    first_day: dt.date  # dia em que a conta foi criada (fuso do usuário)
    days: list[HistoryDayOut]


class AreaOut(BaseModel):
    kind: Component
    planned: int
    completed: int
    pct: int | None  # None = nada planejado no período


class WindowOut(BaseModel):
    days: int  # tamanho da janela pedida (7 ou 30)
    tracked: int  # dias com registro dentro da janela
    average_pct: int | None
    hit_days: int


class SummaryOut(BaseModel):
    today: dt.date
    first_day: dt.date
    streak: int  # sequência contando hoje (igual à tela Hoje)
    streak_before_today: int  # sequência acumulada até ontem
    best_streak: int
    today_hit: bool
    week: WindowOut
    month: WindowOut
    areas: list[AreaOut]  # últimos 30 dias fechados
    closed_days: int  # total de dias com registro desde o início
