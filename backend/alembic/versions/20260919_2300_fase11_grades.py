"""Fase 11: grades + régua de notas em user_settings

Revision ID: 0010_fase11
Revises: 0009_fase10
Create Date: 2026-09-19 23:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010_fase11"
down_revision: str | None = "0009_fase10"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user_settings",
        sa.Column("passing_grade", sa.Numeric(4, 2), nullable=False, server_default="6.00"),
    )
    op.add_column(
        "user_settings",
        sa.Column("periods_per_year", sa.SmallInteger(), nullable=False, server_default="3"),
    )
    op.add_column(
        "user_settings",
        sa.Column("grade_max", sa.Numeric(5, 2), nullable=False, server_default="10.00"),
    )

    op.create_table(
        "grades",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("subject_id", sa.Uuid(), nullable=False),
        sa.Column("exam_id", sa.Uuid(), nullable=True),
        sa.Column("year", sa.SmallInteger(), nullable=False),
        sa.Column("period", sa.SmallInteger(), nullable=False),
        sa.Column("title", sa.String(length=60), nullable=True),
        sa.Column("value", sa.Numeric(5, 2), nullable=False),
        sa.Column("weight", sa.Numeric(4, 2), nullable=False, server_default="1.00"),
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
            ["user_id"], ["users.id"], name=op.f("fk_grades_user_id_users"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["subject_id"],
            ["subjects.id"],
            name=op.f("fk_grades_subject_id_subjects"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["exam_id"], ["exams.id"], name=op.f("fk_grades_exam_id_exams"), ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_grades")),
    )
    op.create_index("ix_grades_user_id_year_subject", "grades", ["user_id", "year", "subject_id"])


def downgrade() -> None:
    op.drop_index("ix_grades_user_id_year_subject", table_name="grades")
    op.drop_table("grades")
    op.drop_column("user_settings", "grade_max")
    op.drop_column("user_settings", "periods_per_year")
    op.drop_column("user_settings", "passing_grade")
