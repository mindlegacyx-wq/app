"""Fase 12: study_materials, study_artifacts

Revision ID: 0011_fase12
Revises: 0010_fase11
Create Date: 2026-09-20 00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0011_fase12"
down_revision: str | None = "0010_fase11"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _timestamps() -> list[sa.Column]:
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
    op.create_table(
        "study_materials",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("exam_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=80), nullable=True),
        sa.Column("source", sa.String(length=8), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_study_materials_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["exam_id"],
            ["exams.id"],
            name=op.f("fk_study_materials_exam_id_exams"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_study_materials")),
    )
    op.create_index(op.f("ix_study_materials_exam_id"), "study_materials", ["exam_id"])

    op.create_table(
        "study_artifacts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("exam_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(length=10), nullable=False),
        sa.Column("status", sa.String(length=8), nullable=False, server_default="queued"),
        sa.Column("content_md", sa.Text(), nullable=True),
        sa.Column("content_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("error", sa.String(length=300), nullable=True),
        sa.Column("model", sa.String(length=80), nullable=True),
        sa.Column("input_hash", sa.String(length=64), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_study_artifacts_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["exam_id"],
            ["exams.id"],
            name=op.f("fk_study_artifacts_exam_id_exams"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_study_artifacts")),
        sa.UniqueConstraint("exam_id", "kind", name="uq_study_artifacts_exam_id_kind"),
    )
    op.create_index(op.f("ix_study_artifacts_exam_id"), "study_artifacts", ["exam_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_study_artifacts_exam_id"), table_name="study_artifacts")
    op.drop_table("study_artifacts")
    op.drop_index(op.f("ix_study_materials_exam_id"), table_name="study_materials")
    op.drop_table("study_materials")
