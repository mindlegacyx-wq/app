from datetime import datetime, time
from decimal import Decimal
from typing import Literal
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.schemas import Num


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
    passing_grade: Num
    periods_per_year: int
    grade_max: Num
    grade_mode: str  # "weighted" (média ponderada) ou "sum" (soma de pontos)
    grades_by_area: bool


class UserSettingsUpdate(BaseModel):
    discipline_target: int | None = Field(default=None, ge=50, le=100)
    week_starts_on: int | None = Field(default=None, ge=0, le=6)
    notifications_enabled: bool | None = None
    wake_time: time | None = None
    passing_grade: Decimal | None = Field(default=None, ge=0, le=100, decimal_places=2)
    periods_per_year: int | None = Field(default=None, ge=1, le=6)
    grade_max: Decimal | None = Field(default=None, gt=0, le=100, decimal_places=2)
    grade_mode: Literal["weighted", "sum"] | None = None
    grades_by_area: bool | None = None

    @model_validator(mode="after")
    def _passing_within_scale(self) -> "UserSettingsUpdate":
        if (
            self.passing_grade is not None
            and self.grade_max is not None
            and self.passing_grade > self.grade_max
        ):
            raise ValueError("A média mínima não pode passar da nota máxima.")
        return self


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


class PushKeys(BaseModel):
    p256dh: str = Field(min_length=1, max_length=512)
    auth: str = Field(min_length=1, max_length=256)


class PushSubscriptionIn(BaseModel):
    """Exatamente o `PushSubscription.toJSON()` do navegador."""

    endpoint: str = Field(min_length=1, max_length=2048)
    keys: PushKeys

    @field_validator("endpoint")
    @classmethod
    def _https(cls, v: str) -> str:
        if not v.startswith("https://"):
            raise ValueError("Endpoint de push inválido.")
        return v


class PushSubscriptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    endpoint: str
    created_at: datetime


class PushStatusOut(BaseModel):
    enabled: bool  # servidor tem chaves VAPID
    public_key: str | None
    subscriptions: int  # dispositivos deste usuário já assinados


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
