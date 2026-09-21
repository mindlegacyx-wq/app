"""Notas por matéria (e por área), com a régua configurável do usuário.

Regras:
- `passing_grade` (padrão 6), `periods_per_year` (padrão 3 = trimestres) e `grade_max`
  (padrão 10) ficam em `user_settings`; a escola do usuário manda.
- Como várias avaliações fecham o período depende de `grade_mode`:
  - `weighted`: média ponderada pelos pesos (prova peso 2, trabalho peso 1);
  - `sum`: cada avaliação vale pontos e a nota é a soma (prova 5,5 + trabalho 4,0 = 9,5).
- Média do ano = média simples das notas dos períodos (decisão: simples por padrão).
- **Área** é um agrupamento de matérias: a nota da área num período é a média das notas das
  matérias daquela área que já têm nota — e o app mostra quantas de quantas foram lançadas,
  para ninguém confundir média parcial com média fechada.
- "Quanto preciso tirar": média necessária em cada período restante para fechar o ano na
  média mínima. Só conta período com nota; período sem nota é "restante".
"""

from decimal import ROUND_HALF_UP, Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dates import now_utc, user_today
from app.core.errors import ConflictError, NotFoundError
from app.modules.grades.models import AREA_COLORS, Grade, GradeArea
from app.modules.grades.schemas import (
    AreaIn,
    AreaOut,
    AreaPeriodOut,
    AreaUpdate,
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


def period_average(grades: list[Grade], mode: str = "weighted") -> Decimal | None:
    """Nota do período a partir das avaliações lançadas nele.

    `sum`: soma o que foi tirado (prova 5,5 + trabalho 4,0 = 9,5).
    `weighted`: média ponderada pelos pesos.
    """
    if not grades:
        return None
    if mode == "sum":
        return _q(sum((g.value for g in grades), Decimal(0)))
    total_w = sum((g.weight for g in grades), Decimal(0))
    if total_w == 0:
        return None
    return _q(sum((g.value * g.weight for g in grades), Decimal(0)) / total_w)


def period_max_points(grades: list[Grade]) -> Decimal | None:
    """Quanto o período valia ao todo — só quando todas as avaliações dizem quanto valem."""
    if not grades or any(g.max_points is None for g in grades):
        return None
    return _q(sum((g.max_points or Decimal(0) for g in grades), Decimal(0)))


def area_average(subject_values: list[Decimal]) -> Decimal | None:
    """Nota da área: soma as notas das matérias e divide pela quantidade delas."""
    if not subject_values:
        return None
    return _q(sum(subject_values, Decimal(0)) / len(subject_values))


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

    mode = settings.grade_mode
    subjects = await schedule_service.list_subjects(db, user.id)
    out: list[SubjectGradesOut] = []
    # Nota de cada matéria em cada período, para a média da área logo abaixo.
    by_period: dict[UUID, dict[int, Decimal]] = {}
    for s in subjects:
        mine = by_subject.get(s.id, [])
        if not s.is_active and not mine:
            continue  # arquivada e sem nota neste ano: não polui
        periods: list[PeriodOut] = []
        done: list[Decimal] = []
        for p in range(1, settings.periods_per_year + 1):
            in_period = [g for g in mine if g.period == p]
            avg = period_average(in_period, mode)
            if avg is not None:
                done.append(avg)
                by_period.setdefault(s.id, {})[p] = avg
            periods.append(
                PeriodOut(
                    period=p,
                    grades=[GradeOut.model_validate(g) for g in in_period],
                    average=avg,
                    max_points=period_max_points(in_period) if mode == "sum" else None,
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
                area_id=s.area_id,
                entry_mode="items" if s.grade_entry_mode == "items" else "final",
                periods=periods,
                year_average=year_average(done),
                projected_final=projected,
                remaining_periods=remaining,
                needed_average=needed,
                status=status,
            )
        )

    areas = await list_areas(db, user.id)
    shown = {s.subject_id for s in out}
    area_out: list[AreaOut] = []
    for a in areas:
        ids = [s.subject_id for s in out if s.area_id == a.id and s.subject_id in shown]
        periods_out: list[AreaPeriodOut] = []
        done_area: list[Decimal] = []
        for p in range(1, settings.periods_per_year + 1):
            values = [by_period[i][p] for i in ids if p in by_period.get(i, {})]
            avg = area_average(values)
            if avg is not None:
                done_area.append(avg)
            periods_out.append(
                AreaPeriodOut(period=p, average=avg, with_grade=len(values), total=len(ids))
            )
        remaining, needed, projected, status = needed_average(
            settings.periods_per_year, settings.passing_grade, done_area, settings.grade_max
        )
        area_out.append(
            AreaOut(
                id=a.id,
                name=a.name,
                color=a.color,
                sort_order=a.sort_order,
                subject_ids=ids,
                periods=periods_out,
                year_average=year_average(done_area),
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
        grade_mode="sum" if mode == "sum" else "weighted",
        by_area=settings.grades_by_area,
        areas=area_out,
        subjects=out,
    )


# --- Áreas -------------------------------------------------------------------------------


async def list_areas(db: AsyncSession, user_id: UUID) -> list[GradeArea]:
    rows = await db.scalars(
        select(GradeArea)
        .where(GradeArea.user_id == user_id)
        .order_by(GradeArea.sort_order, GradeArea.created_at)
    )
    return list(rows)


async def get_area(db: AsyncSession, user_id: UUID, area_id: UUID) -> GradeArea:
    a = await db.get(GradeArea, area_id)
    if a is None or a.user_id != user_id:
        raise NotFoundError("Área não encontrada.")
    return a


async def create_area(db: AsyncSession, user_id: UUID, data: AreaIn) -> GradeArea:
    nxt = len(await list_areas(db, user_id))
    color = (data.color or AREA_COLORS[nxt % len(AREA_COLORS)]).upper()
    a = GradeArea(user_id=user_id, name=data.name, color=color, sort_order=nxt)
    db.add(a)
    await db.flush()
    return a


async def update_area(
    db: AsyncSession, user_id: UUID, area_id: UUID, data: AreaUpdate
) -> GradeArea:
    a = await get_area(db, user_id, area_id)
    for k, v in data.model_dump(exclude_unset=True).items():
        if v is not None:
            setattr(a, k, v.upper() if k == "color" else v)
    a.updated_at = now_utc()
    await db.flush()
    return a


async def delete_area(db: AsyncSession, user_id: UUID, area_id: UUID) -> None:
    """As matérias ficam; só perdem a área (FK com ON DELETE SET NULL)."""
    a = await get_area(db, user_id, area_id)
    await db.delete(a)
    await db.flush()


# --- Escrita -----------------------------------------------------------------------------


def _check_scale(
    user: User, period: int, value: Decimal, max_points: Decimal | None = None
) -> None:
    if period > user.settings.periods_per_year:
        raise ConflictError(
            f"O ano tem {user.settings.periods_per_year} períodos nas suas configurações."
        )
    if value > user.settings.grade_max:
        raise ConflictError(f"A nota máxima configurada é {user.settings.grade_max:g}.")
    if max_points is not None and value > max_points:
        raise ConflictError(f"A nota não pode passar dos {max_points:g} pontos da avaliação.")


async def create_grade(db: AsyncSession, user: User, data: GradeIn) -> Grade:
    _check_scale(user, data.period, data.value, data.max_points)
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
        max_points=data.max_points,
    )
    db.add(g)
    await db.flush()
    return await get_grade(db, user.id, g.id)


async def update_grade(db: AsyncSession, user: User, grade_id: UUID, data: GradeUpdate) -> Grade:
    g = await get_grade(db, user.id, grade_id)
    _check_scale(
        user,
        data.period or g.period,
        data.value if data.value is not None else g.value,
        None if data.clear_max_points else (data.max_points or g.max_points),
    )
    for k, v in data.model_dump(
        exclude_unset=True, exclude={"clear_title", "clear_max_points"}
    ).items():
        if v is not None:
            setattr(g, k, v)
    if data.clear_title:
        g.title = None
    if data.clear_max_points:
        g.max_points = None
    g.updated_at = now_utc()
    await db.flush()
    return g


async def delete_grade(db: AsyncSession, user: User, grade_id: UUID) -> None:
    g = await get_grade(db, user.id, grade_id)
    await db.delete(g)
    await db.flush()
