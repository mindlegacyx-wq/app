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
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class TaskPriority(enum.StrEnum):
    low = "low"
    medium = "medium"
    high = "high"


class TaskStatus(enum.StrEnum):
    pending = "pending"
    done = "done"
    cancelled = "cancelled"


class TaskCategory(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "task_categories"
    __table_args__ = (Index("ix_task_categories_user_id_sort_order", "user_id", "sort_order"),)

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(40), nullable=False)
    color: Mapped[str] = mapped_column(String(7), nullable=False)  # "#RRGGBB"
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class TaskRecurrence(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    """Tarefa fixa: a regra ("beber 3 L de água, seg a sex"), não a tarefa do dia.

    A tarefa de cada dia continua sendo uma linha em `tasks` — criada sob demanda a partir
    daqui. Assim o histórico não muda quando a regra muda, e todo o resto do app (percentual
    do dia, lixeira, ordenação) continua funcionando sem saber que a tarefa é fixa.
    """

    __tablename__ = "task_recurrences"
    __table_args__ = (Index("ix_task_recurrences_user_id_sort_order", "user_id", "sort_order"),)

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    category_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("task_categories.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(140), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 0 = segunda … 6 = domingo (mesmo formato dos treinos e da agenda)
    days_of_week: Mapped[list[int]] = mapped_column(ARRAY(SmallInteger), nullable=False)
    priority: Mapped[TaskPriority] = mapped_column(
        Enum(TaskPriority, name="task_priority", native_enum=False, length=8), nullable=False
    )
    # Antes disso a regra não existia: nunca cria tarefa retroativa.
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class Task(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "tasks"
    __table_args__ = (
        Index("ix_tasks_user_id_date_status", "user_id", "date", "status"),
        # Uma tarefa por regra por dia.
        UniqueConstraint("recurrence_id", "date", name="uq_tasks_recurrence_date"),
    )

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    category_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("task_categories.id", ondelete="SET NULL"), nullable=True
    )
    recurrence_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("task_recurrences.id", ondelete="CASCADE"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(140), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)  # dia planejado (fuso do usuário)
    priority: Mapped[TaskPriority] = mapped_column(
        Enum(TaskPriority, name="task_priority", native_enum=False, length=8), nullable=False
    )
    status: Mapped[TaskStatus] = mapped_column(
        Enum(TaskStatus, name="task_status", native_enum=False, length=10), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
