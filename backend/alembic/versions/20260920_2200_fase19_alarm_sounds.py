"""Fase 19: áudio próprio do alarme, insistência e marca do último envio.

Revision ID: 0018_fase19
Revises: 0017_fase18
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0018_fase19"
down_revision: str | None = "0017_fase18"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "alarm_sounds",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("content_type", sa.String(length=40), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("data", sa.LargeBinary(), nullable=False),
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
    )
    op.create_index("ix_alarm_sounds_user_id_created_at", "alarm_sounds", ["user_id", "created_at"])
    op.add_column(
        "alarms",
        sa.Column(
            "sound_file_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("alarm_sounds.id", ondelete="SET NULL"),
        ),
    )
    op.add_column(
        "alarms", sa.Column("insist", sa.Boolean(), nullable=False, server_default=sa.true())
    )
    op.add_column("wake_logs", sa.Column("last_push_at", sa.DateTime(timezone=True)))


def downgrade() -> None:
    op.drop_column("wake_logs", "last_push_at")
    op.drop_column("alarms", "insist")
    op.drop_column("alarms", "sound_file_id")
    op.drop_index("ix_alarm_sounds_user_id_created_at", table_name="alarm_sounds")
    op.drop_table("alarm_sounds")
