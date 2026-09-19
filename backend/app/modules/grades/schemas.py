from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.core.schemas import Num


class GradeIn(BaseModel):
    subject_id: UUID
    year: int = Field(ge=2000, le=2100)
    period: int = Field(ge=1, le=6)
    title: str | None = Field(default=None, max_length=60)
    value: Decimal = Field(ge=0, le=100, decimal_places=2)
    weight: Decimal = Field(default=Decimal("1"), gt=0, le=10, decimal_places=2)
    exam_id: UUID | None = None


class GradeUpdate(BaseModel):
    period: int | None = Field(default=None, ge=1, le=6)
    title: str | None = Field(default=None, max_length=60)
    clear_title: bool = False
    value: Decimal | None = Field(default=None, ge=0, le=100, decimal_places=2)
    weight: Decimal | None = Field(default=None, gt=0, le=10, decimal_places=2)


class GradeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    subject_id: UUID
    exam_id: UUID | None
    year: int
    period: int
    title: str | None
    value: Num
    weight: Num


class PeriodOut(BaseModel):
    period: int
    grades: list[GradeOut]
    average: Num | None  # média ponderada do período (None = sem notas)


SubjectStatus = Literal["approved", "on_track", "at_risk", "failing", "no_grades", "closed_failed"]


class SubjectGradesOut(BaseModel):
    subject_id: UUID
    name: str
    color: str
    periods: list[PeriodOut]
    year_average: Num | None  # média simples dos períodos com nota
    projected_final: Num | None  # média final se os períodos restantes repetirem a média atual
    remaining_periods: int
    needed_average: Num | None  # quanto tirar em cada período restante para fechar na média
    status: SubjectStatus


class GradesSummaryOut(BaseModel):
    year: int
    years: list[int]  # anos com notas lançadas (para navegar)
    passing_grade: Num
    periods_per_year: int
    grade_max: Num
    subjects: list[SubjectGradesOut]
