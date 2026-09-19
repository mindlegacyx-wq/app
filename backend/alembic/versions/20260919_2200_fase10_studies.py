"""Fase 10: exams, exam_topics, study_sessions

Revision ID: 0009_fase10
Revises: 0008_fase9
Create Date: 2026-09-19 22:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009_fase10"
down_revision: str | None = "0008_fase9"
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
        "exams",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("subject_id", sa.Uuid(), nullable=True),
        sa.Column("title", sa.String(length=80), nullable=False),
        sa.Column("kind", sa.String(length=12), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("lead_days", sa.SmallInteger(), nullable=False, server_default="7"),
        sa.Column("minutes_per_day", sa.SmallInteger(), nullable=False, server_default="30"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=10), nullable=False, server_default="open"),
        sa.Column("done_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_exams_user_id_users"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["subject_id"],
            ["subjects.id"],
            name=op.f("fk_exams_subject_id_subjects"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_exams")),
    )
    op.create_index("ix_exams_user_id_date", "exams", ["user_id", "date"])

    op.create_table(
        "exam_topics",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("exam_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("is_done", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        *_timestamps(soft_delete=False),
        sa.ForeignKeyConstraint(
            ["exam_id"], ["exams.id"], name=op.f("fk_exam_topics_exam_id_exams"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_exam_topics")),
    )
    op.create_index(op.f("ix_exam_topics_exam_id"), "exam_topics", ["exam_id"])

    op.create_table(
        "study_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("exam_id", sa.Uuid(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=12), nullable=False, server_default="in_progress"),
        sa.Column("planned_minutes", sa.SmallInteger(), nullable=False),
        sa.Column("focused_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(soft_delete=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_study_sessions_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["exam_id"],
            ["exams.id"],
            name=op.f("fk_study_sessions_exam_id_exams"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_study_sessions")),
        sa.UniqueConstraint("exam_id", "date", name="uq_study_sessions_exam_id_date"),
    )
    op.create_index("ix_study_sessions_user_id_date", "study_sessions", ["user_id", "date"])


def downgrade() -> None:
    op.drop_index("ix_study_sessions_user_id_date", table_name="study_sessions")
    op.drop_table("study_sessions")
    op.drop_index(op.f("ix_exam_topics_exam_id"), table_name="exam_topics")
    op.drop_table("exam_topics")
    op.drop_index("ix_exams_user_id_date", table_name="exams")
    op.drop_table("exams")
