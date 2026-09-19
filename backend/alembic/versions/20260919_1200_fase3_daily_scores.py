"""Fase 3: daily_scores

Revision ID: 0004_fase3
Revises: 0003_fase2
Create Date: 2026-09-19 12:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_fase3"
down_revision: str | None = "0003_fase2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "daily_scores",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("planned_count", sa.SmallInteger(), nullable=False),
        sa.Column("completed_count", sa.SmallInteger(), nullable=False),
        sa.Column("discipline_pct", sa.SmallInteger(), nullable=False),
        sa.Column("target_pct", sa.SmallInteger(), nullable=False),
        sa.Column("hit_target", sa.Boolean(), nullable=False),
        sa.Column("streak_day", sa.Integer(), nullable=False),
        sa.Column("breakdown", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("closed_by", sa.String(length=8), nullable=False),
        sa.Column("finalized_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_daily_scores_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_daily_scores")),
        sa.UniqueConstraint("user_id", "date", name="uq_daily_scores_user_date"),
        sa.CheckConstraint(
            "closed_by IN ('user', 'system')", name=op.f("ck_daily_scores_closed_by")
        ),
    )


def downgrade() -> None:
    op.drop_table("daily_scores")
