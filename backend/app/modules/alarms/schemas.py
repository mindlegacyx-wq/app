from datetime import date, datetime, time

from pydantic import BaseModel

from app.modules.alarms.models import WakeStatus


class WakeDayOut(BaseModel):
    date: date
    scheduled_time: time | None  # horário de acordar configurado (settings.wake_time)
    scheduled_at: datetime | None
    confirmed_at: datetime | None
    delay_minutes: int | None  # positivo = levantou depois do horário
    status: WakeStatus | None  # None = ainda sem registro no dia
    can_undo: bool


class WakeConfirmIn(BaseModel):
    date: date
