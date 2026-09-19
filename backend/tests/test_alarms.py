"""Fase 6: alarmes, disparo (job e app aberto), soneca, perdido, push e histórico."""

from datetime import datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import push
from app.core.dates import local_to_utc, now_utc
from app.modules.alarms import service as alarms_service
from app.modules.users.models import User
from tests.conftest import bearer
from tests.test_routines import TZ, onboard, today

SUB = {
    "endpoint": "https://push.example.com/send/abc123",
    "keys": {"p256dh": "BPubKey", "auth": "authKey"},
}


def local_now() -> datetime:
    return now_utc().astimezone(ZoneInfo(TZ))


@pytest.fixture
def sent(monkeypatch: pytest.MonkeyPatch) -> list[dict[str, Any]]:
    """Captura os pushes que sairiam, sem rede."""
    box: list[dict[str, Any]] = []

    async def fake_send(info: dict[str, Any], payload: dict[str, Any]) -> bool:
        box.append({"endpoint": info["endpoint"], **payload})
        return True

    monkeypatch.setattr(push, "send", fake_send)
    return box


async def user_of(db: AsyncSession, email: str = "ana@exemplo.com") -> User:
    user = await db.scalar(select(User).where(User.email == email))
    assert user is not None
    return user


# --- Cadastro ----------------------------------------------------------------------------


async def test_onboarding_creates_default_alarm(client: AsyncClient) -> None:
    token = await onboard(client)
    r = await client.get("/api/v1/alarms", headers=bearer(token))
    assert r.status_code == 200
    body = r.json()
    assert len(body["alarms"]) == 1
    alarm = body["alarms"][0]
    assert alarm["label"] == "Acordar"
    assert alarm["time"] == "06:00:00"
    assert alarm["days_of_week"] == [0, 1, 2, 3, 4, 5, 6]
    assert alarm["is_active"] is True
    assert alarm["max_snoozes"] == 1 and alarm["snooze_minutes"] == 5
    assert alarm["next_ring_at"] is not None
    assert body["next"]["alarm_id"] == alarm["id"]
    assert body["push_enabled"] is False  # sem chaves VAPID nos testes

    # Repetir o setup não duplica.
    await client.post(
        "/api/v1/users/me/onboarding",
        json={"name": "Ana", "timezone": TZ, "wake_time": "06:30", "discipline_target": 80},
        headers=bearer(token),
    )
    assert len((await client.get("/api/v1/alarms", headers=bearer(token))).json()["alarms"]) == 1


async def test_alarm_crud_and_validation(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)

    r = await client.post("/api/v1/alarms", json={"time": "06:30", "days_of_week": []}, headers=h)
    assert r.status_code == 422
    r = await client.post("/api/v1/alarms", json={"time": "06:30", "sound": "harp"}, headers=h)
    assert r.status_code == 422

    r = await client.post(
        "/api/v1/alarms",
        json={
            "label": "Reserva",
            "time": "06:30:45",
            "days_of_week": [4, 0, 0],
            "sound": "soft",
            "max_snoozes": 2,
            "snooze_minutes": 10,
        },
        headers=h,
    )
    assert r.status_code == 201, r.text
    alarm = r.json()
    assert alarm["time"] == "06:30:00"  # segundos descartados
    assert alarm["days_of_week"] == [0, 4]
    assert alarm["sound"] == "soft"

    listed = (await client.get("/api/v1/alarms", headers=h)).json()["alarms"]
    assert [a["label"] for a in listed] == ["Acordar", "Reserva"]  # ordenado por horário

    r = await client.patch(f"/api/v1/alarms/{alarm['id']}", json={"is_active": False}, headers=h)
    assert r.status_code == 200
    assert r.json()["is_active"] is False
    assert r.json()["next_ring_at"] is None

    r = await client.delete(f"/api/v1/alarms/{alarm['id']}", headers=h)
    assert r.status_code == 204
    assert (await client.get(f"/api/v1/alarms/{alarm['id']}", headers=h)).status_code == 404
    assert len((await client.get("/api/v1/alarms", headers=h)).json()["alarms"]) == 1


async def test_alarms_are_isolated_between_users(client: AsyncClient) -> None:
    a = await onboard(client, email="a@exemplo.com")
    client.cookies.clear()
    b = await onboard(client, email="b@exemplo.com")
    alarm_a = (await client.get("/api/v1/alarms", headers=bearer(a))).json()["alarms"][0]
    assert (
        await client.get(f"/api/v1/alarms/{alarm_a['id']}", headers=bearer(b))
    ).status_code == 404
    r = await client.patch(
        f"/api/v1/alarms/{alarm_a['id']}", json={"label": "Invasor"}, headers=bearer(b)
    )
    assert r.status_code == 404


# --- Planejamento do "acordar" -----------------------------------------------------------


async def test_wake_planned_follows_alarm_days(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    default = (await client.get("/api/v1/alarms", headers=h)).json()["alarms"][0]

    # Só alarme em dias que não são hoje → hoje não tem "acordar" planejado.
    other_day = (today().weekday() + 3) % 7
    await client.patch(
        f"/api/v1/alarms/{default['id']}", json={"days_of_week": [other_day]}, headers=h
    )
    day = (await client.get("/api/v1/wake/day", headers=h)).json()
    assert day["scheduled_time"] is None
    assert day["alarm"] is None
    score = (await client.get("/api/v1/progress/day", headers=h)).json()
    assert score["breakdown"]["wake"]["planned"] == 0

    # Sem alarme nenhum → vale o wake_time das configurações (06:00).
    await client.delete(f"/api/v1/alarms/{default['id']}", headers=h)
    day = (await client.get("/api/v1/wake/day", headers=h)).json()
    assert day["scheduled_time"] == "06:00:00"
    assert (await client.get("/api/v1/progress/day", headers=h)).json()["breakdown"]["wake"][
        "planned"
    ] == 1


# --- Disparo pelo job --------------------------------------------------------------------


async def test_dispatch_rings_snoozes_and_marks_missed(
    client: AsyncClient, db_session: AsyncSession, sent: list[dict[str, Any]]
) -> None:
    token = await onboard(client)
    h = bearer(token)
    r = await client.post("/api/v1/users/me/push/subscriptions", json=SUB, headers=h)
    assert r.status_code == 201, r.text
    user = await user_of(db_session)

    # O alarme toca "agora": a soneca usa o relógio real (now_utc), então o alarme precisa estar
    # perto do horário real para o teste valer em qualquer hora do dia.
    alarm = (await client.get("/api/v1/alarms", headers=h)).json()["alarms"][0]
    now_local = now_utc().astimezone(ZoneInfo(TZ))
    alarm_hm = now_local.strftime("%H:%M")
    r = await client.patch(f"/api/v1/alarms/{alarm['id']}", json={"time": alarm_hm}, headers=h)
    assert r.status_code == 200, r.text
    ring_at = local_to_utc(today(), time(now_local.hour, now_local.minute), TZ) + timedelta(
        seconds=30
    )

    # 1) Toca no minuto do alarme: cria o registro pendente e envia o push.
    assert await alarms_service.dispatch_for_user(db_session, user, ring_at) == 1
    day = (await client.get("/api/v1/wake/day", headers=h)).json()
    assert day["status"] == "pending"
    assert day["ringing"] is True
    assert day["rang_at"] is not None
    assert day["alarm"]["label"] == "Acordar"
    assert day["can_snooze"] is True
    assert day["can_confirm"] is True
    assert len(sent) == 1
    assert sent[0]["type"] == "alarm" and sent[0]["time"] == alarm_hm
    assert sent[0]["endpoint"] == SUB["endpoint"]

    # 2) Rodar de novo no minuto seguinte não toca duas vezes.
    assert (
        await alarms_service.dispatch_for_user(db_session, user, ring_at + timedelta(seconds=60))
        == 0
    )
    assert len(sent) == 1

    # 3) Soneca: adia, e a segunda soneca é recusada (max_snoozes = 1).
    r = await client.post("/api/v1/wake/snooze", headers=h)
    assert r.status_code == 200, r.text
    snoozed = r.json()
    assert snoozed["snooze_count"] == 1
    assert snoozed["ringing"] is False
    assert snoozed["can_snooze"] is False
    next_ring = datetime.fromisoformat(snoozed["next_ring_at"])
    assert timedelta(minutes=4) < next_ring - now_utc() <= timedelta(minutes=5)
    r = await client.post("/api/v1/wake/snooze", headers=h)
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "wake_not_ringing"

    # 4) Soneca vencida → toca de novo (segundo push), sem novo registro.
    assert (
        await alarms_service.dispatch_for_user(db_session, user, next_ring + timedelta(seconds=5))
        == 1
    )
    assert len(sent) == 2
    day = (await client.get("/api/v1/wake/day", headers=h)).json()
    assert day["status"] == "pending" and day["ringing"] is True and day["next_ring_at"] is None

    # 5) Sem confirmar em 60 min do primeiro toque → perdido.
    assert (
        await alarms_service.dispatch_for_user(db_session, user, ring_at + timedelta(minutes=61))
        == 0
    )
    day = (await client.get("/api/v1/wake/day", headers=h)).json()
    assert day["status"] == "missed"
    assert day["ringing"] is False
    assert day["can_confirm"] is True

    # 6) Perdido pode ser confirmado depois: vira manual, com o atraso calculado.
    r = await client.post("/api/v1/wake/confirm", json={"date": today().isoformat()}, headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "manual"
    assert r.json()["confirmed_at"] is not None
    assert isinstance(r.json()["delay_minutes"], int)

    # 7) Histórico do período traz o dia com o rótulo do alarme.
    hist = (await client.get("/api/v1/wake/history", headers=h)).json()
    assert hist["days"][0]["date"] == today().isoformat()
    assert hist["days"][0]["label"] == "Acordar"
    assert hist["days"][0]["snooze_count"] == 1
    assert hist["confirmed"] == 1 and hist["missed"] == 0


async def test_dispatch_skips_push_when_notifications_disabled(
    client: AsyncClient, db_session: AsyncSession, sent: list[dict[str, Any]]
) -> None:
    token = await onboard(client)
    h = bearer(token)
    await client.post("/api/v1/users/me/push/subscriptions", json=SUB, headers=h)
    await client.patch(
        "/api/v1/users/me/settings", json={"notifications_enabled": False}, headers=h
    )
    user = await user_of(db_session)
    await db_session.refresh(user)

    ring_at = local_to_utc(today(), time(6, 0), TZ) + timedelta(seconds=10)
    assert await alarms_service.dispatch_for_user(db_session, user, ring_at) == 1
    assert sent == []  # registro criado, mas sem notificação
    assert (await client.get("/api/v1/wake/day", headers=h)).json()["status"] == "pending"


async def test_dispatch_drops_dead_subscriptions(
    client: AsyncClient, db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    token = await onboard(client)
    h = bearer(token)
    await client.post("/api/v1/users/me/push/subscriptions", json=SUB, headers=h)

    async def gone(info: dict[str, Any], payload: dict[str, Any]) -> bool:
        raise push.PushGoneError

    monkeypatch.setattr(push, "send", gone)
    user = await user_of(db_session)
    ring_at = local_to_utc(today(), time(6, 0), TZ) + timedelta(seconds=10)
    await alarms_service.dispatch_for_user(db_session, user, ring_at)
    assert (await client.get("/api/v1/users/me/push", headers=h)).json()["subscriptions"] == 0


async def test_dispatch_ignores_inactive_and_other_days(
    client: AsyncClient, db_session: AsyncSession, sent: list[dict[str, Any]]
) -> None:
    token = await onboard(client)
    h = bearer(token)
    default = (await client.get("/api/v1/alarms", headers=h)).json()["alarms"][0]
    await client.patch(f"/api/v1/alarms/{default['id']}", json={"is_active": False}, headers=h)
    user = await user_of(db_session)
    ring_at = local_to_utc(today(), time(6, 0), TZ) + timedelta(seconds=10)
    assert await alarms_service.dispatch_for_user(db_session, user, ring_at) == 0
    assert (await client.get("/api/v1/wake/day", headers=h)).json()["status"] is None

    other_day = (today().weekday() + 1) % 7
    await client.patch(
        f"/api/v1/alarms/{default['id']}",
        json={"is_active": True, "days_of_week": [other_day]},
        headers=h,
    )
    assert await alarms_service.dispatch_for_user(db_session, user, ring_at) == 0
    assert sent == []


# --- Disparo pelo app aberto -------------------------------------------------------------


async def test_ring_from_client_then_confirm(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    now = local_now()
    r = await client.post(
        "/api/v1/alarms",
        json={"label": "Agora", "time": now.strftime("%H:%M"), "requires_confirmation": True},
        headers=h,
    )
    assert r.status_code == 201
    alarm_id = r.json()["id"]

    r = await client.post("/api/v1/wake/ring", json={"alarm_id": alarm_id}, headers=h)
    assert r.status_code == 200, r.text
    day = r.json()
    assert day["status"] == "pending" and day["ringing"] is True
    assert day["alarm"]["id"] == alarm_id

    # Idempotente: tocar de novo não muda o registro.
    again = (await client.post("/api/v1/wake/ring", json={"alarm_id": alarm_id}, headers=h)).json()
    assert again["rang_at"] == day["rang_at"]

    r = await client.post("/api/v1/wake/confirm", json={"date": today().isoformat()}, headers=h)
    assert r.status_code == 200
    assert r.json()["status"] == "confirmed"
    assert r.json()["delay_minutes"] in (0, 1)
    assert r.json()["can_undo"] is False  # só o manual pode ser desfeito

    # Depois de confirmado, tocar não reabre.
    after = (await client.post("/api/v1/wake/ring", json={"alarm_id": alarm_id}, headers=h)).json()
    assert after["status"] == "confirmed"


async def test_ring_outside_window_is_rejected(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    later = (local_now() + timedelta(hours=2)).strftime("%H:%M")
    alarm_id = (
        await client.post("/api/v1/alarms", json={"label": "Depois", "time": later}, headers=h)
    ).json()["id"]
    r = await client.post("/api/v1/wake/ring", json={"alarm_id": alarm_id}, headers=h)
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "wake_not_ringing"
    assert (await client.get("/api/v1/wake/day", headers=h)).json()["status"] is None


# --- Push --------------------------------------------------------------------------------


async def test_push_subscription_upsert_and_delete(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    status = (await client.get("/api/v1/users/me/push", headers=h)).json()
    assert status == {"enabled": False, "public_key": None, "subscriptions": 0}

    r = await client.post(
        "/api/v1/users/me/push/subscriptions",
        json={"endpoint": "http://inseguro", "keys": SUB["keys"]},
        headers=h,
    )
    assert r.status_code == 422

    first = await client.post("/api/v1/users/me/push/subscriptions", json=SUB, headers=h)
    assert first.status_code == 201
    second = await client.post("/api/v1/users/me/push/subscriptions", json=SUB, headers=h)
    assert second.json()["id"] == first.json()["id"]  # mesmo endpoint → mesma assinatura
    assert (await client.get("/api/v1/users/me/push", headers=h)).json()["subscriptions"] == 1

    r = await client.delete(
        "/api/v1/users/me/push/subscriptions", params={"endpoint": SUB["endpoint"]}, headers=h
    )
    assert r.status_code == 204
    assert (await client.get("/api/v1/users/me/push", headers=h)).json()["subscriptions"] == 0


async def test_history_validates_range(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    r = await client.get(
        "/api/v1/wake/history",
        params={"start": today().isoformat(), "end": (today() - timedelta(days=1)).isoformat()},
        headers=h,
    )
    assert r.status_code == 400
    r = await client.get(
        "/api/v1/wake/history",
        params={"start": (today() - timedelta(days=400)).isoformat(), "end": today().isoformat()},
        headers=h,
    )
    assert r.status_code == 400
    ok = (await client.get("/api/v1/wake/history", headers=h)).json()
    assert ok["days"] == [] and ok["average_delay_minutes"] is None
