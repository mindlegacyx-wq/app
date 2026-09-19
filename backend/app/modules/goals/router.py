from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, status

from app.core.dates import user_today
from app.core.deps import DB, CurrentUser
from app.modules.goals import service
from app.modules.goals.models import GoalStatus
from app.modules.goals.schemas import (
    ActionIn,
    ActionOut,
    ActionUpdate,
    GoalIn,
    GoalOut,
    GoalsDayOut,
    GoalUpdate,
    ReorderIn,
)

router = APIRouter(prefix="/goals", tags=["goals"])


# --- Dia e ações (antes de /{goal_id}) ---------------------------------------------------


@router.get("/day", response_model=GoalsDayOut)
async def day(
    user: CurrentUser,
    db: DB,
    on: Annotated[date | None, Query(alias="date")] = None,
) -> GoalsDayOut:
    return await service.day_overview(db, user.id, on or user_today(user.timezone))


@router.patch("/actions/{action_id}", response_model=ActionOut)
async def update_action(
    action_id: UUID, data: ActionUpdate, user: CurrentUser, db: DB
) -> ActionOut:
    action = await service.update_action(db, user.id, user.timezone, action_id, data)
    await db.commit()
    return ActionOut.model_validate(action)


@router.delete("/actions/{action_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_action(action_id: UUID, user: CurrentUser, db: DB) -> None:
    await service.delete_action(db, user.id, action_id)
    await db.commit()


# --- Metas -------------------------------------------------------------------------------


@router.get("", response_model=list[GoalOut])
async def list_goals(
    user: CurrentUser,
    db: DB,
    goal_status: Annotated[GoalStatus | None, Query(alias="status")] = None,
) -> list[GoalOut]:
    return [service.to_out(g) for g in await service.list_goals(db, user.id, goal_status)]


@router.post("", response_model=GoalOut, status_code=status.HTTP_201_CREATED)
async def create_goal(data: GoalIn, user: CurrentUser, db: DB) -> GoalOut:
    goal = await service.create_goal(db, user.id, data)
    await db.commit()
    return service.to_out(goal)


@router.get("/{goal_id}", response_model=GoalOut)
async def get_goal(goal_id: UUID, user: CurrentUser, db: DB) -> GoalOut:
    return service.to_out(await service.get_goal(db, user.id, goal_id))


@router.patch("/{goal_id}", response_model=GoalOut)
async def update_goal(goal_id: UUID, data: GoalUpdate, user: CurrentUser, db: DB) -> GoalOut:
    goal = await service.update_goal(db, user.id, goal_id, data)
    await db.commit()
    return service.to_out(goal)


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(goal_id: UUID, user: CurrentUser, db: DB) -> None:
    await service.delete_goal(db, user.id, goal_id)
    await db.commit()


@router.post("/{goal_id}/actions", response_model=ActionOut, status_code=status.HTTP_201_CREATED)
async def add_action(goal_id: UUID, data: ActionIn, user: CurrentUser, db: DB) -> ActionOut:
    action = await service.add_action(db, user.id, goal_id, data)
    await db.commit()
    return ActionOut.model_validate(action)


@router.put("/{goal_id}/actions/order", response_model=GoalOut)
async def reorder_actions(goal_id: UUID, data: ReorderIn, user: CurrentUser, db: DB) -> GoalOut:
    goal = await service.reorder_actions(db, user.id, goal_id, data.action_ids)
    await db.commit()
    return service.to_out(goal)
