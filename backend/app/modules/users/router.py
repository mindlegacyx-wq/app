from typing import Annotated

from fastapi import APIRouter, Header, Query, status

from app.core.config import get_settings
from app.core.deps import DB, CurrentUser
from app.modules.users import push_service, service
from app.modules.users.schemas import (
    OnboardingComplete,
    PushStatusOut,
    PushSubscriptionIn,
    PushSubscriptionOut,
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


# --- Web Push ----------------------------------------------------------------------------


@router.get("/me/push", response_model=PushStatusOut)
async def push_status(user: CurrentUser, db: DB) -> PushStatusOut:
    s = get_settings()
    subs = await push_service.list_for_user(db, user.id)
    return PushStatusOut(
        enabled=s.push_enabled,
        public_key=s.vapid_public_key or None,
        subscriptions=len(subs),
    )


@router.post(
    "/me/push/subscriptions",
    response_model=PushSubscriptionOut,
    status_code=status.HTTP_201_CREATED,
)
async def subscribe_push(
    data: PushSubscriptionIn,
    user: CurrentUser,
    db: DB,
    user_agent: Annotated[str | None, Header()] = None,
) -> PushSubscriptionOut:
    sub = await push_service.upsert(db, user.id, data, user_agent)
    await db.commit()
    return PushSubscriptionOut.model_validate(sub)


@router.delete("/me/push/subscriptions", status_code=status.HTTP_204_NO_CONTENT)
async def unsubscribe_push(
    user: CurrentUser, db: DB, endpoint: Annotated[str, Query(min_length=1)]
) -> None:
    await push_service.remove(db, user.id, endpoint)
    await db.commit()
