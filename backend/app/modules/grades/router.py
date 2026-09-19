from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, status

from app.core.deps import DB, CurrentUser
from app.modules.grades import service
from app.modules.grades.schemas import GradeIn, GradeOut, GradesSummaryOut, GradeUpdate

router = APIRouter(prefix="/grades", tags=["grades"])


@router.get("", response_model=GradesSummaryOut)
async def grades_summary(
    user: CurrentUser,
    db: DB,
    year: Annotated[int | None, Query(ge=2000, le=2100)] = None,
) -> GradesSummaryOut:
    return await service.summary(db, user, year)


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
