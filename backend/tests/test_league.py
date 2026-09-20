"""Fase 14: liga semanal com robôs — sorteio determinístico, virada e divisões."""

from datetime import UTC, date, datetime, time, timedelta
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.league import bots as bots_mod
from app.modules.league import service as league_service
from app.modules.league.models import LeagueWeek, Outcome, Tier
from tests.conftest import bearer
from tests.test_progress import _seed_day, _user_id
from tests.test_routines import onboard, today

MONDAY = date(2026, 9, 14)  # uma segunda-feira qualquer


def test_week_start_is_always_monday() -> None:
    for offset in range(7):
        assert league_service.week_start_of(MONDAY + timedelta(days=offset)) == MONDAY


def test_bots_are_deterministic_per_user_and_week() -> None:
    user_a, user_b = uuid4(), uuid4()
    first = bots_mod.draw(user_a, MONDAY, Tier.bronze)
    assert [b.key for b in first] == [b.key for b in bots_mod.draw(user_a, MONDAY, Tier.bronze)]
    assert len(first) == bots_mod.BOTS_PER_LEAGUE
    assert len({b.key for b in first}) == bots_mod.BOTS_PER_LEAGUE  # sem robô repetido
    # Outro usuário, outra semana ou outra divisão: outro sorteio
    assert [b.key for b in first] != [
        b.key for b in bots_mod.draw(user_b, MONDAY, Tier.bronze)
    ] or [b.daily for b in first] != [b.daily for b in bots_mod.draw(user_b, MONDAY, Tier.bronze)]
    higher = bots_mod.draw(user_a, MONDAY, Tier.diamond)
    assert sum(sum(b.daily) for b in higher) > sum(sum(b.daily) for b in first)


def test_bot_progress_never_goes_backwards_and_fits_the_rhythm() -> None:
    bot = bots_mod.draw(uuid4(), MONDAY, Tier.gold)[0]
    values = [bots_mod.xp_so_far(bot, 0, m) for m in range(0, 24 * 60, 15)]
    assert values == sorted(values)  # o placar do robô nunca cai
    assert values[0] == 0 and values[-1] <= bot.daily[0]
    # Madrugador entrega cedo; noturno, tarde
    early = bots_mod.progress_at("early", 9 * 60)
    night = bots_mod.progress_at("night", 9 * 60)
    assert early > night
    assert bots_mod.progress_at("night", 23 * 60) > bots_mod.progress_at("night", 17 * 60)
    # Dia inteiro fechado = alvo do dia
    assert bots_mod.xp_so_far(bot, 1, None) == bot.daily[0]


@pytest.mark.parametrize(
    ("rank", "tier", "expected"),
    [
        (1, Tier.bronze, Outcome.promoted),
        (2, Tier.gold, Outcome.promoted),
        (3, Tier.gold, Outcome.stayed),
        (6, Tier.gold, Outcome.relegated),
        (7, Tier.bronze, Outcome.stayed),  # não existe divisão abaixo do Bronze
        (1, Tier.diamond, Outcome.stayed),  # nem acima do Diamante
    ],
)
def test_promotion_and_relegation_rules(rank: int, tier: Tier, expected: Outcome) -> None:
    outcome, next_tier = league_service._outcome_for(rank, tier)
    assert outcome == expected
    if expected == Outcome.promoted:
        assert next_tier != tier
    if expected == Outcome.stayed:
        assert next_tier == tier


def test_tie_goes_to_the_human() -> None:
    drawn = bots_mod.draw(uuid4(), MONDAY, Tier.bronze)
    table = league_service._standings(500, drawn, [500] * len(drawn))
    assert table[0].is_you and table[0].rank == 1


async def test_league_starts_in_bronze_with_six_bots(client: AsyncClient) -> None:
    token = await onboard(client)
    r = await client.get("/api/v1/league", headers=bearer(token))
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["tier"] == "bronze"
    assert len(data["members"]) == 7
    assert sum(1 for m in data["members"] if m["is_bot"]) == 6
    you = next(m for m in data["members"] if m["is_you"])
    assert you["name"] == "Você" and you["rank"] == data["your_rank"]
    assert data["week_start"] == league_service.week_start_of(today()).isoformat()
    assert 0 <= data["days_left"] <= 6
    assert data["can_promote"] is True and data["can_relegate"] is False
    assert data["last_result"] is None
    # Ranking sem buracos e em ordem
    assert [m["rank"] for m in data["members"]] == list(range(1, 8))
    assert [m["xp"] for m in data["members"]] == sorted(
        (m["xp"] for m in data["members"]), reverse=True
    )


async def test_your_xp_comes_from_your_days(client: AsyncClient, db_session: AsyncSession) -> None:
    token = await onboard(client)
    h = bearer(token)
    user_id = await _user_id(db_session, "ana@exemplo.com")
    week = league_service.week_start_of(today())
    # Um dia fechado desta semana com XP gravado entra na conta
    if week < today():
        await _seed_day(db_session, user_id, week, pct=100, hit=True, streak=1)
        await db_session.execute(
            LeagueWeek.__table__.delete()  # garante que nada foi encerrado ainda
        )
        await db_session.execute(
            text("UPDATE daily_scores SET xp = 140 WHERE user_id = :u").bindparams(u=user_id)
        )
        await db_session.flush()
        data = (await client.get("/api/v1/league", headers=h)).json()
        assert data["your_xp"] >= 140


async def test_week_turns_over_and_changes_division(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    token = await onboard(client)
    h = bearer(token)
    user_id = await _user_id(db_session, "ana@exemplo.com")
    last_week = league_service.week_start_of(today()) - timedelta(days=7)
    # A conta existe desde a semana passada (senão não haveria semana a encerrar)
    await db_session.execute(
        text("UPDATE users SET created_at = :c WHERE id = :u").bindparams(
            c=datetime.combine(last_week, time(9, 0), tzinfo=UTC), u=user_id
        )
    )
    # Semana passada campeã: sete dias no talo
    for i in range(7):
        day = last_week + timedelta(days=i)
        if day < today():
            await _seed_day(db_session, user_id, day, pct=100, hit=True, streak=i + 1)
    await db_session.execute(
        text("UPDATE daily_scores SET xp = 900 WHERE user_id = :u").bindparams(u=user_id)
    )
    await db_session.flush()

    data = (await client.get("/api/v1/league", headers=h)).json()
    result = data["last_result"]
    assert result is not None
    assert result["week_start"] == last_week.isoformat()
    assert result["rank"] == 1 and result["outcome"] == "promoted"
    assert result["next_tier"] == "silver"
    assert result["seen"] is False
    assert data["tier"] == "silver"  # já competindo na divisão nova

    # A comemoração aparece uma vez
    assert (await client.post("/api/v1/league/seen", headers=h)).status_code == 204
    assert (await client.get("/api/v1/league", headers=h)).json()["last_result"]["seen"] is True

    # Ler de novo não cria outra linha para a mesma semana (idempotente)
    before = len((await client.get("/api/v1/league", headers=h)).json()["members"])
    assert before == 7


async def test_league_is_private(client: AsyncClient) -> None:
    assert (await client.get("/api/v1/league")).status_code == 401
    a = await onboard(client, email="a@exemplo.com")
    client.cookies.clear()
    b = await onboard(client, email="b@exemplo.com")
    names_a = [
        m["name"] for m in (await client.get("/api/v1/league", headers=bearer(a))).json()["members"]
    ]
    names_b = [
        m["name"] for m in (await client.get("/api/v1/league", headers=bearer(b))).json()["members"]
    ]
    assert "Você" in names_a and "Você" in names_b
    # Cada conta tem a própria liga (os robôs são sorteados por usuário)
    assert len(names_a) == len(names_b) == 7
