from datetime import timedelta

from httpx import AsyncClient

from tests.conftest import bearer
from tests.test_routines import onboard, today


async def test_wake_day_before_confirmation(client: AsyncClient) -> None:
    token = await onboard(client)
    r = await client.get("/api/v1/wake/day", headers=bearer(token))
    assert r.status_code == 200
    body = r.json()
    assert body["date"] == today().isoformat()
    assert body["scheduled_time"] == "06:00:00"
    assert body["scheduled_at"] is not None
    assert body["status"] is None
    assert body["confirmed_at"] is None
    assert body["can_undo"] is False


async def test_manual_confirm_is_idempotent_and_computes_delay(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    body = {"date": today().isoformat()}

    first = await client.post("/api/v1/wake/confirm", json=body, headers=h)
    assert first.status_code == 200, first.text
    out = first.json()
    assert out["status"] == "manual"
    assert out["confirmed_at"] is not None
    assert isinstance(out["delay_minutes"], int)
    assert out["can_undo"] is True

    second = await client.post("/api/v1/wake/confirm", json=body, headers=h)
    assert second.json()["confirmed_at"] == out["confirmed_at"]

    # Desfazer (só hoje) volta ao estado inicial
    r = await client.delete(f"/api/v1/wake/day?date={today().isoformat()}", headers=h)
    assert r.status_code == 204
    assert (await client.get("/api/v1/wake/day", headers=h)).json()["status"] is None


async def test_wake_confirm_rejects_future(client: AsyncClient) -> None:
    token = await onboard(client)
    tomorrow = (today() + timedelta(days=1)).isoformat()
    r = await client.post("/api/v1/wake/confirm", json={"date": tomorrow}, headers=bearer(token))
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "date_not_allowed"


async def test_wake_is_isolated_between_users(client: AsyncClient) -> None:
    a = await onboard(client, email="a@exemplo.com")
    client.cookies.clear()
    b = await onboard(client, email="b@exemplo.com")
    await client.post("/api/v1/wake/confirm", json={"date": today().isoformat()}, headers=bearer(a))
    assert (await client.get("/api/v1/wake/day", headers=bearer(b))).json()["status"] is None
