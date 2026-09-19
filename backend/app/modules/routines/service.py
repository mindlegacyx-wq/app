"""Regras das rotinas. Todo acesso filtra por user_id: é o isolamento multiusuário."""

from datetime import date, time
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dates import ensure_recordable_day, now_utc, weekday_index
from app.core.errors import ConflictError, NotFoundError
from app.modules.routines.models import Routine, RoutineItem, RoutineItemLog, RoutineKind
from app.modules.routines.schemas import (
    DayItemOut,
    DayOut,
    DayRoutineOut,
    RoutineIn,
    RoutineItemIn,
    RoutineItemUpdate,
    RoutineUpdate,
)

DEFAULT_EVENING_START = time(22, 0)


# --- Consultas ---------------------------------------------------------------------------


def _alive_routines(user_id: UUID):
    return (
        select(Routine)
        .where(Routine.user_id == user_id, Routine.deleted_at.is_(None))
        .options(selectinload(Routine.items.and_(RoutineItem.deleted_at.is_(None))))
        .order_by(Routine.sort_order, Routine.created_at)
    )


async def list_routines(db: AsyncSession, user_id: UUID) -> list[Routine]:
    return list((await db.scalars(_alive_routines(user_id))).unique())


async def get_routine(db: AsyncSession, user_id: UUID, routine_id: UUID) -> Routine:
    routine = (
        (await db.scalars(_alive_routines(user_id).where(Routine.id == routine_id)))
        .unique()
        .one_or_none()
    )
    if routine is None:
        raise NotFoundError("Rotina não encontrada.")
    return routine


async def _get_item(db: AsyncSession, user_id: UUID, item_id: UUID) -> RoutineItem:
    item = await db.scalar(
        select(RoutineItem).where(
            RoutineItem.id == item_id,
            RoutineItem.user_id == user_id,
            RoutineItem.deleted_at.is_(None),
        )
    )
    if item is None:
        raise NotFoundError("Item não encontrado.")
    return item


# --- Rotinas -----------------------------------------------------------------------------


async def create_routine(db: AsyncSession, user_id: UUID, data: RoutineIn) -> Routine:
    if data.kind != RoutineKind.custom:
        exists = await db.scalar(
            select(func.count())
            .select_from(Routine)
            .where(
                Routine.user_id == user_id,
                Routine.kind == data.kind,
                Routine.deleted_at.is_(None),
            )
        )
        if exists:
            raise ConflictError("Você já tem uma rotina desse tipo. Edite a existente.")

    next_order = await db.scalar(
        select(func.coalesce(func.max(Routine.sort_order), -1) + 1).where(
            Routine.user_id == user_id
        )
    )
    routine = Routine(
        user_id=user_id,
        name=data.name,
        kind=data.kind,
        start_time=data.start_time,
        days_of_week=data.days_of_week,
        is_active=True,
        sort_order=next_order or 0,
    )
    db.add(routine)
    await db.flush()
    return await get_routine(db, user_id, routine.id)


async def update_routine(
    db: AsyncSession, user_id: UUID, routine_id: UUID, data: RoutineUpdate
) -> Routine:
    routine = await get_routine(db, user_id, routine_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(routine, field, value)
    await db.flush()
    return routine


async def delete_routine(db: AsyncSession, user_id: UUID, routine_id: UUID) -> None:
    routine = await get_routine(db, user_id, routine_id)
    routine.deleted_at = now_utc()
    await db.flush()


async def ensure_default_routines(db: AsyncSession, user_id: UUID, wake_time: time | None) -> None:
    """Setup inicial: cria Manhã e Noite vazias se o usuário ainda não tem nenhuma rotina."""
    count = await db.scalar(
        select(func.count()).select_from(Routine).where(Routine.user_id == user_id)
    )
    if count:
        return
    db.add_all(
        [
            Routine(
                user_id=user_id,
                name="Manhã",
                kind=RoutineKind.morning,
                start_time=wake_time,
                days_of_week=[0, 1, 2, 3, 4, 5, 6],
                is_active=True,
                sort_order=0,
            ),
            Routine(
                user_id=user_id,
                name="Noite",
                kind=RoutineKind.evening,
                start_time=DEFAULT_EVENING_START,
                days_of_week=[0, 1, 2, 3, 4, 5, 6],
                is_active=True,
                sort_order=1,
            ),
        ]
    )
    await db.flush()


# --- Itens -------------------------------------------------------------------------------


async def add_item(
    db: AsyncSession, user_id: UUID, routine_id: UUID, data: RoutineItemIn
) -> RoutineItem:
    routine = await get_routine(db, user_id, routine_id)
    next_order = max((i.sort_order for i in routine.items), default=-1) + 1
    item = RoutineItem(
        routine_id=routine.id,
        user_id=user_id,
        title=data.title,
        duration_minutes=data.duration_minutes,
        sort_order=next_order,
        is_active=True,
    )
    db.add(item)
    await db.flush()
    return item


async def update_item(
    db: AsyncSession, user_id: UUID, item_id: UUID, data: RoutineItemUpdate
) -> RoutineItem:
    item = await _get_item(db, user_id, item_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    await db.flush()
    return item


async def delete_item(db: AsyncSession, user_id: UUID, item_id: UUID) -> None:
    item = await _get_item(db, user_id, item_id)
    item.deleted_at = now_utc()
    await db.flush()


async def reorder_items(
    db: AsyncSession, user_id: UUID, routine_id: UUID, item_ids: list[UUID]
) -> Routine:
    routine = await get_routine(db, user_id, routine_id)
    by_id = {i.id: i for i in routine.items}
    if set(item_ids) != set(by_id):
        raise ConflictError("A lista de itens está desatualizada. Recarregue e tente de novo.")
    for position, item_id in enumerate(item_ids):
        by_id[item_id].sort_order = position
    await db.flush()
    routine.items.sort(key=lambda i: i.sort_order)
    return routine


# --- Dia (checklist) ---------------------------------------------------------------------


async def routines_for_day(db: AsyncSession, user_id: UUID, day: date) -> list[Routine]:
    weekday = weekday_index(day)
    routines = await list_routines(db, user_id)
    return [
        r
        for r in routines
        if r.is_active and weekday in r.days_of_week and any(i.is_active for i in r.items)
    ]


async def day_overview(db: AsyncSession, user_id: UUID, day: date) -> DayOut:
    routines = await routines_for_day(db, user_id, day)
    item_ids = [i.id for r in routines for i in r.items if i.is_active]
    logs: dict[UUID, RoutineItemLog] = {}
    if item_ids:
        rows = await db.scalars(
            select(RoutineItemLog).where(
                RoutineItemLog.user_id == user_id,
                RoutineItemLog.date == day,
                RoutineItemLog.routine_item_id.in_(item_ids),
            )
        )
        logs = {log.routine_item_id: log for log in rows}

    out: list[DayRoutineOut] = []
    for r in routines:
        items = [
            DayItemOut(
                id=i.id,
                title=i.title,
                duration_minutes=i.duration_minutes,
                completed_at=logs[i.id].completed_at if i.id in logs else None,
            )
            for i in r.items
            if i.is_active
        ]
        done = sum(1 for i in items if i.completed_at is not None)
        out.append(
            DayRoutineOut(
                id=r.id,
                name=r.name,
                kind=r.kind,
                start_time=r.start_time,
                items=items,
                planned=len(items),
                completed=done,
            )
        )
    return DayOut(
        date=day,
        routines=out,
        planned=sum(r.planned for r in out),
        completed=sum(r.completed for r in out),
    )


async def set_item_check(
    db: AsyncSession, user_id: UUID, timezone: str, item_id: UUID, day: date, done: bool
) -> None:
    """Marca/desmarca um item num dia. Idempotente: repetir a chamada não muda nada."""
    ensure_recordable_day(day, timezone)
    item = await _get_item(db, user_id, item_id)

    if done:
        existing = await db.scalar(
            select(RoutineItemLog).where(
                RoutineItemLog.routine_item_id == item.id, RoutineItemLog.date == day
            )
        )
        if existing is None:
            db.add(
                RoutineItemLog(
                    user_id=user_id,
                    routine_item_id=item.id,
                    date=day,
                    completed_at=now_utc(),
                )
            )
    else:
        await db.execute(
            delete(RoutineItemLog).where(
                RoutineItemLog.routine_item_id == item.id,
                RoutineItemLog.user_id == user_id,
                RoutineItemLog.date == day,
            )
        )
    await db.flush()
