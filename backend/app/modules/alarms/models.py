import enum
from datetime import date, datetime
from uuid import UUID

from sqlalchemy import Date, DateTime, Enum, ForeignKey, SmallInteger, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, UUIDPrimaryKeyMixin


class WakeStatus(enum.StrEnum):
    pending = "pending"  # alarme disparou, ainda sem confirmação (Fase 6)
    confirmed = "confirmed"  # confirmado a partir do alarme (Fase 6)
    missed = "missed"  # alarme sem confirmação em 60 min (Fase 6)
    manual = "manual"  # confirmado pelo botão "Levantei" sem alarme


class WakeLog(Base, UUIDPrimaryKeyMixin):
    """Um registro de acordar por dia (dia no fuso do usuário).

    A coluna alarm_id (FK para alarms) entra na Fase 6, junto com a tabela alarms.
    """

    __tablename__ = "wake_logs"
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_wake_logs_user_date"),)

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rang_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    snooze_count: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    status: Mapped[WakeStatus] = mapped_column(
        Enum(WakeStatus, name="wake_status", native_enum=False, length=16), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
