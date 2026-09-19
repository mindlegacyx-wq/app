import enum
from datetime import date, datetime, time
from uuid import UUID

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    Time,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin

# Sons disponíveis: chaves sintetizadas no app pela Web Audio API (sem arquivo de áudio).
ALARM_SOUNDS = ("classic", "soft", "pulse")


class Alarm(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    """Um alarme recorrente por dias da semana, no fuso do usuário."""

    __tablename__ = "alarms"
    __table_args__ = (Index("ix_alarms_user_id_time", "user_id", "time"),)

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    label: Mapped[str] = mapped_column(String(40), nullable=False)
    time: Mapped[time] = mapped_column(Time, nullable=False)
    days_of_week: Mapped[list[int]] = mapped_column(ARRAY(SmallInteger), nullable=False)
    sound: Mapped[str] = mapped_column(String(40), nullable=False, default="classic")
    requires_confirmation: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    max_snoozes: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    snooze_minutes: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=5)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class WakeStatus(enum.StrEnum):
    pending = "pending"  # alarme disparou, ainda sem confirmação
    confirmed = "confirmed"  # confirmado a partir do alarme (tela de alarme ou notificação)
    missed = "missed"  # alarme sem confirmação em 60 min
    manual = "manual"  # confirmado pelo botão "Levantei" sem alarme (ou depois de perdido)


class WakeLog(Base, UUIDPrimaryKeyMixin):
    """Um registro de acordar por dia (dia no fuso do usuário)."""

    __tablename__ = "wake_logs"
    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_wake_logs_user_date"),
        Index("ix_wake_logs_status_next_ring_at", "status", "next_ring_at"),
    )

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    alarm_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("alarms.id", ondelete="SET NULL"), nullable=True
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rang_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Próximo toque previsto (depois de uma soneca). NULL quando não há toque pendente.
    next_ring_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    snooze_count: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    status: Mapped[WakeStatus] = mapped_column(
        Enum(WakeStatus, name="wake_status", native_enum=False, length=16), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
