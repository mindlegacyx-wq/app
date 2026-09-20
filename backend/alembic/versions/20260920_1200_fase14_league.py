"""Fase 14: liga semanal (só o resultado das semanas encerradas).

Revision ID: 0013_fase14
Revises: 0012_fase13
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0013_fase14"
down_revision: str | None = "0012_fase13"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TIER = sa.Enum(
    "bronze",
    "silver",
    "gold",
    "platinum",
    "diamond",
    name="league_tier",
    native_enum=False,
    length=10,
)
OUTCOME = sa.Enum(
    "promoted", "stayed", "relegated", name="league_outcome", native_enum=False, length=10
)


def upgrade() -> None:
    op.create_table(
        "league_weeks",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("week_start", sa.Date(), nullable=False),
        sa.Column("tier", TIER, nullable=False),
        sa.Column("rank", sa.SmallInteger(), nullable=False),
        sa.Column("xp", sa.Integer(), nullable=False),
        sa.Column("outcome", OUTCOME, nullable=False),
        sa.Column("next_tier", TIER, nullable=False),
        sa.Column("seen_at", sa.DateTime(timezone=True)),
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
        sa.UniqueConstraint("user_id", "week_start", name="uq_league_weeks_user_week"),
    )


def downgrade() -> None:
    op.drop_table("league_weeks")
