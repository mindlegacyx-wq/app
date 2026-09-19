from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query

from app.core.dates import user_today
from app.core.deps import DB, CurrentUser
from app.modules.progress import service
from app.modules.progress.schemas import DayRef, DayScoreOut

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("/day", response_model=DayScoreOut)
async def day(
    user: CurrentUser,
    db: DB,
    on: Annotated[date | None, Query(alias="date")] = None,
) -> DayScoreOut:
    out = await service.day_score(db, user, on or user_today(user.timezone))
    await db.commit()  # a leitura pode ter finalizado dias antigos (autocura)
    return out


@router.post("/close", response_model=DayScoreOut)
async def close(data: DayRef, user: CurrentUser, db: DB) -> DayScoreOut:
    out = await service.close_day(db, user, data.date)
    await db.commit()
    return out


@router.post("/reopen", response_model=DayScoreOut)
async def reopen(data: DayRef, user: CurrentUser, db: DB) -> DayScoreOut:
    out = await service.reopen_day(db, user, data.date)
    await db.commit()
    return out
