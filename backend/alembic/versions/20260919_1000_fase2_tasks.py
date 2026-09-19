"""Fase 2: task_categories, tasks

Revision ID: 0003_fase2
Revises: 0002_fase1
Create Date: 2026-09-19 10:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_fase2"
down_revision: str | None = "0002_fase1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _timestamps() -> list[sa.Column]:
    return [
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
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    ]


def upgrade() -> None:
    op.create_table(
        "task_categories",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=40), nullable=False),
        sa.Column("color", sa.String(length=7), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_task_categories_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_task_categories")),
    )
    op.create_index(
        "ix_task_categories_user_id_sort_order", "task_categories", ["user_id", "sort_order"]
    )

    op.create_table(
        "tasks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("category_id", sa.Uuid(), nullable=True),
        sa.Column("title", sa.String(length=140), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("priority", sa.String(length=8), nullable=False),
        sa.Column("status", sa.String(length=10), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_tasks_user_id_users"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["category_id"],
            ["task_categories.id"],
            name=op.f("fk_tasks_category_id_task_categories"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tasks")),
        sa.CheckConstraint(
            "priority IN ('low', 'medium', 'high')", name=op.f("ck_tasks_task_priority")
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'done', 'cancelled')", name=op.f("ck_tasks_task_status")
        ),
    )
    op.create_index("ix_tasks_user_id_date_status", "tasks", ["user_id", "date", "status"])
    op.create_index(op.f("ix_tasks_category_id"), "tasks", ["category_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_tasks_category_id"), table_name="tasks")
    op.drop_index("ix_tasks_user_id_date_status", table_name="tasks")
    op.drop_table("tasks")
    op.drop_index("ix_task_categories_user_id_sort_order", table_name="task_categories")
    op.drop_table("task_categories")
