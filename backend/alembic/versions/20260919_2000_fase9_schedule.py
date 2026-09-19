"""Fase 9: subjects, schedule_blocks

Revision ID: 0008_fase9
Revises: 0007_fase6
Create Date: 2026-09-19 20:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008_fase9"
down_revision: str | None = "0007_fase6"
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
        "subjects",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("color", sa.String(length=7), nullable=False, server_default="#5AC8FA"),
        sa.Column("teacher", sa.String(length=60), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_subjects_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_subjects")),
    )
    op.create_index("ix_subjects_user_id_sort_order", "subjects", ["user_id", "sort_order"])

    op.create_table(
        "schedule_blocks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=60), nullable=False),
        sa.Column("kind", sa.String(length=10), nullable=False),
        sa.Column("subject_id", sa.Uuid(), nullable=True),
        sa.Column("workout_id", sa.Uuid(), nullable=True),
        sa.Column("weekday", sa.SmallInteger(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("location", sa.String(length=60), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_schedule_blocks_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["subject_id"],
            ["subjects.id"],
            name=op.f("fk_schedule_blocks_subject_id_subjects"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["workout_id"],
            ["workouts.id"],
            name=op.f("fk_schedule_blocks_workout_id_workouts"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_schedule_blocks")),
    )
    op.create_index(
        "ix_schedule_blocks_user_id_weekday_start",
        "schedule_blocks",
        ["user_id", "weekday", "start_time"],
    )


def downgrade() -> None:
    op.drop_index("ix_schedule_blocks_user_id_weekday_start", table_name="schedule_blocks")
    op.drop_table("schedule_blocks")
    op.drop_index("ix_subjects_user_id_sort_order", table_name="subjects")
    op.drop_table("subjects")
