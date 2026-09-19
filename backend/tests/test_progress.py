"""Score, sequência, fechamento do dia e job de finalização."""

from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dates import last_finalizable_day, user_today
from app.core.scheduler import finalize_due_days
from app.modules.progress.models import ClosedBy, DailyScore
from app.modules.users.models import User
from tests.conftest import bearer
from tests.test_routines import TZ, onboard, today


async def _seed_day(
    db: AsyncSession, user_id, day, *, pct: int, hit: bool, streak: int, finalized: bool = True
) -> None:
    now = datetime.now(UTC)
    db.add(
        DailyScore(
            user_id=user_id,
            date=day,
            planned_count=4,
            completed_count=round(4 * pct / 100),
            discipline_pct=pct,
            target_pct=80,
            hit_target=hit,
            streak_day=streak,
            breakdown={},
            closed_at=now,
            closed_by=ClosedBy.system,
            finalized_at=now if finalized else None,
        )
    )
    await db.flush()


async def _user_id(db: AsyncSession, email: str):
    return await db.scalar(select(User.id).where(User.email == email))


async def _backdate_user(db: AsyncSession, user_id, days: int) -> None:
    """Faz a conta 'existir' há N dias, para haver histórico a finalizar."""
    user = await db.get(User, user_id)
    assert user is not None
    user.created_at = datetime.now(UTC) - timedelta(days=days)
    await db.flush()


async def test_empty_day_is_zero_and_not_closable(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    # Só o "acordar" está planejado (wake_time definido no setup) → 0 de 1
    r = await client.get("/api/v1/progress/day", headers=h)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["planned"] == 1 and d["completed"] == 0 and d["pct"] == 0
    assert d["hit_target"] is False and d["streak"] == 0
    assert d["is_open"] is True and d["can_close"] is True and d["can_reopen"] is False

    # Sem horário de acordar e sem nada planejado: 0%, não fecha
    await client.patch("/api/v1/users/me/settings", json={"wake_time": None}, headers=h)
    d = (await client.get("/api/v1/progress/day", headers=h)).json()
    assert d["planned"] == 0 and d["can_close"] is False
    r = await client.post("/api/v1/progress/close", json={"date": today().isoformat()}, headers=h)
    assert r.status_code == 400 and r.json()["error"]["code"] == "day_not_closable"


async def test_score_composes_wake_routines_and_tasks(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    routines = (await client.get("/api/v1/routines", headers=h)).json()
    morning = routines[0]["id"]
    a = (
        await client.post(f"/api/v1/routines/{morning}/items", json={"title": "Água"}, headers=h)
    ).json()
    await client.post(f"/api/v1/routines/{morning}/items", json={"title": "Alongar"}, headers=h)
    t1 = (await client.post("/api/v1/tasks", json={"title": "T1"}, headers=h)).json()
    await client.post("/api/v1/tasks", json={"title": "T2"}, headers=h)
    cancelled = (await client.post("/api/v1/tasks", json={"title": "T3"}, headers=h)).json()
    await client.patch(f"/api/v1/tasks/{cancelled['id']}", json={"status": "cancelled"}, headers=h)

    d = (await client.get("/api/v1/progress/day", headers=h)).json()
    assert d["planned"] == 5  # 1 acordar + 2 itens + 2 tarefas (cancelada não conta)
    assert d["completed"] == 0
    assert d["breakdown"]["routines"] == {"planned": 2, "completed": 0}
    assert d["breakdown"]["tasks"] == {"planned": 2, "completed": 0}
    assert d["breakdown"]["wake"] == {"planned": 1, "completed": 0}
    assert len(d["missing"]) == 5
    assert d["missing"][0] == {"kind": "wake", "title": "Confirmar que levantou"}

    tday = today().isoformat()
    await client.post("/api/v1/wake/confirm", json={"date": tday}, headers=h)
    await client.put(
        f"/api/v1/routines/items/{a['id']}/check", json={"date": tday, "done": True}, headers=h
    )
    await client.patch(f"/api/v1/tasks/{t1['id']}", json={"status": "done"}, headers=h)

    d = (await client.get("/api/v1/progress/day", headers=h)).json()
    assert d["completed"] == 3 and d["pct"] == 60 and d["hit_target"] is False
    assert [m["title"] for m in d["missing"]] == ["Manhã: Alongar", "T2"]


async def test_streak_continues_from_previous_days(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    token = await onboard(client)
    h = bearer(token)
    uid = await _user_id(db_session, "ana@exemplo.com")
    await _backdate_user(db_session, uid, 5)
    t = today()
    # 3 dias cumpridos seguidos até ontem; anteontem-2 não bateu
    await _seed_day(db_session, uid, t - timedelta(days=4), pct=50, hit=False, streak=0)
    await _seed_day(db_session, uid, t - timedelta(days=3), pct=90, hit=True, streak=1)
    await _seed_day(db_session, uid, t - timedelta(days=2), pct=100, hit=True, streak=2)
    await _seed_day(db_session, uid, t - timedelta(days=1), pct=85, hit=True, streak=3)

    # Hoje ainda não bateu → sequência mostrada é 0 (o dia conta só quando cumprido)
    d = (await client.get("/api/v1/progress/day", headers=h)).json()
    assert d["streak"] == 0 and d["best_streak"] == 3

    # Cumprir hoje (só o acordar está planejado → 100%)
    await client.post("/api/v1/wake/confirm", json={"date": t.isoformat()}, headers=h)
    d = (await client.get("/api/v1/progress/day", headers=h)).json()
    assert d["pct"] == 100 and d["hit_target"] is True
    assert d["streak"] == 4 and d["best_streak"] == 4


async def test_close_and_reopen_day(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    tday = today().isoformat()
    await client.post("/api/v1/wake/confirm", json={"date": tday}, headers=h)

    r = await client.post("/api/v1/progress/close", json={"date": tday}, headers=h)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["closed_by"] == "user" and d["finalized"] is False
    assert d["is_open"] is False and d["can_close"] is False and d["can_reopen"] is True
    assert d["pct"] == 100 and d["streak"] == 1

    # Fechar de novo → conflito
    assert (
        await client.post("/api/v1/progress/close", json={"date": tday}, headers=h)
    ).status_code == 409

    # Leitura devolve a fotografia congelada mesmo se os dados mudarem
    await client.delete(f"/api/v1/wake/day?date={tday}", headers=h)
    d = (await client.get("/api/v1/progress/day", headers=h)).json()
    assert d["pct"] == 100 and d["closed_by"] == "user"

    # Reabrir volta ao cálculo ao vivo
    r = await client.post("/api/v1/progress/reopen", json={"date": tday}, headers=h)
    assert r.status_code == 200
    d = r.json()
    assert d["is_open"] is True and d["pct"] == 0 and d["closed_by"] is None


async def test_backfill_creates_missing_days_and_breaks_streak(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    token = await onboard(client)
    h = bearer(token)
    uid = await _user_id(db_session, "ana@exemplo.com")
    await _backdate_user(db_session, uid, 3)

    # Nenhuma linha ainda; a leitura de hoje finaliza os dias vencidos (0%, sem plano)
    d = (await client.get("/api/v1/progress/day", headers=h)).json()
    assert d["streak"] == 0
    rows = (
        await db_session.scalars(
            select(DailyScore).where(DailyScore.user_id == uid).order_by(DailyScore.date)
        )
    ).all()
    expected_last = last_finalizable_day(TZ)
    assert rows and rows[-1].date == expected_last
    assert all(r.closed_by == ClosedBy.system and r.finalized_at is not None for r in rows)
    # Dias sem plano: 0% e sequência 0 (decisão do fundador)
    assert all(r.discipline_pct == 0 and r.streak_day == 0 for r in rows)

    # Segunda leitura não duplica
    await client.get("/api/v1/progress/day", headers=h)
    again = (await db_session.scalars(select(DailyScore).where(DailyScore.user_id == uid))).all()
    assert len(again) == len(rows)


async def test_finalize_job_is_idempotent(client: AsyncClient, db_session: AsyncSession) -> None:
    token = await onboard(client)
    h = bearer(token)
    uid = await _user_id(db_session, "ana@exemplo.com")
    await _backdate_user(db_session, uid, 2)
    user = await db_session.get(User, uid)
    assert user is not None

    from app.modules.progress import service

    first = await service.finalize_due_days_for_user(db_session, user)
    second = await service.finalize_due_days_for_user(db_session, user)
    expected = (last_finalizable_day(TZ) - user_today(TZ, user.created_at)).days + 1
    assert first == max(expected, 0)
    assert second == 0

    # Hoje continua aberto
    d = (await client.get("/api/v1/progress/day", headers=h)).json()
    assert d["is_open"] is True


async def test_scheduler_job_runs_without_error(client: AsyncClient) -> None:
    await onboard(client)
    # Usa a sessão real do app (fora da transação de teste); só garante que roda e devolve int.
    total = await finalize_due_days()
    assert isinstance(total, int)


async def test_progress_is_isolated_between_users(client: AsyncClient) -> None:
    a = await onboard(client, email="a@exemplo.com")
    client.cookies.clear()
    b = await onboard(client, email="b@exemplo.com")
    tday = today().isoformat()
    await client.post("/api/v1/wake/confirm", json={"date": tday}, headers=bearer(a))
    await client.post("/api/v1/progress/close", json={"date": tday}, headers=bearer(a))

    db = (await client.get("/api/v1/progress/day", headers=bearer(b))).json()
    assert db["pct"] == 0 and db["is_open"] is True and db["closed_by"] is None
    # B não reabre o dia de A
    r = await client.post("/api/v1/progress/reopen", json={"date": tday}, headers=bearer(b))
    assert r.status_code == 409
