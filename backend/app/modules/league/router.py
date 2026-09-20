from fastapi import APIRouter, status

from app.core.deps import DB, CurrentUser
from app.modules.league import service
from app.modules.league.schemas import LeagueOut

router = APIRouter(prefix="/league", tags=["league"])


@router.get("", response_model=LeagueOut)
async def current(user: CurrentUser, db: DB) -> LeagueOut:
    out = await service.current(db, user)
    await db.commit()
    return out


@router.post("/seen", status_code=status.HTTP_204_NO_CONTENT)
async def seen(user: CurrentUser, db: DB) -> None:
    await service.mark_last_seen(db, user)
    await db.commit()
