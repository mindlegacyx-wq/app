from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, status
from pydantic import BaseModel

from app.core.deps import DB, CurrentUser
from app.modules.grades import service
from app.modules.grades.schemas import (
    AreaIn,
    AreaUpdate,
    GradeIn,
    GradeOut,
    GradesSummaryOut,
    GradeUpdate,
)
from app.modules.schedule import service as schedule_service
from app.modules.schedule.schemas import SubjectOut

router = APIRouter(prefix="/grades", tags=["grades"])


@router.get("", response_model=GradesSummaryOut)
async def grades_summary(
    user: CurrentUser,
    db: DB,
    year: Annotated[int | None, Query(ge=2000, le=2100)] = None,
) -> GradesSummaryOut:
    # Ligou "agrupar por área" e ainda não tem nenhuma: já entrega as quatro do ENEM.
    if user.settings.grades_by_area:
        await service.ensure_default_areas(db, user.id)
        await db.commit()
    return await service.summary(db, user, year)


# --- Áreas e ajustes da matéria (antes de /{grade_id}) -----------------------------------


class AreaSimpleOut(BaseModel):
    id: UUID
    name: str
    color: str
    sort_order: int


class SubjectGradeSettingsIn(BaseModel):
    area_id: UUID | None = None
    clear_area: bool = False
    entry_mode: str | None = None


@router.get("/areas", response_model=list[AreaSimpleOut])
async def list_areas(user: CurrentUser, db: DB) -> list[AreaSimpleOut]:
    return [
        AreaSimpleOut(id=a.id, name=a.name, color=a.color, sort_order=a.sort_order)
        for a in await service.list_areas(db, user.id)
    ]


@router.post("/areas/defaults", response_model=list[AreaSimpleOut])
async def create_default_areas(user: CurrentUser, db: DB) -> list[AreaSimpleOut]:
    """As quatro do ENEM, se o usuário ainda não tiver nenhuma área."""
    areas = await service.ensure_default_areas(db, user.id)
    await db.commit()
    return [
        AreaSimpleOut(id=a.id, name=a.name, color=a.color, sort_order=a.sort_order) for a in areas
    ]


@router.post("/areas", response_model=AreaSimpleOut, status_code=status.HTTP_201_CREATED)
async def create_area(data: AreaIn, user: CurrentUser, db: DB) -> AreaSimpleOut:
    a = await service.create_area(db, user.id, data)
    await db.commit()
    return AreaSimpleOut(id=a.id, name=a.name, color=a.color, sort_order=a.sort_order)


@router.patch("/areas/{area_id}", response_model=AreaSimpleOut)
async def update_area(area_id: UUID, data: AreaUpdate, user: CurrentUser, db: DB) -> AreaSimpleOut:
    a = await service.update_area(db, user.id, area_id, data)
    await db.commit()
    return AreaSimpleOut(id=a.id, name=a.name, color=a.color, sort_order=a.sort_order)


@router.delete("/areas/{area_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_area(area_id: UUID, user: CurrentUser, db: DB) -> None:
    await service.delete_area(db, user.id, area_id)
    await db.commit()


@router.patch("/subjects/{subject_id}", response_model=SubjectOut)
async def set_subject_grade_settings(
    subject_id: UUID, data: SubjectGradeSettingsIn, user: CurrentUser, db: DB
) -> SubjectOut:
    """Em qual área a matéria entra e como ela lança nota (final ou por avaliações)."""
    if data.area_id is not None:
        await service.get_area(db, user.id, data.area_id)  # a área tem que ser do usuário
    s = await schedule_service.set_grade_settings(
        db,
        user.id,
        subject_id,
        area_id=data.area_id,
        clear_area=data.clear_area,
        entry_mode=data.entry_mode,
    )
    await db.commit()
    return SubjectOut.model_validate(s)


# --- Notas -------------------------------------------------------------------------------


@router.post("", response_model=GradeOut, status_code=status.HTTP_201_CREATED)
async def create_grade(data: GradeIn, user: CurrentUser, db: DB) -> GradeOut:
    g = await service.create_grade(db, user, data)
    await db.commit()
    return GradeOut.model_validate(g)


@router.patch("/{grade_id}", response_model=GradeOut)
async def update_grade(grade_id: UUID, data: GradeUpdate, user: CurrentUser, db: DB) -> GradeOut:
    g = await service.update_grade(db, user, grade_id, data)
    await db.commit()
    return GradeOut.model_validate(g)


@router.delete("/{grade_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_grade(grade_id: UUID, user: CurrentUser, db: DB) -> None:
    await service.delete_grade(db, user, grade_id)
    await db.commit()
