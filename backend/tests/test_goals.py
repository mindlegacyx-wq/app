from datetime import timedelta

from httpx import AsyncClient

from app.core.dates import is_day_open
from tests.conftest import bearer
from tests.test_routines import TZ, onboard, today


async def test_goal_crud_and_status(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    deadline = (today() + timedelta(days=30)).isoformat()

    r = await client.post(
        "/api/v1/goals",
        json={
            "title": "Correr 5 km",
            "area": "health",
            "deadline": deadline,
            "description": "sem parar",
        },
        headers=h,
    )
    assert r.status_code == 201, r.text
    g = r.json()
    assert g["status"] == "active" and g["progress_pct"] == 0 and g["actions"] == []
    gid = g["id"]

    r = await client.patch(
        f"/api/v1/goals/{gid}", json={"title": "Correr 10 km", "clear_deadline": True}, headers=h
    )
    assert (
        r.status_code == 200
        and r.json()["title"] == "Correr 10 km"
        and r.json()["deadline"] is None
    )

    # Concluir e reativar
    r = await client.patch(f"/api/v1/goals/{gid}", json={"status": "completed"}, headers=h)
    assert r.json()["status"] == "completed" and r.json()["completed_at"] is not None
    assert [
        x["id"] for x in (await client.get("/api/v1/goals?status=active", headers=h)).json()
    ] == []
    assert [
        x["id"] for x in (await client.get("/api/v1/goals?status=completed", headers=h)).json()
    ] == [gid]
    r = await client.patch(f"/api/v1/goals/{gid}", json={"status": "active"}, headers=h)
    assert r.json()["status"] == "active" and r.json()["completed_at"] is None

    # Arquivar
    await client.patch(f"/api/v1/goals/{gid}", json={"status": "archived"}, headers=h)
    assert len((await client.get("/api/v1/goals", headers=h)).json()) == 1  # sem filtro lista tudo
    assert len((await client.get("/api/v1/goals?status=active", headers=h)).json()) == 0

    # Excluir (soft)
    assert (await client.delete(f"/api/v1/goals/{gid}", headers=h)).status_code == 204
    assert (await client.get(f"/api/v1/goals/{gid}", headers=h)).status_code == 404
    assert (await client.get("/api/v1/goals", headers=h)).json() == []


async def test_actions_crud_progress_and_reorder(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    gid = (await client.post("/api/v1/goals", json={"title": "Ler 12 livros"}, headers=h)).json()[
        "id"
    ]

    ids = []
    for title in ["Escolher lista", "Comprar o 1º", "Ler 20 páginas"]:
        r = await client.post(f"/api/v1/goals/{gid}/actions", json={"title": title}, headers=h)
        assert r.status_code == 201, r.text
        ids.append(r.json()["id"])

    g = (await client.get(f"/api/v1/goals/{gid}", headers=h)).json()
    assert g["actions_total"] == 3 and g["actions_done"] == 0 and g["progress_pct"] == 0

    # Concluir uma ação sem data → data vira hoje (crédito do dia)
    r = await client.patch(f"/api/v1/goals/actions/{ids[0]}", json={"is_done": True}, headers=h)
    assert r.status_code == 200
    assert r.json()["is_done"] is True and r.json()["due_date"] == today().isoformat()
    g = (await client.get(f"/api/v1/goals/{gid}", headers=h)).json()
    assert g["actions_done"] == 1 and g["progress_pct"] == 33

    # Desfazer mantém a data
    r = await client.patch(f"/api/v1/goals/actions/{ids[0]}", json={"is_done": False}, headers=h)
    assert r.json()["is_done"] is False and r.json()["done_at"] is None

    # Reordenar
    r = await client.put(
        f"/api/v1/goals/{gid}/actions/order",
        json={"action_ids": [ids[2], ids[0], ids[1]]},
        headers=h,
    )
    assert r.status_code == 200
    assert [a["id"] for a in r.json()["actions"]] == [ids[2], ids[0], ids[1]]
    r = await client.put(
        f"/api/v1/goals/{gid}/actions/order", json={"action_ids": [ids[0]]}, headers=h
    )
    assert r.status_code == 409

    # Editar título/data, limpar data, excluir
    tomorrow = (today() + timedelta(days=1)).isoformat()
    r = await client.patch(
        f"/api/v1/goals/actions/{ids[1]}",
        json={"title": "Comprar o primeiro", "due_date": tomorrow},
        headers=h,
    )
    assert r.json()["title"] == "Comprar o primeiro" and r.json()["due_date"] == tomorrow
    r = await client.patch(
        f"/api/v1/goals/actions/{ids[1]}", json={"clear_due_date": True}, headers=h
    )
    assert r.json()["due_date"] is None
    assert (await client.delete(f"/api/v1/goals/actions/{ids[1]}", headers=h)).status_code == 204
    assert (await client.get(f"/api/v1/goals/{gid}", headers=h)).json()["actions_total"] == 2


async def test_day_overview_overdue_and_score_integration(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    tday = today().isoformat()
    old = (today() - timedelta(days=3)).isoformat()
    gid = (await client.post("/api/v1/goals", json={"title": "Meta X"}, headers=h)).json()["id"]

    a_today = (
        await client.post(
            f"/api/v1/goals/{gid}/actions", json={"title": "Hoje", "due_date": tday}, headers=h
        )
    ).json()
    a_old = (
        await client.post(
            f"/api/v1/goals/{gid}/actions", json={"title": "Antiga", "due_date": old}, headers=h
        )
    ).json()
    await client.post(f"/api/v1/goals/{gid}/actions", json={"title": "Sem data"}, headers=h)

    day = (await client.get("/api/v1/goals/day", headers=h)).json()
    assert [a["id"] for a in day["actions"]] == [a_today["id"]]
    assert day["actions"][0]["goal_title"] == "Meta X"
    assert [a["id"] for a in day["overdue"]] == [a_old["id"]]
    assert day["planned"] == 1 and day["completed"] == 0

    # Entra no percentual do dia (1 acordar + 1 ação)
    p = (await client.get("/api/v1/progress/day", headers=h)).json()
    assert p["breakdown"]["goals"] == {"planned": 1, "completed": 0}
    assert p["planned"] == 2
    assert {"kind": "goals", "title": "Meta X: Hoje"} in p["missing"]

    # Concluir a antiga: crédito vai para hoje (dia antigo já fechou)
    r = await client.patch(
        f"/api/v1/goals/actions/{a_old['id']}", json={"is_done": True}, headers=h
    )
    expected = old if is_day_open(today() - timedelta(days=3), TZ) else tday
    assert r.json()["due_date"] == expected
    day = (await client.get("/api/v1/goals/day", headers=h)).json()
    assert day["overdue"] == [] and day["planned"] == 2 and day["completed"] == 1

    # Meta concluída: ações saem do dia
    await client.patch(f"/api/v1/goals/{gid}", json={"status": "completed"}, headers=h)
    day = (await client.get("/api/v1/goals/day", headers=h)).json()
    assert day["planned"] == 0
    p = (await client.get("/api/v1/progress/day", headers=h)).json()
    assert p["breakdown"]["goals"] == {"planned": 0, "completed": 0}


async def test_goals_are_isolated_between_users(client: AsyncClient) -> None:
    a = await onboard(client, email="a@exemplo.com")
    client.cookies.clear()
    b = await onboard(client, email="b@exemplo.com")
    gid = (await client.post("/api/v1/goals", json={"title": "Só do A"}, headers=bearer(a))).json()[
        "id"
    ]
    act = (
        await client.post(f"/api/v1/goals/{gid}/actions", json={"title": "x"}, headers=bearer(a))
    ).json()

    assert (await client.get(f"/api/v1/goals/{gid}", headers=bearer(b))).status_code == 404
    assert (
        await client.post(f"/api/v1/goals/{gid}/actions", json={"title": "y"}, headers=bearer(b))
    ).status_code == 404
    assert (
        await client.patch(
            f"/api/v1/goals/actions/{act['id']}", json={"is_done": True}, headers=bearer(b)
        )
    ).status_code == 404
    assert (await client.get("/api/v1/goals", headers=bearer(b))).json() == []
