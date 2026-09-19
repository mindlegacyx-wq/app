"""Fase 1: routines, routine_items, routine_item_logs, wake_logs

Revision ID: 0002_fase1
Revises: 0001_fase0
Create Date: 2026-09-19 09:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_fase1"
down_revision: str | None = "0001_fase0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "routines",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=True),
        sa.Column("days_of_week", postgresql.ARRAY(sa.SmallInteger()), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
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
            ["user_id"], ["users.id"], name=op.f("fk_routines_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_routines")),
        sa.CheckConstraint(
            "kind IN ('morning', 'evening', 'custom')", name=op.f("ck_routines_routine_kind")
        ),
    )
    op.create_index("ix_routines_user_id_sort_order", "routines", ["user_id", "sort_order"])

    op.create_table(
        "routine_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("routine_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=80), nullable=False),
        sa.Column("duration_minutes", sa.SmallInteger(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
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
            ["routine_id"],
            ["routines.id"],
            name=op.f("fk_routine_items_routine_id_routines"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_routine_items_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_routine_items")),
    )
    op.create_index(
        "ix_routine_items_routine_id_sort_order", "routine_items", ["routine_id", "sort_order"]
    )
    op.create_index(op.f("ix_routine_items_user_id"), "routine_items", ["user_id"])

    op.create_table(
        "routine_item_logs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("routine_item_id", sa.Uuid(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["routine_item_id"],
            ["routine_items.id"],
            name=op.f("fk_routine_item_logs_routine_item_id_routine_items"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_routine_item_logs_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_routine_item_logs")),
        sa.UniqueConstraint("routine_item_id", "date", name="uq_routine_item_logs_item_date"),
    )
    op.create_index("ix_routine_item_logs_user_id_date", "routine_item_logs", ["user_id", "date"])

    op.create_table(
        "wake_logs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rang_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("snooze_count", sa.SmallInteger(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_wake_logs_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_wake_logs")),
        sa.UniqueConstraint("user_id", "date", name="uq_wake_logs_user_date"),
        sa.CheckConstraint(
            "status IN ('pending', 'confirmed', 'missed', 'manual')",
            name=op.f("ck_wake_logs_wake_status"),
        ),
    )


def downgrade() -> None:
    op.drop_table("wake_logs")
    op.drop_index("ix_routine_item_logs_user_id_date", table_name="routine_item_logs")
    op.drop_table("routine_item_logs")
    op.drop_index(op.f("ix_routine_items_user_id"), table_name="routine_items")
    op.drop_index("ix_routine_items_routine_id_sort_order", table_name="routine_items")
    op.drop_table("routine_items")
    op.drop_index("ix_routines_user_id_sort_order", table_name="routines")
    op.drop_table("routines")
