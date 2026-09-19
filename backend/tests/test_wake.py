from datetime import date, timedelta
from zoneinfo import ZoneInfo

from httpx import AsyncClient

from app.core.dates import now_utc
from tests.conftest import bearer
from tests.test_routines import TZ, onboard, today


def manual_day() -> date:
    """Dia em que o "Levantei" manual está liberado agora.

    A janela do dia D abre às 03:00 de D (Fase 6) e o dia anterior fica aberto até essa mesma
    hora; logo, em qualquer instante exatamente um dos dois aceita o registro manual.
    """
    return today() if now_utc().astimezone(ZoneInfo(TZ)).hour >= 3 else today() - timedelta(1)


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
    assert body["ringing"] is False
    assert body["can_undo"] is False


async def test_manual_confirm_is_idempotent_and_computes_delay(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    day = manual_day()
    body = {"date": day.isoformat()}

    first = await client.post("/api/v1/wake/confirm", json=body, headers=h)
    assert first.status_code == 200, first.text
    out = first.json()
    assert out["status"] == "manual"
    assert out["confirmed_at"] is not None
    assert isinstance(out["delay_minutes"], int)
    assert out["can_undo"] is (day == today())

    second = await client.post("/api/v1/wake/confirm", json=body, headers=h)
    assert second.json()["confirmed_at"] == out["confirmed_at"]

    # Desfazer só vale para hoje; em outro dia é ignorado.
    r = await client.delete(f"/api/v1/wake/day?date={day.isoformat()}", headers=h)
    assert r.status_code == 204
    after = (await client.get(f"/api/v1/wake/day?date={day.isoformat()}", headers=h)).json()
    assert after["status"] == (None if day == today() else "manual")


async def test_manual_confirm_closed_before_three_am(client: AsyncClient) -> None:
    """Antes das 03:00, o "Levantei" de hoje ainda não abriu; depois, o de ontem já fechou."""
    token = await onboard(client)
    other = today() if manual_day() != today() else today() - timedelta(1)
    r = await client.post(
        "/api/v1/wake/confirm", json={"date": other.isoformat()}, headers=bearer(token)
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "date_not_allowed"


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
    day = manual_day().isoformat()
    await client.post("/api/v1/wake/confirm", json={"date": day}, headers=bearer(a))
    assert (await client.get(f"/api/v1/wake/day?date={day}", headers=bearer(b))).json()[
        "status"
    ] is None
