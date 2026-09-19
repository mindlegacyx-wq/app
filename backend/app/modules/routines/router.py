from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, status

from app.core.dates import user_today
from app.core.deps import DB, CurrentUser
from app.modules.routines import service
from app.modules.routines.schemas import (
    CheckIn,
    DayOut,
    ReorderIn,
    RoutineIn,
    RoutineItemIn,
    RoutineItemOut,
    RoutineItemUpdate,
    RoutineOut,
    RoutineUpdate,
)

router = APIRouter(prefix="/routines", tags=["routines"])


# --- Dia (precisa vir antes de /{routine_id}) -------------------------------------------


@router.get("/day", response_model=DayOut)
async def day(
    user: CurrentUser,
    db: DB,
    on: Annotated[date | None, Query(alias="date", description="Padrão: hoje no seu fuso")] = None,
) -> DayOut:
    return await service.day_overview(db, user.id, on or user_today(user.timezone))


@router.put("/items/{item_id}/check", status_code=status.HTTP_204_NO_CONTENT)
async def check_item(item_id: UUID, data: CheckIn, user: CurrentUser, db: DB) -> None:
    await service.set_item_check(db, user.id, user.timezone, item_id, data.date, data.done)
    await db.commit()


# --- Rotinas -----------------------------------------------------------------------------


@router.get("", response_model=list[RoutineOut])
async def list_routines(user: CurrentUser, db: DB) -> list[RoutineOut]:
    return [RoutineOut.model_validate(r) for r in await service.list_routines(db, user.id)]


@router.post("", response_model=RoutineOut, status_code=status.HTTP_201_CREATED)
async def create_routine(data: RoutineIn, user: CurrentUser, db: DB) -> RoutineOut:
    routine = await service.create_routine(db, user.id, data)
    await db.commit()
    return RoutineOut.model_validate(routine)


@router.get("/{routine_id}", response_model=RoutineOut)
async def get_routine(routine_id: UUID, user: CurrentUser, db: DB) -> RoutineOut:
    return RoutineOut.model_validate(await service.get_routine(db, user.id, routine_id))


@router.patch("/{routine_id}", response_model=RoutineOut)
async def update_routine(
    routine_id: UUID, data: RoutineUpdate, user: CurrentUser, db: DB
) -> RoutineOut:
    routine = await service.update_routine(db, user.id, routine_id, data)
    await db.commit()
    return RoutineOut.model_validate(routine)


@router.delete("/{routine_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_routine(routine_id: UUID, user: CurrentUser, db: DB) -> None:
    await service.delete_routine(db, user.id, routine_id)
    await db.commit()


# --- Itens -------------------------------------------------------------------------------


@router.post(
    "/{routine_id}/items", response_model=RoutineItemOut, status_code=status.HTTP_201_CREATED
)
async def add_item(
    routine_id: UUID, data: RoutineItemIn, user: CurrentUser, db: DB
) -> RoutineItemOut:
    item = await service.add_item(db, user.id, routine_id, data)
    await db.commit()
    return RoutineItemOut.model_validate(item)


@router.put("/{routine_id}/items/order", response_model=RoutineOut)
async def reorder_items(routine_id: UUID, data: ReorderIn, user: CurrentUser, db: DB) -> RoutineOut:
    routine = await service.reorder_items(db, user.id, routine_id, data.item_ids)
    await db.commit()
    return RoutineOut.model_validate(routine)


@router.patch("/items/{item_id}", response_model=RoutineItemOut)
async def update_item(
    item_id: UUID, data: RoutineItemUpdate, user: CurrentUser, db: DB
) -> RoutineItemOut:
    item = await service.update_item(db, user.id, item_id, data)
    await db.commit()
    return RoutineItemOut.model_validate(item)


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(item_id: UUID, user: CurrentUser, db: DB) -> None:
    await service.delete_item(db, user.id, item_id)
    await db.commit()
