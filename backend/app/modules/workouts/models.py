import enum
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class LoadMode(enum.StrEnum):
    """Como o peso é digitado neste exercício."""

    total = "total"  # o número é o peso real (máquina, halter, kettlebell)
    per_side = "per_side"  # o número é o que tem de cada lado da barra
    bodyweight = "bodyweight"  # peso do corpo (pode ter carga extra)


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
    load: Mapped[str | None] = mapped_column(String(20), nullable=True)  # legado (texto livre)
    rest_seconds: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Fase 16: carga de verdade
    library_key: Mapped[str | None] = mapped_column(String(40))  # exercício da biblioteca
    muscle: Mapped[str | None] = mapped_column(String(12))  # grupo, para ícone e filtro
    icon: Mapped[str | None] = mapped_column(String(12))
    load_mode: Mapped[LoadMode] = mapped_column(
        Enum(LoadMode, name="load_mode", native_enum=False, length=10),
        nullable=False,
        default=LoadMode.total,
    )
    bar_weight: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    increment: Mapped[Decimal] = mapped_column(
        Numeric(4, 2), nullable=False, default=Decimal("2.5")
    )

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
    duration_seconds: Mapped[int | None] = mapped_column(Integer)  # cronômetro do treino

    exercises: Mapped[list["WorkoutSessionExercise"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", lazy="selectin"
    )
    sets: Mapped[list["WorkoutSet"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="WorkoutSet.exercise_sort, WorkoutSet.set_number",
        lazy="selectin",
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


class WorkoutSet(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Uma série de um exercício num treino: o registro real de carga e repetições.

    `weight` é sempre o **peso real total em kg** (a conta do "por lado" já foi feita), para a
    evolução comparar maçã com maçã mesmo se o modo do exercício mudar depois.
    """

    __tablename__ = "workout_sets"
    __table_args__ = (
        UniqueConstraint("session_id", "exercise_id", "set_number", name="uq_workout_sets_slot"),
        Index("ix_workout_sets_user_exercise", "user_id", "exercise_id"),
    )

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    session_id: Mapped[UUID] = mapped_column(
        ForeignKey("workout_sessions.id", ondelete="CASCADE"), nullable=False
    )
    exercise_id: Mapped[UUID] = mapped_column(
        ForeignKey("workout_exercises.id", ondelete="CASCADE"), nullable=False
    )
    exercise_sort: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    set_number: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    weight: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))  # kg reais; None = sem carga
    reps: Mapped[int | None] = mapped_column(SmallInteger)
    seconds: Mapped[int | None] = mapped_column(SmallInteger)  # prancha, cardio…
    done: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    session: Mapped[WorkoutSession] = relationship(back_populates="sets")


class BodyWeight(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Peso corporal de um dia. Um registro por dia; o último vale."""

    __tablename__ = "body_weights"
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_body_weights_user_date"),)

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    weight: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)  # kg
