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
    Integer,
    LargeBinary,
    SmallInteger,
    String,
    Time,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin

# Sons prontos: chaves sintetizadas no app pela Web Audio API (sem arquivo de áudio).
ALARM_SOUNDS = ("classic", "soft", "pulse")

# Áudio do usuário: pequeno de propósito (é um despertador, não uma biblioteca).
MAX_SOUND_BYTES = 5 * 1024 * 1024
MAX_SOUNDS_PER_USER = 5
ALLOWED_AUDIO = {
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/aac": "aac",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/webm": "webm",
}


class AlarmSoundFile(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Áudio que o usuário subiu para usar como alarme.

    Fica no banco (bytea) e não em disco: no plano gratuito do Render o disco some a cada
    publicação. Poucos megabytes, e assim o som acompanha o usuário em qualquer aparelho.
    """

    __tablename__ = "alarm_sounds"
    __table_args__ = (Index("ix_alarm_sounds_user_id_created_at", "user_id", "created_at"),)

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    content_type: Mapped[str] = mapped_column(String(40), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)


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
    # Quando preenchido, toca o áudio do usuário no lugar do som pronto.
    sound_file_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("alarm_sounds.id", ondelete="SET NULL"), nullable=True
    )
    # Repetir a notificação a cada minuto até confirmar (com o app fechado).
    insist: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
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
    # Último envio de notificação deste toque: segura a insistência em um por minuto.
    last_push_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[WakeStatus] = mapped_column(
        Enum(WakeStatus, name="wake_status", native_enum=False, length=16), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
