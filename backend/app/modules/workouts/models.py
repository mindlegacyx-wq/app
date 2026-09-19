import enum
from datetime import date, datetime
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
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class SessionStatus(enum.StrEnum):
    in_progress = "in_progress"
    completed = "completed"
    skipped = "skipped"


class Workout(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    """Plano de treino: nome, dias da semana e exercícios."""

    __tablename__ = "workouts"
    __table_args__ = (Index("ix_workouts_user_id_sort_order", "user_id", "sort_order"),)

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    days_of_week: Mapped[list[int]] = mapped_column(ARRAY(SmallInteger), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    exercises: Mapped[list["WorkoutExercise"]] = relationship(
        back_populates="workout",
        cascade="all, delete-orphan",
        order_by="WorkoutExercise.sort_order",
        lazy="selectin",
    )


class WorkoutExercise(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "workout_exercises"
    __table_args__ = (
        Index("ix_workout_exercises_workout_id_sort_order", "workout_id", "sort_order"),
    )

    workout_id: Mapped[UUID] = mapped_column(
        ForeignKey("workouts.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    sets: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    reps: Mapped[str | None] = mapped_column(String(20), nullable=True)  # "12", "8-10", "30s"
    load: Mapped[str | None] = mapped_column(String(20), nullable=True)  # "20kg", "corporal"
    rest_seconds: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    workout: Mapped[Workout] = relationship(back_populates="exercises")


class WorkoutSession(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Um treino executado (ou pulado) num dia. Uma sessão por plano por dia."""

    __tablename__ = "workout_sessions"
    __table_args__ = (
        UniqueConstraint("workout_id", "date", name="uq_workout_sessions_workout_date"),
        Index("ix_workout_sessions_user_id_date", "user_id", "date"),
    )

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    workout_id: Mapped[UUID] = mapped_column(
        ForeignKey("workouts.id", ondelete="CASCADE"), nullable=False
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[SessionStatus] = mapped_column(
        Enum(SessionStatus, name="session_status", native_enum=False, length=12), nullable=False
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    exercises: Mapped[list["WorkoutSessionExercise"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", lazy="selectin"
    )


class WorkoutSessionExercise(Base):
    __tablename__ = "workout_session_exercises"

    session_id: Mapped[UUID] = mapped_column(
        ForeignKey("workout_sessions.id", ondelete="CASCADE"), primary_key=True
    )
    exercise_id: Mapped[UUID] = mapped_column(
        ForeignKey("workout_exercises.id", ondelete="CASCADE"), primary_key=True
    )
    completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    session: Mapped[WorkoutSession] = relationship(back_populates="exercises")
