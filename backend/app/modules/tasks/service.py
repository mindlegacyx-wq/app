"""Regras das tarefas.

- A tarefa tem um dia planejado (`date`). Ela conta no percentual desse dia.
- Concluir registra `completed_at` agora. Se o dia planejado ainda está aberto (hoje, ou
  ontem antes do corte das 03:00), a tarefa fica onde está; se já fechou ou é futuro, ela
  passa para hoje: o crédito vai para o dia em que o trabalho aconteceu.
- Cancelada sai do planejado sem apagar o registro.
"""

from datetime import date
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dates import is_day_open, now_utc, user_today
from app.core.errors import NotFoundError
from app.core.softdelete import TrashKind
from app.modules.tasks.models import Task, TaskCategory, TaskPriority, TaskStatus
from app.modules.tasks.schemas import CategoryIn, CategoryUpdate, TaskIn, TasksDayOut, TaskUpdate

_PRIORITY_RANK = {TaskPriority.high: 0, TaskPriority.medium: 1, TaskPriority.low: 2}
_STATUS_RANK = {TaskStatus.pending: 0, TaskStatus.done: 1, TaskStatus.cancelled: 2}


def _sort_key(t: Task) -> tuple[int, int, int, str]:
    return (_STATUS_RANK[t.status], _PRIORITY_RANK[t.priority], t.sort_order, str(t.id))


# --- Categorias --------------------------------------------------------------------------


async def list_categories(db: AsyncSession, user_id: UUID) -> list[TaskCategory]:
    rows = await db.scalars(
        select(TaskCategory)
        .where(TaskCategory.user_id == user_id, TaskCategory.deleted_at.is_(None))
        .order_by(TaskCategory.sort_order, TaskCategory.created_at)
    )
    return list(rows)


async def _get_category(db: AsyncSession, user_id: UUID, category_id: UUID) -> TaskCategory:
    cat = await db.scalar(
        select(TaskCategory).where(
            TaskCategory.id == category_id,
            TaskCategory.user_id == user_id,
            TaskCategory.deleted_at.is_(None),
        )
    )
    if cat is None:
        raise NotFoundError("Categoria não encontrada.")
    return cat


async def create_category(db: AsyncSession, user_id: UUID, data: CategoryIn) -> TaskCategory:
    next_order = await db.scalar(
        select(func.coalesce(func.max(TaskCategory.sort_order), -1) + 1).where(
            TaskCategory.user_id == user_id
        )
    )
    cat = TaskCategory(
        user_id=user_id, name=data.name, color=data.color, sort_order=next_order or 0
    )
    db.add(cat)
    await db.flush()
    return cat


async def update_category(
    db: AsyncSession, user_id: UUID, category_id: UUID, data: CategoryUpdate
) -> TaskCategory:
    cat = await _get_category(db, user_id, category_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(cat, field, value)
    await db.flush()
    return cat


async def delete_category(db: AsyncSession, user_id: UUID, category_id: UUID) -> None:
    """Soft delete; as tarefas ficam, só perdem a categoria."""
    cat = await _get_category(db, user_id, category_id)
    cat.deleted_at = now_utc()
    await db.execute(
        update(Task)
        .where(Task.user_id == user_id, Task.category_id == category_id)
        .values(category_id=None)
    )
    await db.flush()


# --- Tarefas -----------------------------------------------------------------------------


async def _get_task(db: AsyncSession, user_id: UUID, task_id: UUID) -> Task:
    task = await db.scalar(
        select(Task).where(Task.id == task_id, Task.user_id == user_id, Task.deleted_at.is_(None))
    )
    if task is None:
        raise NotFoundError("Tarefa não encontrada.")
    return task


async def create_task(db: AsyncSession, user_id: UUID, timezone: str, data: TaskIn) -> Task:
    if data.category_id is not None:
        await _get_category(db, user_id, data.category_id)  # garante que é do usuário
    day = data.date or user_today(timezone)
    next_order = await db.scalar(
        select(func.coalesce(func.max(Task.sort_order), -1) + 1).where(
            Task.user_id == user_id, Task.date == day
        )
    )
    task = Task(
        user_id=user_id,
        category_id=data.category_id,
        title=data.title,
        notes=data.notes,
        date=day,
        priority=data.priority,
        status=TaskStatus.pending,
        sort_order=next_order or 0,
    )
    db.add(task)
    await db.flush()
    return task


def _completion_date(planned: date, timezone: str) -> date:
    """Dia que recebe o crédito: o planejado, se ainda está aberto; senão, hoje."""
    return planned if is_day_open(planned, timezone) else user_today(timezone)


async def update_task(
    db: AsyncSession, user_id: UUID, timezone: str, task_id: UUID, data: TaskUpdate
) -> Task:
    task = await _get_task(db, user_id, task_id)
    fields = data.model_dump(exclude_unset=True, exclude={"clear_category", "clear_notes"})

    if "category_id" in fields and fields["category_id"] is not None:
        await _get_category(db, user_id, fields["category_id"])
    if data.clear_category:
        fields["category_id"] = None
    if data.clear_notes:
        fields["notes"] = None

    new_status = fields.pop("status", None)
    for field, value in fields.items():
        if value is not None or field in ("category_id", "notes"):
            setattr(task, field, value)

    if new_status is not None and new_status != task.status:
        if new_status == TaskStatus.done:
            task.completed_at = now_utc()
            task.date = _completion_date(task.date, timezone)
        else:
            task.completed_at = None
        task.status = new_status

    await db.flush()
    return task


async def delete_task(db: AsyncSession, user_id: UUID, task_id: UUID) -> None:
    task = await _get_task(db, user_id, task_id)
    task.deleted_at = now_utc()
    await db.flush()


async def day_overview(db: AsyncSession, user_id: UUID, day: date) -> TasksDayOut:
    rows = await db.scalars(
        select(Task).where(Task.user_id == user_id, Task.date == day, Task.deleted_at.is_(None))
    )
    tasks = sorted(rows, key=_sort_key)

    overdue_rows = await db.scalars(
        select(Task)
        .where(
            Task.user_id == user_id,
            Task.date < day,
            Task.status == TaskStatus.pending,
            Task.deleted_at.is_(None),
        )
        .order_by(Task.date.desc())
    )
    overdue = sorted(
        overdue_rows, key=lambda t: (t.date, _PRIORITY_RANK[t.priority]), reverse=False
    )

    planned = [t for t in tasks if t.status != TaskStatus.cancelled]
    return TasksDayOut(
        date=day,
        tasks=tasks,  # type: ignore[arg-type]
        overdue=overdue,  # type: ignore[arg-type]
        planned=len(planned),
        completed=sum(1 for t in planned if t.status == TaskStatus.done),
    )


# --- Lixeira -----------------------------------------------------------------------------

TRASH_KINDS = [
    TrashKind(
        kind="task",
        label="Tarefas",
        model=Task,
        title=lambda t: t.title,
        subtitle=lambda t: t.date.strftime("%d/%m/%Y"),
    ),
    TrashKind(
        kind="task_category",
        label="Categorias",
        model=TaskCategory,
        title=lambda c: c.name,
    ),
]
