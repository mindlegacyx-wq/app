"""Fase 21: áreas de conhecimento, soma de pontos e modo de lançamento da matéria.

Revision ID: 0019_fase21
Revises: 0018_fase19
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0019_fase21"
down_revision: str | None = "0018_fase19"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "grade_areas",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=40), nullable=False),
        sa.Column("color", sa.String(length=7), nullable=False, server_default="#4F8CFF"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
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
    op.create_index("ix_grade_areas_user_id_sort_order", "grade_areas", ["user_id", "sort_order"])

    op.add_column(
        "subjects",
        sa.Column(
            "area_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("grade_areas.id", ondelete="SET NULL"),
        ),
    )
    op.add_column(
        "subjects",
        sa.Column("grade_entry_mode", sa.String(length=6), nullable=False, server_default="final"),
    )
    op.add_column("grades", sa.Column("max_points", sa.Numeric(5, 2)))
    op.add_column(
        "user_settings",
        sa.Column("grade_mode", sa.String(length=8), nullable=False, server_default="weighted"),
    )
    op.add_column(
        "user_settings",
        sa.Column("grades_by_area", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("user_settings", "grades_by_area")
    op.drop_column("user_settings", "grade_mode")
    op.drop_column("grades", "max_points")
    op.drop_column("subjects", "grade_entry_mode")
    op.drop_column("subjects", "area_id")
    op.drop_index("ix_grade_areas_user_id_sort_order", table_name="grade_areas")
    op.drop_table("grade_areas")
