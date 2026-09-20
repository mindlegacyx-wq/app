import enum
from datetime import date, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    SmallInteger,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ClosedBy(enum.StrEnum):
    user = "user"  # "Fechar o dia" na tela; pode reabrir até o job finalizar
    system = "system"  # job das 03:00; definitivo


class DailyScore(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Fotografia de um dia fechado. Dias abertos são calculados ao vivo e não têm linha."""

    __tablename__ = "daily_scores"
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_daily_scores_user_date"),)

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    planned_count: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    completed_count: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    discipline_pct: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    target_pct: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # meta vigente no dia
    hit_target: Mapped[bool] = mapped_column(Boolean, nullable=False)
    streak_day: Mapped[int] = mapped_column(Integer, nullable=False)  # 0 quando não bateu
    # XP do dia (Fase 13). Derivado de breakdown/pct/sequência; ver app/modules/player/xp.py.
    xp: Mapped[int | None] = mapped_column(Integer)
    breakdown: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    closed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    closed_by: Mapped[ClosedBy] = mapped_column(
        Enum(ClosedBy, name="closed_by", native_enum=False, length=8), nullable=False
    )
    finalized_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
