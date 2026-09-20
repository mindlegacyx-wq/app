"""Fase 18: tarefas fixas (regra) e vínculo da tarefa do dia com a regra.

Revision ID: 0017_fase18
Revises: 0016_fase17
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0017_fase18"
down_revision: str | None = "0016_fase17"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "task_recurrences",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "category_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("task_categories.id", ondelete="SET NULL"),
        ),
        sa.Column("title", sa.String(length=140), nullable=False),
        sa.Column("notes", sa.Text()),
        sa.Column("days_of_week", postgresql.ARRAY(sa.SmallInteger()), nullable=False),
        sa.Column("priority", sa.String(length=8), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
    )
    op.create_index(
        "ix_task_recurrences_user_id_sort_order", "task_recurrences", ["user_id", "sort_order"]
    )
    op.add_column(
        "tasks",
        sa.Column(
            "recurrence_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("task_recurrences.id", ondelete="CASCADE"),
        ),
    )
    op.create_unique_constraint("uq_tasks_recurrence_date", "tasks", ["recurrence_id", "date"])


def downgrade() -> None:
    op.drop_constraint("uq_tasks_recurrence_date", "tasks", type_="unique")
    op.drop_column("tasks", "recurrence_id")
    op.drop_index("ix_task_recurrences_user_id_sort_order", table_name="task_recurrences")
    op.drop_table("task_recurrences")
