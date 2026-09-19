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
    SmallInteger,
    String,
    Time,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class RoutineKind(enum.StrEnum):
    morning = "morning"
    evening = "evening"
    custom = "custom"


class Routine(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "routines"
    __table_args__ = (Index("ix_routines_user_id_sort_order", "user_id", "sort_order"),)

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    kind: Mapped[RoutineKind] = mapped_column(
        Enum(RoutineKind, name="routine_kind", native_enum=False, length=16), nullable=False
    )
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    days_of_week: Mapped[list[int]] = mapped_column(ARRAY(SmallInteger), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    items: Mapped[list["RoutineItem"]] = relationship(
        back_populates="routine",
        cascade="all, delete-orphan",
        order_by="RoutineItem.sort_order",
        lazy="selectin",
    )


class RoutineItem(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "routine_items"
    __table_args__ = (Index("ix_routine_items_routine_id_sort_order", "routine_id", "sort_order"),)

    routine_id: Mapped[UUID] = mapped_column(
        ForeignKey("routines.id", ondelete="CASCADE"), nullable=False
    )
    # Redundante de propósito: consultas por dia filtram direto por usuário.
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(80), nullable=False)
    duration_minutes: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    routine: Mapped[Routine] = relationship(back_populates="items")


class RoutineItemLog(Base, UUIDPrimaryKeyMixin):
    """Um check por item por dia (dia no fuso do usuário)."""

    __tablename__ = "routine_item_logs"
    __table_args__ = (
        UniqueConstraint("routine_item_id", "date", name="uq_routine_item_logs_item_date"),
        Index("ix_routine_item_logs_user_id_date", "user_id", "date"),
    )

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    routine_item_id: Mapped[UUID] = mapped_column(
        ForeignKey("routine_items.id", ondelete="CASCADE"), nullable=False
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
