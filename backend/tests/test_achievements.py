"""Fase 15: conquistas derivadas do histórico."""

from datetime import UTC, datetime, time, timedelta

from httpx import AsyncClient
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.achievements.catalog import BY_KEY, CATALOG
from app.modules.achievements.models import AchievementUnlock
from app.modules.progress.models import DailyScore
from tests.conftest import bearer
from tests.test_progress import _seed_day, _user_id
from tests.test_routines import onboard, today


def test_catalog_is_coherent() -> None:
    keys = [a.key for a in CATALOG]
    assert len(keys) == len(set(keys))  # sem chave repetida
    assert all(a.target > 0 for a in CATALOG)
    assert all(a.family in {"streak", "perfect", "level", "league", "area"} for a in CATALOG)
    assert len(BY_KEY) == len(CATALOG)


async def test_starts_all_locked_with_progress_zero(client: AsyncClient) -> None:
    token = await onboard(client)
    r = await client.get("/api/v1/achievements", headers=bearer(token))
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["total"] == len(CATALOG)
    assert data["unlocked"] == 0
    assert all(i["unlocked"] is False and i["unlocked_at"] is None for i in data["items"])
    items = {i["key"]: i for i in data["items"]}
    # Contadores começam zerados…
    for key in ("streak_3", "perfect_1", "days_30", "tasks_100", "league_win"):
        assert items[key]["progress"] == 0, key
    # …mas nível e divisão já valem o piso: você nasce nível 1, no Bronze.
    assert items["level_5"]["progress"] == 1
    assert items["league_gold"]["progress"] == 1


async def test_unlocks_from_history_and_keeps_the_date(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    token = await onboard(client)
    h = bearer(token)
    user_id = await _user_id(db_session, "ana@exemplo.com")
    await db_session.execute(
        text("UPDATE users SET created_at = :c WHERE id = :u").bindparams(
            c=datetime.combine(today() - timedelta(days=30), time(9, 0), tzinfo=UTC), u=user_id
        )
    )
    # Uma semana cumprida, com dois dias redondos
    for i in range(1, 8):
        await _seed_day(
            db_session,
            user_id,
            today() - timedelta(days=i),
            pct=100 if i < 3 else 90,
            hit=True,
            streak=8 - i,
        )
    await db_session.flush()

    items = {
        i["key"]: i for i in (await client.get("/api/v1/achievements", headers=h)).json()["items"]
    }
    assert items["streak_7"]["unlocked"] is True
    assert items["streak_7"]["unlocked_at"] is not None
    assert items["streak_7"]["seen"] is False
    assert items["perfect_1"]["unlocked"] is True
    assert items["perfect_10"]["unlocked"] is False
    assert items["perfect_10"]["progress"] == 2  # 2 de 10
    assert items["streak_30"]["progress"] == 7  # progresso nunca passa do alvo
    assert items["streak_3"]["progress"] == 3

    # A data não muda ao reler, e não duplica linha
    first = items["streak_7"]["unlocked_at"]
    again = {
        i["key"]: i for i in (await client.get("/api/v1/achievements", headers=h)).json()["items"]
    }
    assert again["streak_7"]["unlocked_at"] == first
    rows = list(
        await db_session.scalars(
            select(AchievementUnlock).where(
                AchievementUnlock.user_id == user_id, AchievementUnlock.key == "streak_7"
            )
        )
    )
    assert len(rows) == 1

    # Conquistados vêm primeiro na lista
    order = [
        i["unlocked"] for i in (await client.get("/api/v1/achievements", headers=h)).json()["items"]
    ]
    assert order == sorted(order, reverse=True)


async def test_seen_marks_everything_unlocked(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    token = await onboard(client)
    h = bearer(token)
    user_id = await _user_id(db_session, "ana@exemplo.com")
    await _seed_day(db_session, user_id, today() - timedelta(days=1), pct=100, hit=True, streak=1)
    await db_session.flush()

    data = (await client.get("/api/v1/achievements", headers=h)).json()
    assert any(i["unlocked"] and not i["seen"] for i in data["items"])
    assert (await client.post("/api/v1/achievements/seen", headers=h)).status_code == 204
    data = (await client.get("/api/v1/achievements", headers=h)).json()
    assert all(i["seen"] for i in data["items"] if i["unlocked"])


async def test_area_counters_come_from_the_days(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    token = await onboard(client)
    h = bearer(token)
    user_id = await _user_id(db_session, "ana@exemplo.com")
    await _seed_day(db_session, user_id, today() - timedelta(days=1), pct=100, hit=True, streak=1)
    row = await db_session.scalar(select(DailyScore).where(DailyScore.user_id == user_id))
    assert row is not None
    row.breakdown = {
        "wake": {"planned": 1, "completed": 1},
        "tasks": {"planned": 9, "completed": 9},
    }
    await db_session.flush()
    items = {
        i["key"]: i for i in (await client.get("/api/v1/achievements", headers=h)).json()["items"]
    }
    assert items["tasks_100"]["progress"] == 9
    assert items["wake_25"]["progress"] == 1
    assert items["workout_20"]["progress"] == 0


async def test_achievements_require_login(client: AsyncClient) -> None:
    assert (await client.get("/api/v1/achievements")).status_code == 401
    assert (await client.post("/api/v1/achievements/seen")).status_code == 401
