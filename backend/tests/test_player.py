"""Fase 13: XP por dia, nível e patente."""

from datetime import timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.player import xp as xp_rules
from app.modules.progress.models import DailyScore
from tests.conftest import bearer
from tests.test_progress import _seed_day, _user_id
from tests.test_routines import onboard, today, wake_up


def test_level_curve_is_progressive() -> None:
    assert xp_rules.level_for(0).level == 1
    assert xp_rules.level_for(199).level == 1
    assert xp_rules.level_for(200).level == 2  # primeiro nível custa 200
    assert xp_rules.level_for(449).level == 2
    assert xp_rules.level_for(450).level == 3  # o seguinte custa 250
    # Cada nível custa mais que o anterior e a patente acompanha as faixas
    assert xp_rules.span_for_level(10) > xp_rules.span_for_level(1)
    assert xp_rules.level_for(xp_rules.total_for_level(10)).title == "Focado"
    assert xp_rules.level_for(xp_rules.total_for_level(20)).title == "Implacável"
    # Nível máximo: barra cheia e nada a alcançar
    top = xp_rules.level_for(10_000_000)
    assert top.level == xp_rules.MAX_LEVEL and top.to_next == 0


def test_day_xp_counts_items_and_bonuses() -> None:
    breakdown = {
        "wake": {"planned": 1, "completed": 1},
        "routines": {"planned": 4, "completed": 2},
        "tasks": {"planned": 2, "completed": 0},
        "missing": [],  # chave estranha no breakdown não quebra a conta
    }
    # 20 (acordar) + 2×8 (rotina) = 36, sem bônus
    assert xp_rules.xp_for_day(breakdown, pct=50, hit_target=False, streak_day=0) == 36
    # Mesmo dia batendo a meta: +50; 100%: +30; sequência de 3: +15
    assert (
        xp_rules.xp_for_day(breakdown, pct=100, hit_target=True, streak_day=3) == 36 + 50 + 30 + 15
    )
    # A sequência tem teto
    big = xp_rules.xp_for_day(breakdown, pct=50, hit_target=False, streak_day=99)
    assert big == 36 + xp_rules.STREAK_CAP * xp_rules.STREAK_STEP


async def test_player_starts_at_level_one_and_gains_xp_on_check(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)

    r = await client.get("/api/v1/player", headers=h)
    assert r.status_code == 200, r.text
    start = r.json()
    assert start["level"] == 1 and start["title"] == "Recruta"
    assert start["total_xp"] == 0 and start["xp_today"] == 0
    assert start["into_level"] == 0 and start["to_next"] == start["level_span"]

    # Confirmar que acordou vale XP na hora
    await wake_up(client, token)
    after_wake = (await client.get("/api/v1/player", headers=h)).json()
    assert after_wake["xp_today"] >= xp_rules.WEIGHTS["wake"]
    assert after_wake["total_xp"] == after_wake["xp_today"]

    # Marcar um item da rotina soma; desmarcar devolve (não dá para inflar XP repetindo)
    routine_id = (await client.get("/api/v1/routines", headers=h)).json()[0]["id"]
    for title in ("Água", "Alongar", "Ler"):
        r = await client.post(
            f"/api/v1/routines/{routine_id}/items", json={"title": title}, headers=h
        )
        assert r.status_code == 201, r.text
    after_wake = (await client.get("/api/v1/player", headers=h)).json()  # planejar muda os bônus
    day = (await client.get("/api/v1/routines/day", headers=h)).json()
    item_id = day["routines"][0]["items"][0]["id"]
    body = {"date": today().isoformat(), "done": True}
    r = await client.put(f"/api/v1/routines/items/{item_id}/check", json=body, headers=h)
    assert r.status_code == 204
    checked = (await client.get("/api/v1/player", headers=h)).json()
    assert checked["xp_today"] >= after_wake["xp_today"] + xp_rules.WEIGHTS["routines"]

    # Marcar de novo não soma nada (idempotente)
    await client.put(f"/api/v1/routines/items/{item_id}/check", json=body, headers=h)
    assert (await client.get("/api/v1/player", headers=h)).json()["xp_today"] == checked["xp_today"]

    body["done"] = False
    await client.put(f"/api/v1/routines/items/{item_id}/check", json=body, headers=h)
    unchecked = (await client.get("/api/v1/player", headers=h)).json()
    assert unchecked["xp_today"] == after_wake["xp_today"]


async def test_day_score_exposes_xp_and_closed_days_store_it(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    token = await onboard(client)
    h = bearer(token)
    await wake_up(client, token)
    score = (await client.get("/api/v1/progress/day", headers=h)).json()
    # O XP publicado é exatamente o que a fórmula diz sobre a foto do dia
    expected = xp_rules.xp_for_day(
        {k: v for k, v in score["breakdown"].items()},
        score["pct"],
        score["hit_target"],
        score["streak"],
    )
    assert score["xp"] == expected > 0

    r = await client.post("/api/v1/progress/close", json={"date": today().isoformat()}, headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["xp"] == score["xp"]
    row = await db_session.scalar(
        select(DailyScore).where(
            DailyScore.user_id == await _user_id(db_session, "ana@exemplo.com")
        )
    )
    assert row is not None and row.xp == score["xp"]

    # O total do jogador usa o XP guardado do dia fechado
    assert (await client.get("/api/v1/player", headers=h)).json()["total_xp"] == score["xp"]


async def test_level_reflects_history(client: AsyncClient, db_session: AsyncSession) -> None:
    token = await onboard(client)
    h = bearer(token)
    user_id = await _user_id(db_session, "ana@exemplo.com")
    # Dias antigos já fechados com XP gravado
    for i in range(1, 4):
        await _seed_day(
            db_session, user_id, today() - timedelta(days=i), pct=100, hit=True, streak=i
        )
    await db_session.execute(
        DailyScore.__table__.update().where(DailyScore.user_id == user_id).values(xp=300)
    )
    await db_session.flush()

    player = (await client.get("/api/v1/player", headers=h)).json()
    assert player["total_xp"] >= 900
    assert player["level"] == xp_rules.level_for(player["total_xp"]).level
    assert player["level"] >= 3
    assert player["into_level"] + player["to_next"] == player["level_span"]


async def test_player_requires_login(client: AsyncClient) -> None:
    assert (await client.get("/api/v1/player")).status_code == 401


@pytest.mark.parametrize("kind", sorted(xp_rules.WEIGHTS))
def test_every_area_is_worth_xp(kind: str) -> None:
    assert xp_rules.WEIGHTS[kind] > 0
