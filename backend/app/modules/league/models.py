import enum
from datetime import date, datetime
from uuid import UUID

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, SmallInteger, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Tier(enum.StrEnum):
    bronze = "bronze"
    silver = "silver"
    gold = "gold"
    platinum = "platinum"
    diamond = "diamond"


ORDER: tuple[Tier, ...] = (Tier.bronze, Tier.silver, Tier.gold, Tier.platinum, Tier.diamond)


def promote(tier: Tier) -> Tier:
    i = ORDER.index(tier)
    return ORDER[min(i + 1, len(ORDER) - 1)]


def relegate(tier: Tier) -> Tier:
    i = ORDER.index(tier)
    return ORDER[max(i - 1, 0)]


class Outcome(enum.StrEnum):
    promoted = "promoted"  # top 2 sobe de divisão
    stayed = "stayed"
    relegated = "relegated"  # últimos 2 caem


class LeagueWeek(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Resultado de uma semana **já encerrada**. A semana corrente não tem linha: ela é
    calculada ao vivo (o XP vem dos dias; os robôs, da semente). A divisão atual é a que saiu
    do último encerramento."""

    __tablename__ = "league_weeks"
    __table_args__ = (UniqueConstraint("user_id", "week_start", name="uq_league_weeks_user_week"),)

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    week_start: Mapped[date] = mapped_column(Date, nullable=False)  # sempre uma segunda-feira
    tier: Mapped[Tier] = mapped_column(
        Enum(Tier, name="league_tier", native_enum=False, length=10), nullable=False
    )
    rank: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # 1 a 7
    xp: Mapped[int] = mapped_column(Integer, nullable=False)
    outcome: Mapped[Outcome] = mapped_column(
        Enum(Outcome, name="league_outcome", native_enum=False, length=10), nullable=False
    )
    next_tier: Mapped[Tier] = mapped_column(
        Enum(Tier, name="league_tier", native_enum=False, length=10), nullable=False
    )
    seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
