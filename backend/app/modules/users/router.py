from fastapi import APIRouter

from app.core.deps import DB, CurrentUser
from app.modules.users import service
from app.modules.users.schemas import (
    OnboardingComplete,
    UserOut,
    UserSettingsUpdate,
    UserUpdate,
)

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
async def read_me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)


@router.patch("/me", response_model=UserOut)
async def update_me(data: UserUpdate, user: CurrentUser, db: DB) -> UserOut:
    updated = await service.update_profile(db, user.id, data)
    await db.commit()
    return UserOut.model_validate(updated)


@router.patch("/me/settings", response_model=UserOut)
async def update_my_settings(data: UserSettingsUpdate, user: CurrentUser, db: DB) -> UserOut:
    updated = await service.update_settings(db, user.id, data)
    await db.commit()
    return UserOut.model_validate(updated)


@router.post("/me/onboarding", response_model=UserOut)
async def complete_onboarding(data: OnboardingComplete, user: CurrentUser, db: DB) -> UserOut:
    updated = await service.complete_onboarding(db, user.id, data)
    await db.commit()
    return UserOut.model_validate(updated)
