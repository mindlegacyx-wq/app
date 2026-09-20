from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, status

from app.core.dates import user_today
from app.core.deps import DB, CurrentUser
from app.modules.tasks import service
from app.modules.tasks.schemas import (
    CategoryIn,
    CategoryOut,
    CategoryUpdate,
    RecurrenceIn,
    RecurrenceOut,
    RecurrenceUpdate,
    TaskIn,
    TaskOut,
    TasksDayOut,
    TaskUpdate,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])


# --- Dia ---------------------------------------------------------------------------------


@router.get("/day", response_model=TasksDayOut)
async def day(
    user: CurrentUser,
    db: DB,
    on: Annotated[date | None, Query(alias="date")] = None,
) -> TasksDayOut:
    day_out = await service.day_overview(
        db, user.id, on or user_today(user.timezone), user.timezone
    )
    await db.commit()  # as tarefas fixas do dia podem ter acabado de nascer
    return day_out


# --- Categorias (antes de /{task_id}) ----------------------------------------------------


@router.get("/categories", response_model=list[CategoryOut])
async def list_categories(user: CurrentUser, db: DB) -> list[CategoryOut]:
    return [CategoryOut.model_validate(c) for c in await service.list_categories(db, user.id)]


@router.post("/categories", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
async def create_category(data: CategoryIn, user: CurrentUser, db: DB) -> CategoryOut:
    cat = await service.create_category(db, user.id, data)
    await db.commit()
    return CategoryOut.model_validate(cat)


@router.patch("/categories/{category_id}", response_model=CategoryOut)
async def update_category(
    category_id: UUID, data: CategoryUpdate, user: CurrentUser, db: DB
) -> CategoryOut:
    cat = await service.update_category(db, user.id, category_id, data)
    await db.commit()
    return CategoryOut.model_validate(cat)


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(category_id: UUID, user: CurrentUser, db: DB) -> None:
    await service.delete_category(db, user.id, category_id)
    await db.commit()


# --- Tarefas fixas (antes de /{task_id}) -------------------------------------------------


@router.get("/recurrences", response_model=list[RecurrenceOut])
async def list_recurrences(user: CurrentUser, db: DB) -> list[RecurrenceOut]:
    return [RecurrenceOut.model_validate(r) for r in await service.list_recurrences(db, user.id)]


@router.post("/recurrences", response_model=RecurrenceOut, status_code=status.HTTP_201_CREATED)
async def create_recurrence(data: RecurrenceIn, user: CurrentUser, db: DB) -> RecurrenceOut:
    rec = await service.create_recurrence(db, user.id, user.timezone, data)
    await db.commit()
    return RecurrenceOut.model_validate(rec)


@router.patch("/recurrences/{rec_id}", response_model=RecurrenceOut)
async def update_recurrence(
    rec_id: UUID, data: RecurrenceUpdate, user: CurrentUser, db: DB
) -> RecurrenceOut:
    rec = await service.update_recurrence(db, user.id, user.timezone, rec_id, data)
    await db.commit()
    return RecurrenceOut.model_validate(rec)


@router.delete("/recurrences/{rec_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recurrence(rec_id: UUID, user: CurrentUser, db: DB) -> None:
    await service.delete_recurrence(db, user.id, user.timezone, rec_id)
    await db.commit()


# --- Tarefas -----------------------------------------------------------------------------


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(data: TaskIn, user: CurrentUser, db: DB) -> TaskOut:
    task = await service.create_task(db, user.id, user.timezone, data)
    await db.commit()
    return TaskOut.model_validate(task)


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(task_id: UUID, data: TaskUpdate, user: CurrentUser, db: DB) -> TaskOut:
    task = await service.update_task(db, user.id, user.timezone, task_id, data)
    await db.commit()
    return TaskOut.model_validate(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(task_id: UUID, user: CurrentUser, db: DB) -> None:
    await service.delete_task(db, user.id, task_id)
    await db.commit()
