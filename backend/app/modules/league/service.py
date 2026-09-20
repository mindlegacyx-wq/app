"""Liga semanal (Fase 14).

Sete competidores: você e seis robôs. Segunda-feira vira a chave — os dois primeiros sobem de
divisão, os dois últimos caem. O seu XP vem dos seus dias (módulo `progress`); o dos robôs, de
uma semente determinística (`bots.py`). Só o **resultado das semanas encerradas** vai para o
banco: a semana corrente é calculada na hora, então nada precisa rodar em segundo plano.
"""

from dataclasses import dataclass
from datetime import date, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dates import now_utc, user_today
from app.modules.league import bots as bots_mod
from app.modules.league.models import (
    ORDER,
    LeagueWeek,
    Outcome,
    Tier,
    promote,
    relegate,
)
from app.modules.league.schemas import LastResultOut, LeagueOut, MemberOut
from app.modules.progress import service as progress_service
from app.modules.users.models import User

PROMOTION_SLOTS = 2
RELEGATION_SLOTS = 2
MEMBERS = bots_mod.BOTS_PER_LEAGUE + 1
MAX_BACKFILL_WEEKS = 52


def week_start_of(day: date) -> date:
    """Segunda-feira da semana desse dia. A liga sempre vira na segunda."""
    return day - timedelta(days=day.weekday())


def _outcome_for(rank: int, tier: Tier) -> tuple[Outcome, Tier]:
    if rank <= PROMOTION_SLOTS and tier != Tier.diamond:
        return Outcome.promoted, promote(tier)
    if rank > MEMBERS - RELEGATION_SLOTS and tier != Tier.bronze:
        return Outcome.relegated, relegate(tier)
    return Outcome.stayed, tier


def _standings(you_xp: int, bots: list[bots_mod.Bot], bot_xp: list[int]) -> list[MemberOut]:
    """Ordena por XP. Empate com robô é do usuário — o benefício da dúvida é de quem sua."""
    rows: list[tuple[int, bool, str, str, str | None]] = [
        (you_xp, False, "you", "Você", None),
        *((xp, True, bot.key, bot.name, bot.tagline) for bot, xp in zip(bots, bot_xp, strict=True)),
    ]
    rows.sort(key=lambda r: (-r[0], r[1], r[3]))
    return [
        MemberOut(
            key=key,
            name=name,
            is_bot=is_bot,
            tagline=tagline,
            xp=xp,
            rank=i + 1,
            is_you=not is_bot,
        )
        for i, (xp, is_bot, key, name, tagline) in enumerate(rows)
    ]


async def _last_closed(db: AsyncSession, user_id) -> LeagueWeek | None:
    return await db.scalar(
        select(LeagueWeek)
        .where(LeagueWeek.user_id == user_id)
        .order_by(LeagueWeek.week_start.desc())
        .limit(1)
    )


async def _row_for(db: AsyncSession, user_id, week_start: date) -> LeagueWeek | None:
    return await db.scalar(
        select(LeagueWeek).where(LeagueWeek.user_id == user_id, LeagueWeek.week_start == week_start)
    )


async def ensure_closed_through(db: AsyncSession, user: User, through: date) -> int:
    """Encerra todas as semanas que já passaram e ainda não têm resultado. Idempotente."""
    start = week_start_of(progress_service.first_day(user))
    if through < start:
        return 0
    last = await _last_closed(db, user.id)
    cursor = last.week_start + timedelta(days=7) if last else start
    tier = last.next_tier if last else Tier.bronze
    if (through - cursor).days > MAX_BACKFILL_WEEKS * 7:
        cursor = through - timedelta(days=MAX_BACKFILL_WEEKS * 7)
    closed = 0
    while cursor <= through:
        if await _row_for(db, user.id, cursor) is None:
            you_xp = await progress_service.xp_in_range(
                db, user, cursor, cursor + timedelta(days=6)
            )
            drawn = bots_mod.draw(user.id, cursor, tier)
            table = _standings(you_xp, drawn, [bots_mod.xp_so_far(b, 7, None) for b in drawn])
            rank = next(m.rank for m in table if m.is_you)
            outcome, next_tier = _outcome_for(rank, tier)
            db.add(
                LeagueWeek(
                    user_id=user.id,
                    week_start=cursor,
                    tier=tier,
                    rank=rank,
                    xp=you_xp,
                    outcome=outcome,
                    next_tier=next_tier,
                )
            )
            tier = next_tier
            closed += 1
        else:
            row = await _row_for(db, user.id, cursor)
            tier = row.next_tier if row else tier
        cursor += timedelta(days=7)
    await db.flush()
    return closed


async def current(db: AsyncSession, user: User) -> LeagueOut:
    today = user_today(user.timezone)
    week = week_start_of(today)
    await ensure_closed_through(db, user, week - timedelta(days=7))

    last = await _last_closed(db, user.id)
    tier = last.next_tier if last else Tier.bronze

    days_done = (today - week).days  # 0 = segunda
    local = now_utc().astimezone(ZoneInfo(user.timezone))
    minutes = local.hour * 60 + local.minute

    you_xp = await progress_service.xp_in_range(db, user, week, today)
    drawn = bots_mod.draw(user.id, week, tier)
    table = _standings(you_xp, drawn, [bots_mod.xp_so_far(b, days_done, minutes) for b in drawn])
    you = next(m for m in table if m.is_you)
    above = table[you.rank - 2] if you.rank > 1 else None

    return LeagueOut(
        tier=tier,
        week_start=week,
        week_end=week + timedelta(days=6),
        days_left=6 - days_done,
        members=table,
        your_rank=you.rank,
        your_xp=you.xp,
        promotion_slots=PROMOTION_SLOTS,
        relegation_slots=RELEGATION_SLOTS,
        can_promote=tier != Tier.diamond,
        can_relegate=tier != Tier.bronze,
        to_next_rank=max(0, above.xp - you.xp) if above else None,
        last_result=(
            LastResultOut(
                week_start=last.week_start,
                tier=last.tier,
                rank=last.rank,
                xp=last.xp,
                outcome=last.outcome,
                next_tier=last.next_tier,
                seen=last.seen_at is not None,
            )
            if last
            else None
        ),
    )


@dataclass
class LeagueStats:
    """O que a liga já rendeu na vida da conta (alimenta as conquistas)."""

    weeks_played: int
    promotions: int
    wins: int  # semanas terminadas em 1º
    best_tier: Tier


async def lifetime_stats(db: AsyncSession, user: User) -> LeagueStats:
    rows = list(await db.scalars(select(LeagueWeek).where(LeagueWeek.user_id == user.id)))
    last = await _last_closed(db, user.id)
    reached = [r.tier for r in rows] + [r.next_tier for r in rows]
    if last is not None:
        reached.append(last.next_tier)
    best = max(reached, key=ORDER.index) if reached else Tier.bronze
    return LeagueStats(
        weeks_played=len(rows),
        promotions=sum(1 for r in rows if r.outcome == Outcome.promoted),
        wins=sum(1 for r in rows if r.rank == 1),
        best_tier=best,
    )


async def mark_last_seen(db: AsyncSession, user: User) -> None:
    """Marca o resultado da última semana como visto (a comemoração aparece uma vez só)."""
    last = await _last_closed(db, user.id)
    if last is not None and last.seen_at is None:
        last.seen_at = now_utc()
        await db.flush()
