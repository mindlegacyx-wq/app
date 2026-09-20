from fastapi import APIRouter, status

from app.core.deps import DB, CurrentUser
from app.modules.achievements import service
from app.modules.achievements.schemas import AchievementsOut

router = APIRouter(prefix="/achievements", tags=["achievements"])


@router.get("", response_model=AchievementsOut)
async def list_achievements(user: CurrentUser, db: DB) -> AchievementsOut:
    out = await service.state(db, user)
    await db.commit()
    return out


@router.post("/seen", status_code=status.HTTP_204_NO_CONTENT)
async def seen(user: CurrentUser, db: DB) -> None:
    await service.mark_seen(db, user)
    await db.commit()
