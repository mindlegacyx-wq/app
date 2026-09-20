"""Conquistas (Fase 15).

Cada selo é uma regra sobre números que já existem (sequência, dias perfeitos, nível, liga,
itens por área). A cada leitura os números são recalculados e os selos novos são gravados com a
data — é assim que a tela sabe dizer "conquistado em 14/10" e mostrar o aviso uma vez só.
"""

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dates import now_utc
from app.modules.achievements.catalog import CATALOG
from app.modules.achievements.models import AchievementUnlock
from app.modules.achievements.schemas import AchievementOut, AchievementsOut
from app.modules.league import service as league_service
from app.modules.league.models import ORDER
from app.modules.player import service as player_service
from app.modules.progress import service as progress_service
from app.modules.users.models import User


@dataclass
class Metrics:
    best_streak: int
    perfect_days: int
    closed_days: int
    level: int
    total_xp: int
    weeks_played: int
    promotions: int
    wins: int
    best_tier: int  # 1 = Bronze … 5 = Diamante
    wake_done: int
    routines_done: int
    tasks_done: int
    workout_done: int
    study_done: int
    goals_done: int


async def measure(db: AsyncSession, user: User) -> Metrics:
    life = await progress_service.lifetime_stats(db, user)
    league = await league_service.lifetime_stats(db, user)
    player = await player_service.state(db, user)
    done = life.completed
    return Metrics(
        best_streak=life.best_streak,
        perfect_days=life.perfect_days,
        closed_days=life.closed_days,
        level=player.level,
        total_xp=player.total_xp,
        weeks_played=league.weeks_played,
        promotions=league.promotions,
        wins=league.wins,
        best_tier=ORDER.index(league.best_tier) + 1,
        wake_done=done.get("wake", 0),
        routines_done=done.get("routines", 0),
        tasks_done=done.get("tasks", 0),
        workout_done=done.get("workout", 0),
        study_done=done.get("study", 0),
        goals_done=done.get("goals", 0),
    )


async def state(db: AsyncSession, user: User) -> AchievementsOut:
    metrics = await measure(db, user)
    rows = {
        r.key: r
        for r in await db.scalars(
            select(AchievementUnlock).where(AchievementUnlock.user_id == user.id)
        )
    }
    now = now_utc()
    items: list[AchievementOut] = []
    for ach in CATALOG:
        value = int(getattr(metrics, ach.metric, 0))
        unlocked = value >= ach.target
        row = rows.get(ach.key)
        if unlocked and row is None:
            row = AchievementUnlock(user_id=user.id, key=ach.key, unlocked_at=now)
            db.add(row)
            rows[ach.key] = row
        items.append(
            AchievementOut(
                key=ach.key,
                name=ach.name,
                hint=ach.hint,
                family=ach.family,
                icon=ach.icon,
                target=ach.target,
                progress=min(value, ach.target),
                unlocked=unlocked,
                unlocked_at=row.unlocked_at if row else None,
                seen=bool(row and row.seen_at is not None),
            )
        )
    await db.flush()
    # Conquistados primeiro (mais recentes no topo); depois os que estão mais perto de cair.
    items.sort(
        key=lambda i: (
            not i.unlocked,
            -(i.unlocked_at.timestamp() if i.unlocked and i.unlocked_at else 0),
            -(i.progress / i.target),
        )
    )
    return AchievementsOut(
        unlocked=sum(1 for i in items if i.unlocked), total=len(items), items=items
    )


async def mark_seen(db: AsyncSession, user: User) -> None:
    """Marca todos os selos já conquistados como vistos (o aviso aparece uma vez)."""
    rows = await db.scalars(
        select(AchievementUnlock).where(
            AchievementUnlock.user_id == user.id, AchievementUnlock.seen_at.is_(None)
        )
    )
    now = now_utc()
    for row in rows:
        row.seen_at = now
    await db.flush()
