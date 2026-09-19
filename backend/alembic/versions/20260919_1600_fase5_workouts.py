"""Fase 5: workouts, workout_exercises, workout_sessions, workout_session_exercises

Revision ID: 0006_fase5
Revises: 0005_fase4
Create Date: 2026-09-19 16:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006_fase5"
down_revision: str | None = "0005_fase4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _timestamps(soft_delete: bool = True) -> list[sa.Column]:
    cols = [
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
    ]
    if soft_delete:
        cols.append(sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    return cols


def upgrade() -> None:
    op.create_table(
        "workouts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("days_of_week", postgresql.ARRAY(sa.SmallInteger()), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_workouts_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_workouts")),
    )
    op.create_index("ix_workouts_user_id_sort_order", "workouts", ["user_id", "sort_order"])

    op.create_table(
        "workout_exercises",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workout_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("sets", sa.SmallInteger(), nullable=True),
        sa.Column("reps", sa.String(length=20), nullable=True),
        sa.Column("load", sa.String(length=20), nullable=True),
        sa.Column("rest_seconds", sa.SmallInteger(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["workout_id"],
            ["workouts.id"],
            name=op.f("fk_workout_exercises_workout_id_workouts"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_workout_exercises_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_workout_exercises")),
    )
    op.create_index(
        "ix_workout_exercises_workout_id_sort_order",
        "workout_exercises",
        ["workout_id", "sort_order"],
    )
    op.create_index(op.f("ix_workout_exercises_user_id"), "workout_exercises", ["user_id"])

    op.create_table(
        "workout_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("workout_id", sa.Uuid(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=12), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        *_timestamps(soft_delete=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_workout_sessions_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["workout_id"],
            ["workouts.id"],
            name=op.f("fk_workout_sessions_workout_id_workouts"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_workout_sessions")),
        sa.UniqueConstraint("workout_id", "date", name="uq_workout_sessions_workout_date"),
        sa.CheckConstraint(
            "status IN ('in_progress', 'completed', 'skipped')",
            name=op.f("ck_workout_sessions_session_status"),
        ),
    )
    op.create_index("ix_workout_sessions_user_id_date", "workout_sessions", ["user_id", "date"])

    op.create_table(
        "workout_session_exercises",
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("exercise_id", sa.Uuid(), nullable=False),
        sa.Column("completed", sa.Boolean(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["workout_sessions.id"],
            name=op.f("fk_workout_session_exercises_session_id_workout_sessions"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["exercise_id"],
            ["workout_exercises.id"],
            name=op.f("fk_workout_session_exercises_exercise_id_workout_exercises"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "session_id", "exercise_id", name=op.f("pk_workout_session_exercises")
        ),
    )


def downgrade() -> None:
    op.drop_table("workout_session_exercises")
    op.drop_index("ix_workout_sessions_user_id_date", table_name="workout_sessions")
    op.drop_table("workout_sessions")
    op.drop_index(op.f("ix_workout_exercises_user_id"), table_name="workout_exercises")
    op.drop_index("ix_workout_exercises_workout_id_sort_order", table_name="workout_exercises")
    op.drop_table("workout_exercises")
    op.drop_index("ix_workouts_user_id_sort_order", table_name="workouts")
    op.drop_table("workouts")
