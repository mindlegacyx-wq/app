from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.core.dates import user_today
from app.core.deps import DB, CurrentUser
from app.modules.alarms import service
from app.modules.alarms.schemas import WakeConfirmIn, WakeDayOut

router = APIRouter(prefix="/wake", tags=["wake"])


@router.get("/day", response_model=WakeDayOut)
async def wake_day(
    user: CurrentUser,
    db: DB,
    on: Annotated[date | None, Query(alias="date")] = None,
) -> WakeDayOut:
    day = on or user_today(user.timezone)
    return await service.day_status(db, user.id, user.timezone, user.settings.wake_time, day)


@router.post("/confirm", response_model=WakeDayOut)
async def confirm(data: WakeConfirmIn, user: CurrentUser, db: DB) -> WakeDayOut:
    out = await service.confirm_manual(
        db, user.id, user.timezone, user.settings.wake_time, data.date
    )
    await db.commit()
    return out


@router.delete("/day", status_code=status.HTTP_204_NO_CONTENT)
async def undo(user: CurrentUser, db: DB, on: Annotated[date, Query(alias="date")]) -> None:
    await service.undo_manual(db, user.id, user.timezone, on)
    await db.commit()
