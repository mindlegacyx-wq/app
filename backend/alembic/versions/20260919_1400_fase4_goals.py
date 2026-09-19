"""Fase 4: goals, goal_actions

Revision ID: 0005_fase4
Revises: 0004_fase3
Create Date: 2026-09-19 14:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005_fase4"
down_revision: str | None = "0004_fase3"
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
        "goals",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("area", sa.String(length=10), nullable=False),
        sa.Column("deadline", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=10), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_goals_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_goals")),
        sa.CheckConstraint(
            "area IN ('health', 'career', 'finance', 'study', 'personal', 'other')",
            name=op.f("ck_goals_goal_area"),
        ),
        sa.CheckConstraint(
            "status IN ('active', 'completed', 'archived')", name=op.f("ck_goals_goal_status")
        ),
    )
    op.create_index("ix_goals_user_id_status", "goals", ["user_id", "status"])

    op.create_table(
        "goal_actions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("goal_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("is_done", sa.Boolean(), nullable=False),
        sa.Column("done_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["goal_id"],
            ["goals.id"],
            name=op.f("fk_goal_actions_goal_id_goals"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_goal_actions_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_goal_actions")),
    )
    op.create_index("ix_goal_actions_user_id_due_date", "goal_actions", ["user_id", "due_date"])
    op.create_index(op.f("ix_goal_actions_goal_id"), "goal_actions", ["goal_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_goal_actions_goal_id"), table_name="goal_actions")
    op.drop_index("ix_goal_actions_user_id_due_date", table_name="goal_actions")
    op.drop_table("goal_actions")
    op.drop_index("ix_goals_user_id_status", table_name="goals")
    op.drop_table("goals")
