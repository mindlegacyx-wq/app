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
    max_points: Decimal | None = Field(default=None, gt=0, le=100, decimal_places=2)
    exam_id: UUID | None = None


class GradeUpdate(BaseModel):
    period: int | None = Field(default=None, ge=1, le=6)
    title: str | None = Field(default=None, max_length=60)
    clear_title: bool = False
    value: Decimal | None = Field(default=None, ge=0, le=100, decimal_places=2)
    weight: Decimal | None = Field(default=None, gt=0, le=10, decimal_places=2)
    max_points: Decimal | None = Field(default=None, gt=0, le=100, decimal_places=2)
    clear_max_points: bool = False


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
    max_points: Num | None


class PeriodOut(BaseModel):
    period: int
    grades: list[GradeOut]
    average: Num | None  # nota do período (None = sem notas)
    max_points: Num | None = None  # soma do "quanto valia" (só na soma de pontos)


SubjectStatus = Literal["approved", "on_track", "at_risk", "failing", "no_grades", "closed_failed"]


class SubjectGradesOut(BaseModel):
    subject_id: UUID
    name: str
    color: str
    area_id: UUID | None = None
    entry_mode: Literal["final", "items"] = "final"
    periods: list[PeriodOut]
    year_average: Num | None  # média simples dos períodos com nota
    projected_final: Num | None  # média final se os períodos restantes repetirem a média atual
    remaining_periods: int
    needed_average: Num | None  # quanto tirar em cada período restante para fechar na média
    status: SubjectStatus


class AreaPeriodOut(BaseModel):
    period: int
    average: Num | None  # média das médias das matérias com nota no período
    with_grade: int  # quantas matérias já têm nota
    total: int  # quantas matérias a área tem


class AreaOut(BaseModel):
    id: UUID
    name: str
    color: str
    sort_order: int
    subject_ids: list[UUID]
    periods: list[AreaPeriodOut]
    year_average: Num | None
    projected_final: Num | None
    remaining_periods: int
    needed_average: Num | None
    status: SubjectStatus


class AreaIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    # Sem cor, o servidor escolhe a próxima do rodízio.
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")


class AreaUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=40)
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    sort_order: int | None = Field(default=None, ge=0, le=100)


class GradesSummaryOut(BaseModel):
    year: int
    years: list[int]  # anos com notas lançadas (para navegar)
    passing_grade: Num
    periods_per_year: int
    grade_max: Num
    grade_mode: Literal["weighted", "sum"]
    by_area: bool  # o usuário pediu para ver agrupado por área
    areas: list[AreaOut]
    subjects: list[SubjectGradesOut]
