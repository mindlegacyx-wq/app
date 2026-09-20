from fastapi import APIRouter

from app.core.deps import DB, CurrentUser
from app.modules.player import service
from app.modules.player.schemas import PlayerOut

router = APIRouter(prefix="/player", tags=["player"])


@router.get("", response_model=PlayerOut)
async def me(user: CurrentUser, db: DB) -> PlayerOut:
    return await service.state(db, user)
