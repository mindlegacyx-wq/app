"""Fase 6: alarms, push_subscriptions, wake_logs.alarm_id / next_ring_at

Revision ID: 0007_fase6
Revises: 0006_fase5
Create Date: 2026-09-19 18:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0007_fase6"
down_revision: str | None = "0006_fase5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "alarms",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("label", sa.String(length=40), nullable=False),
        sa.Column("time", sa.Time(), nullable=False),
        sa.Column("days_of_week", postgresql.ARRAY(sa.SmallInteger()), nullable=False),
        sa.Column("sound", sa.String(length=40), nullable=False, server_default="classic"),
        sa.Column("requires_confirmation", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("max_snoozes", sa.SmallInteger(), nullable=False, server_default="1"),
        sa.Column("snooze_minutes", sa.SmallInteger(), nullable=False, server_default="5"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
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
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_alarms_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_alarms")),
    )
    op.create_index("ix_alarms_user_id_time", "alarms", ["user_id", "time"], unique=False)

    op.create_table(
        "push_subscriptions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("endpoint", sa.Text(), nullable=False),
        sa.Column("p256dh", sa.Text(), nullable=False),
        sa.Column("auth", sa.Text(), nullable=False),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_push_subscriptions_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_push_subscriptions")),
        sa.UniqueConstraint("endpoint", name=op.f("uq_push_subscriptions_endpoint")),
    )
    op.create_index(
        "ix_push_subscriptions_user_id", "push_subscriptions", ["user_id"], unique=False
    )

    op.add_column("wake_logs", sa.Column("alarm_id", sa.Uuid(), nullable=True))
    op.add_column("wake_logs", sa.Column("next_ring_at", sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key(
        op.f("fk_wake_logs_alarm_id_alarms"),
        "wake_logs",
        "alarms",
        ["alarm_id"],
        ["id"],
        ondelete="SET NULL",
    )
    # O job de disparo procura registros pendentes com toque previsto.
    op.create_index(
        "ix_wake_logs_status_next_ring_at", "wake_logs", ["status", "next_ring_at"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_wake_logs_status_next_ring_at", table_name="wake_logs")
    op.drop_constraint(op.f("fk_wake_logs_alarm_id_alarms"), "wake_logs", type_="foreignkey")
    op.drop_column("wake_logs", "next_ring_at")
    op.drop_column("wake_logs", "alarm_id")
    op.drop_index("ix_push_subscriptions_user_id", table_name="push_subscriptions")
    op.drop_table("push_subscriptions")
    op.drop_index("ix_alarms_user_id_time", table_name="alarms")
    op.drop_table("alarms")
