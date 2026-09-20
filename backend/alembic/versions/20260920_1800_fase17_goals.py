"""Fase 17: objetivo do treino (faixa de repetições) e carga inicial do exercício.

Revision ID: 0016_fase17
Revises: 0015_fase16
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0016_fase17"
down_revision: str | None = "0015_fase16"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("workouts", sa.Column("goal", sa.String(length=12)))
    op.add_column("workout_exercises", sa.Column("goal", sa.String(length=12)))
    op.add_column("workout_exercises", sa.Column("start_weight", sa.Numeric(6, 2)))


def downgrade() -> None:
    op.drop_column("workout_exercises", "start_weight")
    op.drop_column("workout_exercises", "goal")
    op.drop_column("workouts", "goal")
