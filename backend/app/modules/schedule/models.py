import enum
from datetime import time
from uuid import UUID

from sqlalchemy import Boolean, Enum, ForeignKey, Index, Integer, SmallInteger, String, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin

# Paleta de cores das matérias (chips na agenda, provas e notas).
SUBJECT_COLORS = (
    "#C6F135",  # lima (destaque do app)
    "#5AC8FA",  # azul
    "#FF9F43",  # laranja
    "#B57BFF",  # roxo
    "#FF6B8A",  # rosa
    "#34D399",  # verde
    "#F5B942",  # amarelo
    "#9CA3AF",  # cinza
)


class Subject(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    """Matéria/disciplina do curso. Usada pela agenda, pelas provas e pelas notas."""

    __tablename__ = "subjects"
    __table_args__ = (Index("ix_subjects_user_id_sort_order", "user_id", "sort_order"),)

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    color: Mapped[str] = mapped_column(String(7), nullable=False, default=SUBJECT_COLORS[1])
    teacher: Mapped[str | None] = mapped_column(String(60), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Notas (Fase 21). A FK vai pelo nome da tabela para o módulo da agenda não precisar
    # importar o das notas.
    area_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("grade_areas.id", ondelete="SET NULL"), nullable=True
    )
    # "final" = uma nota por trimestre; "items" = prova, trabalho… somando/compondo a nota.
    grade_entry_mode: Mapped[str] = mapped_column(String(6), nullable=False, default="final")


class BlockKind(enum.StrEnum):
    class_ = "class"  # aula
    workout = "workout"  # treino (pode apontar para um plano)
    study = "study"  # estudo fixo
    other = "other"  # curso, trabalho, deslocamento…


class ScheduleBlock(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    """Um bloco fixo da semana: dia da semana + início/fim. Aulas não entram no percentual."""

    __tablename__ = "schedule_blocks"
    __table_args__ = (
        Index("ix_schedule_blocks_user_id_weekday_start", "user_id", "weekday", "start_time"),
    )

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(60), nullable=False)
    kind: Mapped[BlockKind] = mapped_column(
        Enum(BlockKind, name="block_kind", native_enum=False, length=10), nullable=False
    )
    subject_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True
    )
    workout_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("workouts.id", ondelete="SET NULL"), nullable=True
    )
    weekday: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # 0 = segunda
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    location: Mapped[str | None] = mapped_column(String(60), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    subject: Mapped[Subject | None] = relationship(lazy="joined")
