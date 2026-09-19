from fastapi import APIRouter

from app.core.deps import DB, CurrentUser
from app.modules.trash import service
from app.modules.trash.schemas import RestoreIn, RestoreOut, TrashOut

router = APIRouter(prefix="/trash", tags=["trash"])


@router.get("", response_model=TrashOut)
async def list_trash(user: CurrentUser, db: DB) -> TrashOut:
    return await service.list_trash(db, user.id)


@router.post("/restore", response_model=RestoreOut)
async def restore(data: RestoreIn, user: CurrentUser, db: DB) -> RestoreOut:
    out = await service.restore(db, user.id, data.kind, data.id)
    await db.commit()
    return out
