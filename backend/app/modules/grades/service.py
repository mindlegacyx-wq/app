"""Notas por matéria e período, com a régua configurável do usuário.

Regras:
- `passing_grade` (padrão 6), `periods_per_year` (padrão 3 = trimestres) e `grade_max`
  (padrão 10) ficam em `user_settings`; a escola do usuário manda.
- Várias notas no mesmo período viram média ponderada pelos pesos.
- Média do ano = média simples das médias dos períodos (decisão: simples por padrão).
- "Quanto preciso tirar": média necessária em cada período restante para fechar o ano na
  média mínima. Só conta período com nota; período sem nota é "restante".
"""

from decimal import ROUND_HALF_UP, Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dates import now_utc, user_today
from app.core.errors import ConflictError, NotFoundError
from app.modules.grades.models import Grade
from app.modules.grades.schemas import (
    GradeIn,
    GradeOut,
    GradesSummaryOut,
    GradeUpdate,
    PeriodOut,
    SubjectGradesOut,
    SubjectStatus,
)
from app.modules.schedule import service as schedule_service
from app.modules.studies import service as studies_service
from app.modules.users.models import User

CENT = Decimal("0.01")


def _q(v: Decimal) -> Decimal:
    return v.quantize(CENT, rounding=ROUND_HALF_UP)


# --- Cálculo puro ------------------------------------------------------------------------


def period_average(grades: list[Grade]) -> Decimal | None:
    total_w = sum((g.weight for g in grades), Decimal(0))
    if total_w == 0:
        return None
    return _q(sum((g.value * g.weight for g in grades), Decimal(0)) / total_w)


def year_average(period_avgs: list[Decimal]) -> Decimal | None:
    if not period_avgs:
        return None
    return _q(sum(period_avgs, Decimal(0)) / len(period_avgs))


def needed_average(
    periods_per_year: int, passing: Decimal, done: list[Decimal], grade_max: Decimal
) -> tuple[int, Decimal | None, Decimal | None, SubjectStatus]:
    """(períodos restantes, média necessária em cada um, média final projetada, status)."""
    k = len(done)
    remaining = periods_per_year - k
    if k == 0:
        return remaining, _q(passing), None, "no_grades"
    total = sum(done, Decimal(0))
    mean = total / k
    if remaining <= 0:
        final = _q(total / periods_per_year)
        return 0, None, final, "approved" if final >= passing else "closed_failed"
    needed = (passing * periods_per_year - total) / remaining
    projected = _q(mean)  # se mantiver o ritmo
    if needed <= 0:
        return remaining, Decimal("0.00"), projected, "approved"
    if needed > grade_max:
        return remaining, _q(needed), projected, "failing"
    return remaining, _q(needed), projected, "at_risk" if needed > passing else "on_track"


# --- Consultas ---------------------------------------------------------------------------


async def list_grades(db: AsyncSession, user_id: UUID, year: int | None = None) -> list[Grade]:
    q = select(Grade).where(Grade.user_id == user_id).order_by(Grade.period, Grade.created_at)
    if year is not None:
        q = q.where(Grade.year == year)
    return list((await db.scalars(q)).unique())


async def get_grade(db: AsyncSession, user_id: UUID, grade_id: UUID) -> Grade:
    g = await db.get(Grade, grade_id)
    if g is None or g.user_id != user_id:
        raise NotFoundError("Nota não encontrada.")
    return g


async def years_with_grades(db: AsyncSession, user_id: UUID) -> list[int]:
    rows = await db.scalars(
        select(Grade.year).where(Grade.user_id == user_id).distinct().order_by(Grade.year)
    )
    return list(rows)


async def summary(db: AsyncSession, user: User, year: int | None) -> GradesSummaryOut:
    settings = user.settings
    current_year = user_today(user.timezone).year
    year = year or current_year
    years = sorted({*await years_with_grades(db, user.id), current_year})
    grades = await list_grades(db, user.id, year)
    by_subject: dict[UUID, list[Grade]] = {}
    for g in grades:
        by_subject.setdefault(g.subject_id, []).append(g)

    subjects = await schedule_service.list_subjects(db, user.id)
    out: list[SubjectGradesOut] = []
    for s in subjects:
        mine = by_subject.get(s.id, [])
        if not s.is_active and not mine:
            continue  # arquivada e sem nota neste ano: não polui
        periods: list[PeriodOut] = []
        done: list[Decimal] = []
        for p in range(1, settings.periods_per_year + 1):
            in_period = [g for g in mine if g.period == p]
            avg = period_average(in_period)
            if avg is not None:
                done.append(avg)
            periods.append(
                PeriodOut(
                    period=p, grades=[GradeOut.model_validate(g) for g in in_period], average=avg
                )
            )
        remaining, needed, projected, status = needed_average(
            settings.periods_per_year, settings.passing_grade, done, settings.grade_max
        )
        out.append(
            SubjectGradesOut(
                subject_id=s.id,
                name=s.name,
                color=s.color,
                periods=periods,
                year_average=year_average(done),
                projected_final=projected,
                remaining_periods=remaining,
                needed_average=needed,
                status=status,
            )
        )
    return GradesSummaryOut(
        year=year,
        years=years,
        passing_grade=settings.passing_grade,
        periods_per_year=settings.periods_per_year,
        grade_max=settings.grade_max,
        subjects=out,
    )


# --- Escrita -----------------------------------------------------------------------------


def _check_scale(user: User, period: int, value: Decimal) -> None:
    if period > user.settings.periods_per_year:
        raise ConflictError(
            f"O ano tem {user.settings.periods_per_year} períodos nas suas configurações."
        )
    if value > user.settings.grade_max:
        raise ConflictError(f"A nota máxima configurada é {user.settings.grade_max:g}.")


async def create_grade(db: AsyncSession, user: User, data: GradeIn) -> Grade:
    _check_scale(user, data.period, data.value)
    await schedule_service.get_subject(db, user.id, data.subject_id)
    if data.exam_id is not None:
        await studies_service.get_exam(db, user.id, data.exam_id)
    g = Grade(
        user_id=user.id,
        subject_id=data.subject_id,
        exam_id=data.exam_id,
        year=data.year,
        period=data.period,
        title=data.title,
        value=data.value,
        weight=data.weight,
    )
    db.add(g)
    await db.flush()
    return await get_grade(db, user.id, g.id)


async def update_grade(db: AsyncSession, user: User, grade_id: UUID, data: GradeUpdate) -> Grade:
    g = await get_grade(db, user.id, grade_id)
    _check_scale(user, data.period or g.period, data.value if data.value is not None else g.value)
    for k, v in data.model_dump(exclude_unset=True, exclude={"clear_title"}).items():
        if v is not None:
            setattr(g, k, v)
    if data.clear_title:
        g.title = None
    g.updated_at = now_utc()
    await db.flush()
    return g


async def delete_grade(db: AsyncSession, user: User, grade_id: UUID) -> None:
    g = await get_grade(db, user.id, grade_id)
    await db.delete(g)
    await db.flush()
