from decimal import Decimal
from uuid import UUID

from sqlalchemy import ForeignKey, Index, Integer, Numeric, SmallInteger, String
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
    # Quanto a avaliação valia (só faz sentido na soma de pontos: prova 6 + trabalho 4).
    max_points: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)

    subject: Mapped[Subject] = relationship(lazy="joined")


# As quatro áreas do ENEM, criadas na primeira vez que o usuário agrupa as notas por área.
DEFAULT_AREAS = (
    ("Linguagens", "#4F8CFF"),
    ("Matemática", "#C6F135"),
    ("Ciências da Natureza", "#43D9A3"),
    ("Ciências Humanas", "#FF9F45"),
)


class GradeArea(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Área de conhecimento que junta matérias (Linguagens, Matemática...).

    Existe porque muita escola fecha a nota por área: a média da área é a média das médias
    das matérias que ela agrupa. Quem lança nota continua sendo a matéria.
    """

    __tablename__ = "grade_areas"
    __table_args__ = (Index("ix_grade_areas_user_id_sort_order", "user_id", "sort_order"),)

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(40), nullable=False)
    color: Mapped[str] = mapped_column(String(7), nullable=False, default="#4F8CFF")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
