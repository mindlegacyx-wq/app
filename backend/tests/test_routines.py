from datetime import date, timedelta
from zoneinfo import ZoneInfo

from httpx import AsyncClient

from app.core.dates import is_day_open, now_utc
from tests.conftest import bearer, register

TZ = "America/Sao_Paulo"


def today() -> date:
    return now_utc().astimezone(ZoneInfo(TZ)).date()


async def onboard(client: AsyncClient, **overrides: str) -> str:
    token = (await register(client, **overrides))["access_token"]
    r = await client.post(
        "/api/v1/users/me/onboarding",
        json={"name": "Ana", "timezone": TZ, "wake_time": "06:00", "discipline_target": 80},
        headers=bearer(token),
    )
    assert r.status_code == 200, r.text
    return token


async def test_onboarding_creates_morning_and_evening_routines(client: AsyncClient) -> None:
    token = await onboard(client)
    r = await client.get("/api/v1/routines", headers=bearer(token))
    assert r.status_code == 200
    routines = r.json()
    assert [x["kind"] for x in routines] == ["morning", "evening"]
    assert routines[0]["start_time"] == "06:00:00"
    assert routines[1]["start_time"] == "22:00:00"
    assert all(x["items"] == [] for x in routines)
    assert all(x["days_of_week"] == [0, 1, 2, 3, 4, 5, 6] for x in routines)

    # Repetir o onboarding não duplica.
    await client.post(
        "/api/v1/users/me/onboarding",
        json={"name": "Ana", "timezone": TZ, "wake_time": "06:30", "discipline_target": 80},
        headers=bearer(token),
    )
    assert len((await client.get("/api/v1/routines", headers=bearer(token))).json()) == 2


async def test_only_one_morning_routine_allowed(client: AsyncClient) -> None:
    token = await onboard(client)
    r = await client.post(
        "/api/v1/routines", json={"name": "Outra manhã", "kind": "morning"}, headers=bearer(token)
    )
    assert r.status_code == 409


async def test_routine_and_items_crud_and_reorder(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)

    r = await client.post(
        "/api/v1/routines",
        json={"name": "Foco", "kind": "custom", "start_time": "09:00", "days_of_week": [0, 2, 4]},
        headers=h,
    )
    assert r.status_code == 201, r.text
    routine = r.json()
    assert routine["days_of_week"] == [0, 2, 4]
    rid = routine["id"]

    ids = []
    for title in ["Beber água", "Alongar", "Ler 10 páginas"]:
        r = await client.post(f"/api/v1/routines/{rid}/items", json={"title": title}, headers=h)
        assert r.status_code == 201, r.text
        ids.append(r.json()["id"])

    got = (await client.get(f"/api/v1/routines/{rid}", headers=h)).json()
    assert [i["title"] for i in got["items"]] == ["Beber água", "Alongar", "Ler 10 páginas"]
    assert [i["sort_order"] for i in got["items"]] == [0, 1, 2]

    # Reordenar
    r = await client.put(
        f"/api/v1/routines/{rid}/items/order",
        json={"item_ids": [ids[2], ids[0], ids[1]]},
        headers=h,
    )
    assert r.status_code == 200
    assert [i["title"] for i in r.json()["items"]] == ["Ler 10 páginas", "Beber água", "Alongar"]

    # Reordenar com lista incompleta falha
    r = await client.put(
        f"/api/v1/routines/{rid}/items/order", json={"item_ids": [ids[0]]}, headers=h
    )
    assert r.status_code == 409

    # Editar item e rotina
    r = await client.patch(
        f"/api/v1/routines/items/{ids[1]}",
        json={"title": "Alongar 5 min", "duration_minutes": 5},
        headers=h,
    )
    assert r.status_code == 200 and r.json()["duration_minutes"] == 5
    r = await client.patch(f"/api/v1/routines/{rid}", json={"name": "Foco profundo"}, headers=h)
    assert r.status_code == 200 and r.json()["name"] == "Foco profundo"

    # Excluir item (soft) some da listagem
    assert (await client.delete(f"/api/v1/routines/items/{ids[0]}", headers=h)).status_code == 204
    got = (await client.get(f"/api/v1/routines/{rid}", headers=h)).json()
    assert len(got["items"]) == 2

    # Excluir rotina (soft) some da listagem
    assert (await client.delete(f"/api/v1/routines/{rid}", headers=h)).status_code == 204
    assert (await client.get(f"/api/v1/routines/{rid}", headers=h)).status_code == 404
    assert len((await client.get("/api/v1/routines", headers=h)).json()) == 2


async def test_days_of_week_validation(client: AsyncClient) -> None:
    token = await onboard(client)
    r = await client.post(
        "/api/v1/routines", json={"name": "X", "days_of_week": []}, headers=bearer(token)
    )
    assert r.status_code == 422
    r = await client.post(
        "/api/v1/routines", json={"name": "X", "days_of_week": [7]}, headers=bearer(token)
    )
    assert r.status_code == 422


async def test_day_overview_and_checklist(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    routines = (await client.get("/api/v1/routines", headers=h)).json()
    morning = routines[0]["id"]

    # Rotina sem itens não entra no dia
    day = (await client.get("/api/v1/routines/day", headers=h)).json()
    assert day["date"] == today().isoformat()
    assert day["routines"] == [] and day["planned"] == 0

    a = (
        await client.post(f"/api/v1/routines/{morning}/items", json={"title": "Água"}, headers=h)
    ).json()
    b = (
        await client.post(f"/api/v1/routines/{morning}/items", json={"title": "Alongar"}, headers=h)
    ).json()

    day = (await client.get("/api/v1/routines/day", headers=h)).json()
    assert day["planned"] == 2 and day["completed"] == 0
    assert day["routines"][0]["kind"] == "morning"
    assert [i["completed_at"] for i in day["routines"][0]["items"]] == [None, None]

    # Marcar (idempotente)
    body = {"date": today().isoformat(), "done": True}
    for _ in range(2):
        r = await client.put(f"/api/v1/routines/items/{a['id']}/check", json=body, headers=h)
        assert r.status_code == 204, r.text
    day = (await client.get("/api/v1/routines/day", headers=h)).json()
    assert day["completed"] == 1
    assert day["routines"][0]["items"][0]["completed_at"] is not None

    # Desmarcar
    r = await client.put(
        f"/api/v1/routines/items/{a['id']}/check", json={**body, "done": False}, headers=h
    )
    assert r.status_code == 204
    assert (await client.get("/api/v1/routines/day", headers=h)).json()["completed"] == 0

    # Ontem só antes do corte das 03:00; futuro e anteontem nunca
    yesterday_d = today() - timedelta(days=1)
    r = await client.put(
        f"/api/v1/routines/items/{b['id']}/check",
        json={"date": yesterday_d.isoformat(), "done": True},
        headers=h,
    )
    assert r.status_code == (204 if is_day_open(yesterday_d, TZ) else 400)
    tomorrow = (today() + timedelta(days=1)).isoformat()
    r = await client.put(
        f"/api/v1/routines/items/{b['id']}/check", json={"date": tomorrow, "done": True}, headers=h
    )
    assert r.status_code == 400 and r.json()["error"]["code"] == "date_not_allowed"
    old = (today() - timedelta(days=2)).isoformat()
    r = await client.put(
        f"/api/v1/routines/items/{b['id']}/check", json={"date": old, "done": True}, headers=h
    )
    assert r.status_code == 400


async def test_day_respects_days_of_week(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    t = today()
    other_weekday = (t.weekday() + 1) % 7
    r = await client.post(
        "/api/v1/routines",
        json={"name": "Só amanhã", "days_of_week": [other_weekday]},
        headers=h,
    )
    rid = r.json()["id"]
    await client.post(f"/api/v1/routines/{rid}/items", json={"title": "X"}, headers=h)

    day = (await client.get("/api/v1/routines/day", headers=h)).json()
    assert all(x["id"] != rid for x in day["routines"])

    nxt = t + timedelta(days=1)
    day = (await client.get(f"/api/v1/routines/day?date={nxt.isoformat()}", headers=h)).json()
    assert any(x["id"] == rid for x in day["routines"])


async def test_routines_are_isolated_between_users(client: AsyncClient) -> None:
    a = await onboard(client, email="a@exemplo.com")
    client.cookies.clear()
    b = await onboard(client, email="b@exemplo.com")

    a_routines = (await client.get("/api/v1/routines", headers=bearer(a))).json()
    rid = a_routines[0]["id"]
    item = (
        await client.post(
            f"/api/v1/routines/{rid}/items", json={"title": "Só do A"}, headers=bearer(a)
        )
    ).json()

    # B não vê, não edita, não marca nem apaga nada do A
    assert (await client.get(f"/api/v1/routines/{rid}", headers=bearer(b))).status_code == 404
    assert (
        await client.patch(f"/api/v1/routines/{rid}", json={"name": "Hack"}, headers=bearer(b))
    ).status_code == 404
    r = await client.put(
        f"/api/v1/routines/items/{item['id']}/check",
        json={"date": today().isoformat(), "done": True},
        headers=bearer(b),
    )
    assert r.status_code == 404
    assert (
        await client.delete(f"/api/v1/routines/items/{item['id']}", headers=bearer(b))
    ).status_code == 404
    assert (await client.get("/api/v1/routines/day", headers=bearer(b))).json()["planned"] == 0
