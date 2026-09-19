from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Path, Query, status

from app.core.dates import user_today
from app.core.deps import DB, CurrentUser
from app.modules.schedule import service
from app.modules.schedule.schemas import (
    BlockIn,
    BlockOut,
    BlockUpdate,
    CopyDayIn,
    CopyDayOut,
    DayOut,
    SubjectIn,
    SubjectOut,
    SubjectUpdate,
    WeekOut,
)

# --- /subjects ---------------------------------------------------------------------------

subjects_router = APIRouter(prefix="/subjects", tags=["subjects"])


@subjects_router.get("", response_model=list[SubjectOut])
async def list_subjects(user: CurrentUser, db: DB) -> list[SubjectOut]:
    return [SubjectOut.model_validate(s) for s in await service.list_subjects(db, user.id)]


@subjects_router.post("", response_model=SubjectOut, status_code=status.HTTP_201_CREATED)
async def create_subject(data: SubjectIn, user: CurrentUser, db: DB) -> SubjectOut:
    s = await service.create_subject(db, user.id, data)
    await db.commit()
    return SubjectOut.model_validate(s)


@subjects_router.patch("/{subject_id}", response_model=SubjectOut)
async def update_subject(
    subject_id: UUID, data: SubjectUpdate, user: CurrentUser, db: DB
) -> SubjectOut:
    s = await service.update_subject(db, user.id, subject_id, data)
    await db.commit()
    return SubjectOut.model_validate(s)


@subjects_router.delete("/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subject(subject_id: UUID, user: CurrentUser, db: DB) -> None:
    await service.delete_subject(db, user.id, subject_id)
    await db.commit()


# --- /schedule ---------------------------------------------------------------------------

schedule_router = APIRouter(prefix="/schedule", tags=["schedule"])


@schedule_router.get("", response_model=WeekOut)
async def week(user: CurrentUser, db: DB) -> WeekOut:
    return await service.week(db, user.id)


@schedule_router.get("/day", response_model=DayOut)
async def day(
    user: CurrentUser,
    db: DB,
    on: Annotated[date | None, Query(alias="date")] = None,
) -> DayOut:
    return await service.day(db, user.id, on or user_today(user.timezone))


@schedule_router.post("/blocks", response_model=list[BlockOut], status_code=status.HTTP_201_CREATED)
async def create_blocks(data: BlockIn, user: CurrentUser, db: DB) -> list[BlockOut]:
    blocks = await service.create_blocks(db, user.id, data)
    await db.commit()
    return [service.to_out(b) for b in blocks]


@schedule_router.patch("/blocks/{block_id}", response_model=BlockOut)
async def update_block(block_id: UUID, data: BlockUpdate, user: CurrentUser, db: DB) -> BlockOut:
    b = await service.update_block(db, user.id, block_id, data)
    await db.commit()
    return service.to_out(b)


@schedule_router.delete("/blocks/{block_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_block(block_id: UUID, user: CurrentUser, db: DB) -> None:
    await service.delete_block(db, user.id, block_id)
    await db.commit()


@schedule_router.post("/days/{weekday}/copy", response_model=CopyDayOut)
async def copy_day(
    weekday: Annotated[int, Path(ge=0, le=6)], data: CopyDayIn, user: CurrentUser, db: DB
) -> CopyDayOut:
    out = await service.copy_day(db, user.id, weekday, data.to_weekdays)
    await db.commit()
    return out
