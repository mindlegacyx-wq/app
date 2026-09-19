from decimal import Decimal
from uuid import UUID

from sqlalchemy import ForeignKey, Index, Numeric, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.modules.schedule.models import Subject


class Grade(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Uma nota lançada numa matéria, num período do ano (bimestre/trimestre/semestre).

    Várias notas no mesmo período são combinadas por média ponderada (`weight`). A média do
    ano é a média simples das médias dos períodos. A régua (média mínima, períodos por ano,
    nota máxima) fica em `user_settings`.
    """

    __tablename__ = "grades"
    __table_args__ = (Index("ix_grades_user_id_year_subject", "user_id", "year", "subject_id"),)

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    subject_id: Mapped[UUID] = mapped_column(
        ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False
    )
    exam_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("exams.id", ondelete="SET NULL"), nullable=True
    )
    year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    period: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # 1..periods_per_year
    title: Mapped[str | None] = mapped_column(String(60), nullable=True)
    value: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    weight: Mapped[Decimal] = mapped_column(Numeric(4, 2), nullable=False, default=Decimal("1"))

    subject: Mapped[Subject] = relationship(lazy="joined")
