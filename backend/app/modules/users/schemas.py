from datetime import datetime, time
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator


def validate_timezone(value: str) -> str:
    try:
        ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise ValueError("Fuso horário inválido.") from exc
    return value


class UserSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    discipline_target: int
    week_starts_on: int
    notifications_enabled: bool
    wake_time: time | None
    onboarding_completed_at: datetime | None


class UserSettingsUpdate(BaseModel):
    discipline_target: int | None = Field(default=None, ge=50, le=100)
    week_starts_on: int | None = Field(default=None, ge=0, le=6)
    notifications_enabled: bool | None = None
    wake_time: time | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    name: str
    timezone: str
    created_at: datetime
    settings: UserSettingsOut


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    timezone: str | None = None

    @field_validator("timezone")
    @classmethod
    def _tz(cls, v: str | None) -> str | None:
        return validate_timezone(v) if v is not None else None


class OnboardingComplete(BaseModel):
    """Payload do setup inicial (tela 3)."""

    name: str = Field(min_length=1, max_length=80)
    timezone: str
    wake_time: time
    discipline_target: int = Field(ge=50, le=100)

    @field_validator("timezone")
    @classmethod
    def _tz(cls, v: str) -> str:
        return validate_timezone(v)
