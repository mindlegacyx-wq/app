"""Regras das metas.

- Progresso da meta = ações concluídas ÷ total de ações (calculado, não armazenado).
- Só ações de metas **ativas** entram no dia e no percentual. Ação com data conta no dia
  planejado; sem data, conta só no progresso da meta.
- Concluir uma ação registra `done_at` agora. Se o dia planejado ainda está aberto, fica lá;
  se está fechado, é futuro ou a ação não tinha data, a data passa a ser hoje: o crédito vai
  para o dia em que o trabalho aconteceu (mesma regra das tarefas).
- Concluir a meta guarda `completed_at`; as ações pendentes ficam como estão, mas deixam de
  contar no dia (a meta não está mais ativa).
"""

from datetime import date
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dates import is_day_open, now_utc, user_today
from app.core.errors import ConflictError, NotFoundError
from app.modules.goals.models import Goal, GoalAction, GoalStatus
from app.modules.goals.schemas import (
    ActionIn,
    ActionUpdate,
    DayActionOut,
    GoalIn,
    GoalOut,
    GoalsDayOut,
    GoalUpdate,
)

# --- Consultas ---------------------------------------------------------------------------


def _alive_goals(user_id: UUID):
    return (
        select(Goal)
        .where(Goal.user_id == user_id, Goal.deleted_at.is_(None))
        .options(selectinload(Goal.actions.and_(GoalAction.deleted_at.is_(None))))
        .order_by(Goal.sort_order, Goal.created_at)
    )


def to_out(goal: Goal) -> GoalOut:
    total = len(goal.actions)
    done = sum(1 for a in goal.actions if a.is_done)
    return GoalOut(
        id=goal.id,
        title=goal.title,
        description=goal.description,
        area=goal.area,
        deadline=goal.deadline,
        status=goal.status,
        completed_at=goal.completed_at,
        sort_order=goal.sort_order,
        actions=goal.actions,  # type: ignore[arg-type]
        actions_total=total,
        actions_done=done,
        progress_pct=round(done * 100 / total) if total else 0,
    )


async def list_goals(db: AsyncSession, user_id: UUID, status: GoalStatus | None) -> list[Goal]:
    q = _alive_goals(user_id)
    if status is not None:
        q = q.where(Goal.status == status)
    return list((await db.scalars(q)).unique())


async def get_goal(db: AsyncSession, user_id: UUID, goal_id: UUID) -> Goal:
    goal = (
        (await db.scalars(_alive_goals(user_id).where(Goal.id == goal_id))).unique().one_or_none()
    )
    if goal is None:
        raise NotFoundError("Meta não encontrada.")
    return goal


async def _get_action(db: AsyncSession, user_id: UUID, action_id: UUID) -> GoalAction:
    action = await db.scalar(
        select(GoalAction).where(
            GoalAction.id == action_id,
            GoalAction.user_id == user_id,
            GoalAction.deleted_at.is_(None),
        )
    )
    if action is None:
        raise NotFoundError("Ação não encontrada.")
    return action


# --- Metas -------------------------------------------------------------------------------


async def create_goal(db: AsyncSession, user_id: UUID, data: GoalIn) -> Goal:
    next_order = await db.scalar(
        select(func.coalesce(func.max(Goal.sort_order), -1) + 1).where(Goal.user_id == user_id)
    )
    goal = Goal(
        user_id=user_id,
        title=data.title,
        description=data.description,
        area=data.area,
        deadline=data.deadline,
        status=GoalStatus.active,
        sort_order=next_order or 0,
    )
    db.add(goal)
    await db.flush()
    return await get_goal(db, user_id, goal.id)


async def update_goal(db: AsyncSession, user_id: UUID, goal_id: UUID, data: GoalUpdate) -> Goal:
    goal = await get_goal(db, user_id, goal_id)
    fields = data.model_dump(exclude_unset=True, exclude={"clear_description", "clear_deadline"})
    new_status = fields.pop("status", None)
    for field, value in fields.items():
        if value is not None:
            setattr(goal, field, value)
    if data.clear_description:
        goal.description = None
    if data.clear_deadline:
        goal.deadline = None
    if new_status is not None and new_status != goal.status:
        goal.status = new_status
        goal.completed_at = now_utc() if new_status == GoalStatus.completed else None
    await db.flush()
    return goal


async def delete_goal(db: AsyncSession, user_id: UUID, goal_id: UUID) -> None:
    goal = await get_goal(db, user_id, goal_id)
    goal.deleted_at = now_utc()
    await db.flush()


# --- Ações -------------------------------------------------------------------------------


async def add_action(db: AsyncSession, user_id: UUID, goal_id: UUID, data: ActionIn) -> GoalAction:
    goal = await get_goal(db, user_id, goal_id)
    next_order = max((a.sort_order for a in goal.actions), default=-1) + 1
    action = GoalAction(
        goal_id=goal.id,
        user_id=user_id,
        title=data.title,
        due_date=data.due_date,
        is_done=False,
        sort_order=next_order,
    )
    db.add(action)
    await db.flush()
    return action


def _credit_day(planned: date | None, timezone: str) -> date:
    if planned is not None and is_day_open(planned, timezone):
        return planned
    return user_today(timezone)


async def update_action(
    db: AsyncSession, user_id: UUID, timezone: str, action_id: UUID, data: ActionUpdate
) -> GoalAction:
    action = await _get_action(db, user_id, action_id)
    fields = data.model_dump(exclude_unset=True, exclude={"clear_due_date"})
    is_done = fields.pop("is_done", None)
    for field, value in fields.items():
        if value is not None:
            setattr(action, field, value)
    if data.clear_due_date:
        action.due_date = None
    if is_done is not None and is_done != action.is_done:
        action.is_done = is_done
        if is_done:
            action.done_at = now_utc()
            action.due_date = _credit_day(action.due_date, timezone)
        else:
            action.done_at = None
    await db.flush()
    return action


async def delete_action(db: AsyncSession, user_id: UUID, action_id: UUID) -> None:
    action = await _get_action(db, user_id, action_id)
    action.deleted_at = now_utc()
    await db.flush()


async def reorder_actions(
    db: AsyncSession, user_id: UUID, goal_id: UUID, action_ids: list[UUID]
) -> Goal:
    goal = await get_goal(db, user_id, goal_id)
    by_id = {a.id: a for a in goal.actions}
    if set(action_ids) != set(by_id):
        raise ConflictError("A lista de ações está desatualizada. Recarregue e tente de novo.")
    for position, action_id in enumerate(action_ids):
        by_id[action_id].sort_order = position
    await db.flush()
    goal.actions.sort(key=lambda a: a.sort_order)
    return goal


# --- Dia ---------------------------------------------------------------------------------


async def day_overview(db: AsyncSession, user_id: UUID, day: date) -> GoalsDayOut:
    base = (
        select(GoalAction, Goal.title)
        .join(Goal, Goal.id == GoalAction.goal_id)
        .where(
            GoalAction.user_id == user_id,
            GoalAction.deleted_at.is_(None),
            Goal.deleted_at.is_(None),
            Goal.status == GoalStatus.active,
        )
    )
    today_rows = (
        await db.execute(
            base.where(GoalAction.due_date == day).order_by(
                GoalAction.is_done, GoalAction.sort_order
            )
        )
    ).all()
    overdue_rows = (
        await db.execute(
            base.where(GoalAction.due_date < day, GoalAction.is_done.is_(False)).order_by(
                GoalAction.due_date, GoalAction.sort_order
            )
        )
    ).all()

    def to_day(a: GoalAction, goal_title: str) -> DayActionOut:
        return DayActionOut(
            id=a.id,
            goal_id=a.goal_id,
            goal_title=goal_title,
            title=a.title,
            due_date=a.due_date,  # type: ignore[arg-type]
            is_done=a.is_done,
            done_at=a.done_at,
        )

    actions = [to_day(a, t) for a, t in today_rows]
    return GoalsDayOut(
        date=day,
        actions=actions,
        overdue=[to_day(a, t) for a, t in overdue_rows],
        planned=len(actions),
        completed=sum(1 for a in actions if a.is_done),
    )
