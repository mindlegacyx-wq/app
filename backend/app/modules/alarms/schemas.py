import datetime as dt
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.modules.alarms.models import WakeStatus

AlarmSound = Literal["classic", "soft", "pulse"]


def _validate_days(days: list[int]) -> list[int]:
    if not days:
        raise ValueError("Escolha pelo menos um dia da semana.")
    if any(d < 0 or d > 6 for d in days):
        raise ValueError("Dia da semana inválido.")
    return sorted(set(days))


# --- Alarmes -----------------------------------------------------------------------------


class AlarmIn(BaseModel):
    label: str = Field(default="Acordar", min_length=1, max_length=40)
    time: dt.time
    days_of_week: list[int] = Field(default=[0, 1, 2, 3, 4, 5, 6])
    sound: AlarmSound = "classic"
    sound_file_id: UUID | None = None  # áudio do usuário; vence o som pronto
    insist: bool = True  # repete a notificação até confirmar
    requires_confirmation: bool = True
    max_snoozes: int = Field(default=1, ge=0, le=5)
    snooze_minutes: int = Field(default=5, ge=1, le=30)
    is_active: bool = True

    @field_validator("days_of_week")
    @classmethod
    def _days(cls, v: list[int]) -> list[int]:
        return _validate_days(v)

    @field_validator("time", mode="before")
    @classmethod
    def _strip_seconds(cls, v: object) -> object:
        return _strip_seconds(v)


class AlarmUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=40)
    time: dt.time | None = None
    days_of_week: list[int] | None = None
    sound: AlarmSound | None = None
    sound_file_id: UUID | None = None
    clear_sound_file: bool = False  # volta para o som pronto
    insist: bool | None = None
    requires_confirmation: bool | None = None
    max_snoozes: int | None = Field(default=None, ge=0, le=5)
    snooze_minutes: int | None = Field(default=None, ge=1, le=30)
    is_active: bool | None = None

    @field_validator("days_of_week")
    @classmethod
    def _days(cls, v: list[int] | None) -> list[int] | None:
        return _validate_days(v) if v is not None else None

    @field_validator("time", mode="before")
    @classmethod
    def _strip_seconds(cls, v: object) -> object:
        return _strip_seconds(v)


def _strip_seconds(v: object) -> object:
    """Alarme toca em minuto cheio: descarta segundos e microssegundos."""
    if isinstance(v, dt.time):
        return v.replace(second=0, microsecond=0)
    if isinstance(v, str) and len(v) > 5:
        return v[:5]
    return v


class AlarmOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    label: str
    time: dt.time
    days_of_week: list[int]
    sound: str
    sound_file_id: UUID | None = None
    insist: bool = True
    requires_confirmation: bool
    max_snoozes: int
    snooze_minutes: int
    is_active: bool
    next_ring_at: dt.datetime | None = None  # próximo toque deste alarme (UTC)
    created_at: dt.datetime


class NextRingOut(BaseModel):
    alarm_id: UUID
    label: str
    at: dt.datetime  # UTC
    sound: str


class AlarmsOut(BaseModel):
    alarms: list[AlarmOut]
    next: NextRingOut | None
    push_enabled: bool  # servidor tem chaves VAPID configuradas


# --- Acordar (wake) ----------------------------------------------------------------------


class WakeAlarmOut(BaseModel):
    """O alarme ligado ao registro do dia (o que a tela de alarme precisa saber)."""

    id: UUID
    label: str
    sound: str
    sound_file_id: UUID | None = None
    requires_confirmation: bool
    max_snoozes: int
    snooze_minutes: int


class WakeDayOut(BaseModel):
    date: dt.date
    scheduled_time: dt.time | None  # horário planejado (alarme do dia ou wake_time)
    scheduled_at: dt.datetime | None
    rang_at: dt.datetime | None
    next_ring_at: dt.datetime | None  # toque previsto depois de uma soneca
    confirmed_at: dt.datetime | None
    delay_minutes: int | None  # positivo = levantou depois do horário
    snooze_count: int
    status: WakeStatus | None  # None = ainda sem registro no dia
    alarm: WakeAlarmOut | None
    ringing: bool  # pendente e sem soneca em andamento → a tela de alarme deve tocar
    can_snooze: bool
    can_confirm: bool  # janela do "Levantei" manual aberta (ou alarme já tocou)
    can_undo: bool


class WakeConfirmIn(BaseModel):
    date: dt.date


class WakeRingIn(BaseModel):
    alarm_id: UUID


class WakeHistoryDayOut(BaseModel):
    date: dt.date
    label: str | None
    scheduled_at: dt.datetime | None
    rang_at: dt.datetime | None
    confirmed_at: dt.datetime | None
    delay_minutes: int | None
    snooze_count: int
    status: WakeStatus


class WakeHistoryOut(BaseModel):
    start: dt.date
    end: dt.date
    days: list[WakeHistoryDayOut]
    confirmed: int
    missed: int
    average_delay_minutes: int | None


# --- Áudio do usuário --------------------------------------------------------------------


class SoundOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    content_type: str
    size_bytes: int
    created_at: dt.datetime
