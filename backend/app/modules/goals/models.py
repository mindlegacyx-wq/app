import enum
from datetime import date, datetime
from uuid import UUID

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class GoalArea(enum.StrEnum):
    health = "health"
    career = "career"
    finance = "finance"
    study = "study"
    personal = "personal"
    other = "other"


class GoalStatus(enum.StrEnum):
    active = "active"
    completed = "completed"
    archived = "archived"


class Goal(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "goals"
    __table_args__ = (Index("ix_goals_user_id_status", "user_id", "status"),)

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    area: Mapped[GoalArea] = mapped_column(
        Enum(GoalArea, name="goal_area", native_enum=False, length=10), nullable=False
    )
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[GoalStatus] = mapped_column(
        Enum(GoalStatus, name="goal_status", native_enum=False, length=10), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    actions: Mapped[list["GoalAction"]] = relationship(
        back_populates="goal",
        cascade="all, delete-orphan",
        order_by="GoalAction.sort_order",
        lazy="selectin",
    )


class GoalAction(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    """Pequena ação de uma meta. Com data, entra no dia e no percentual."""

    __tablename__ = "goal_actions"
    __table_args__ = (Index("ix_goal_actions_user_id_due_date", "user_id", "due_date"),)

    goal_id: Mapped[UUID] = mapped_column(
        ForeignKey("goals.id", ondelete="CASCADE"), nullable=False
    )
    # Redundante de propósito: consultas por dia filtram direto por usuário.
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_done: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    done_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    goal: Mapped[Goal] = relationship(back_populates="actions")
