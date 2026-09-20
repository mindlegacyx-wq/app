"""Fase 16: carga por série, biblioteca de exercícios e peso corporal.

Revision ID: 0015_fase16
Revises: 0014_fase15
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0015_fase16"
down_revision: str | None = "0014_fase15"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

LOAD_MODE = sa.Enum(
    "total", "per_side", "bodyweight", name="load_mode", native_enum=False, length=10
)


def _stamps() -> list[sa.Column]:
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
    ]


def upgrade() -> None:
    # Exercícios: de onde vieram e como a carga é digitada
    op.add_column("workout_exercises", sa.Column("library_key", sa.String(length=40)))
    op.add_column("workout_exercises", sa.Column("muscle", sa.String(length=12)))
    op.add_column("workout_exercises", sa.Column("icon", sa.String(length=12)))
    op.add_column(
        "workout_exercises",
        sa.Column("load_mode", LOAD_MODE, nullable=False, server_default="total"),
    )
    op.add_column(
        "workout_exercises",
        sa.Column("bar_weight", sa.Numeric(5, 2), nullable=False, server_default="0"),
    )
    op.add_column(
        "workout_exercises",
        sa.Column("increment", sa.Numeric(4, 2), nullable=False, server_default="2.5"),
    )
    op.add_column("workout_sessions", sa.Column("duration_seconds", sa.Integer()))

    op.create_table(
        "workout_sets",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "session_id",
            sa.Uuid(),
            sa.ForeignKey("workout_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "exercise_id",
            sa.Uuid(),
            sa.ForeignKey("workout_exercises.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("exercise_sort", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("set_number", sa.SmallInteger(), nullable=False),
        sa.Column("weight", sa.Numeric(6, 2)),
        sa.Column("reps", sa.SmallInteger()),
        sa.Column("seconds", sa.SmallInteger()),
        sa.Column("done", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        *_stamps(),
        sa.UniqueConstraint("session_id", "exercise_id", "set_number", name="uq_workout_sets_slot"),
    )
    op.create_index("ix_workout_sets_user_exercise", "workout_sets", ["user_id", "exercise_id"])

    op.create_table(
        "body_weights",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("weight", sa.Numeric(5, 2), nullable=False),
        *_stamps(),
        sa.UniqueConstraint("user_id", "date", name="uq_body_weights_user_date"),
    )


def downgrade() -> None:
    op.drop_table("body_weights")
    op.drop_index("ix_workout_sets_user_exercise", table_name="workout_sets")
    op.drop_table("workout_sets")
    op.drop_column("workout_sessions", "duration_seconds")
    for column in ("increment", "bar_weight", "load_mode", "icon", "muscle", "library_key"):
        op.drop_column("workout_exercises", column)
