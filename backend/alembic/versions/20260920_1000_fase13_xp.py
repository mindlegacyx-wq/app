"""Fase 13: XP por dia (nível e patente saem daqui).

Revision ID: 0012_fase13
Revises: 0011_fase12
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from app.modules.player.xp import xp_for_day

revision: str = "0012_fase13"
down_revision: str | None = "0011_fase12"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("daily_scores", sa.Column("xp", sa.Integer(), nullable=True))
    # Dias já fechados recebem o XP com a mesma fórmula do app (uma passada só).
    conn = op.get_bind()
    rows = conn.execute(
        sa.text("SELECT id, breakdown, discipline_pct, hit_target, streak_day FROM daily_scores")
    ).all()
    for row in rows:
        xp = xp_for_day(
            dict(row.breakdown or {}), row.discipline_pct, row.hit_target, row.streak_day
        )
        conn.execute(
            sa.text("UPDATE daily_scores SET xp = :xp WHERE id = :id"), {"xp": xp, "id": row.id}
        )


def downgrade() -> None:
    op.drop_column("daily_scores", "xp")
