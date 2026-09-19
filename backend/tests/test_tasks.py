from datetime import timedelta

from httpx import AsyncClient

from app.core.dates import is_day_open
from tests.conftest import bearer
from tests.test_routines import TZ, onboard, today


async def test_categories_crud(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)

    r = await client.post(
        "/api/v1/tasks/categories", json={"name": "Trabalho", "color": "#4f8cff"}, headers=h
    )
    assert r.status_code == 201, r.text
    cat = r.json()
    assert cat["color"] == "#4F8CFF"

    r = await client.post(
        "/api/v1/tasks/categories", json={"name": "X", "color": "azul"}, headers=h
    )
    assert r.status_code == 422

    r = await client.patch(
        f"/api/v1/tasks/categories/{cat['id']}", json={"name": "Foco"}, headers=h
    )
    assert r.status_code == 200 and r.json()["name"] == "Foco"

    assert len((await client.get("/api/v1/tasks/categories", headers=h)).json()) == 1
    assert (
        await client.delete(f"/api/v1/tasks/categories/{cat['id']}", headers=h)
    ).status_code == 204
    assert (await client.get("/api/v1/tasks/categories", headers=h)).json() == []


async def test_create_task_defaults_to_today_and_sorts_by_priority(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)

    low = (
        await client.post("/api/v1/tasks", json={"title": "Baixa", "priority": "low"}, headers=h)
    ).json()
    med = (await client.post("/api/v1/tasks", json={"title": "Média"}, headers=h)).json()
    high = (
        await client.post("/api/v1/tasks", json={"title": "Alta", "priority": "high"}, headers=h)
    ).json()
    assert med["date"] == today().isoformat()
    assert med["priority"] == "medium" and med["status"] == "pending"

    day = (await client.get("/api/v1/tasks/day", headers=h)).json()
    assert [t["id"] for t in day["tasks"]] == [high["id"], med["id"], low["id"]]
    assert day["planned"] == 3 and day["completed"] == 0 and day["overdue"] == []


async def test_complete_uncomplete_cancel_and_counts(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    a = (
        await client.post("/api/v1/tasks", json={"title": "A", "priority": "high"}, headers=h)
    ).json()
    b = (await client.post("/api/v1/tasks", json={"title": "B"}, headers=h)).json()
    c = (await client.post("/api/v1/tasks", json={"title": "C"}, headers=h)).json()

    r = await client.patch(f"/api/v1/tasks/{a['id']}", json={"status": "done"}, headers=h)
    assert r.status_code == 200
    assert r.json()["completed_at"] is not None and r.json()["date"] == today().isoformat()

    r = await client.patch(f"/api/v1/tasks/{c['id']}", json={"status": "cancelled"}, headers=h)
    assert r.status_code == 200

    day = (await client.get("/api/v1/tasks/day", headers=h)).json()
    assert day["planned"] == 2 and day["completed"] == 1
    # pendentes primeiro, depois feitas, depois canceladas
    assert [t["id"] for t in day["tasks"]] == [b["id"], a["id"], c["id"]]

    r = await client.patch(f"/api/v1/tasks/{a['id']}", json={"status": "pending"}, headers=h)
    assert r.json()["completed_at"] is None
    assert (await client.get("/api/v1/tasks/day", headers=h)).json()["completed"] == 0


async def test_overdue_and_completion_moves_old_task_to_today(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    old_day = (today() - timedelta(days=3)).isoformat()
    yesterday = (today() - timedelta(days=1)).isoformat()

    old = (
        await client.post("/api/v1/tasks", json={"title": "Antiga", "date": old_day}, headers=h)
    ).json()
    ydy = (
        await client.post("/api/v1/tasks", json={"title": "Ontem", "date": yesterday}, headers=h)
    ).json()

    day = (await client.get("/api/v1/tasks/day", headers=h)).json()
    assert [t["id"] for t in day["overdue"]] == [old["id"], ydy["id"]]
    assert day["planned"] == 0

    # Concluir a de 3 dias atrás: crédito vai para hoje
    r = await client.patch(f"/api/v1/tasks/{old['id']}", json={"status": "done"}, headers=h)
    assert r.json()["date"] == today().isoformat()

    # Concluir a de ontem: fica em ontem só se ontem ainda está aberto (antes das 03:00)
    yesterday_open = is_day_open(today() - timedelta(days=1), TZ)
    r = await client.patch(f"/api/v1/tasks/{ydy['id']}", json={"status": "done"}, headers=h)
    assert r.json()["date"] == (yesterday if yesterday_open else today().isoformat())

    day = (await client.get("/api/v1/tasks/day", headers=h)).json()
    assert day["overdue"] == []
    credited_today = 1 + (0 if yesterday_open else 1)
    assert day["planned"] == credited_today and day["completed"] == credited_today
    ydy_day = (await client.get(f"/api/v1/tasks/day?date={yesterday}", headers=h)).json()
    assert ydy_day["completed"] == (1 if yesterday_open else 0)


async def test_future_task_completed_early_counts_today(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    tomorrow = (today() + timedelta(days=1)).isoformat()
    t = (
        await client.post("/api/v1/tasks", json={"title": "Amanhã", "date": tomorrow}, headers=h)
    ).json()
    assert (await client.get("/api/v1/tasks/day", headers=h)).json()["planned"] == 0
    r = await client.patch(f"/api/v1/tasks/{t['id']}", json={"status": "done"}, headers=h)
    assert r.json()["date"] == today().isoformat()


async def test_move_overdue_to_today_and_edit_fields(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    cat = (
        await client.post(
            "/api/v1/tasks/categories", json={"name": "Casa", "color": "#00AA88"}, headers=h
        )
    ).json()
    old_day = (today() - timedelta(days=2)).isoformat()
    t = (
        await client.post("/api/v1/tasks", json={"title": "Lavar", "date": old_day}, headers=h)
    ).json()

    r = await client.patch(
        f"/api/v1/tasks/{t['id']}",
        json={
            "date": today().isoformat(),
            "priority": "high",
            "category_id": cat["id"],
            "notes": "roupa branca",
        },
        headers=h,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["date"] == today().isoformat() and body["priority"] == "high"
    assert body["category_id"] == cat["id"] and body["notes"] == "roupa branca"

    r = await client.patch(
        f"/api/v1/tasks/{t['id']}", json={"clear_category": True, "clear_notes": True}, headers=h
    )
    assert r.json()["category_id"] is None and r.json()["notes"] is None

    # Excluir categoria limpa a referência nas tarefas
    await client.patch(f"/api/v1/tasks/{t['id']}", json={"category_id": cat["id"]}, headers=h)
    await client.delete(f"/api/v1/tasks/categories/{cat['id']}", headers=h)
    day = (await client.get("/api/v1/tasks/day", headers=h)).json()
    assert day["tasks"][0]["category_id"] is None

    # Soft delete some da listagem
    assert (await client.delete(f"/api/v1/tasks/{t['id']}", headers=h)).status_code == 204
    assert (await client.get("/api/v1/tasks/day", headers=h)).json()["tasks"] == []


async def test_tasks_are_isolated_between_users(client: AsyncClient) -> None:
    a = await onboard(client, email="a@exemplo.com")
    client.cookies.clear()
    b = await onboard(client, email="b@exemplo.com")

    cat_a = (
        await client.post(
            "/api/v1/tasks/categories", json={"name": "A", "color": "#111111"}, headers=bearer(a)
        )
    ).json()
    task_a = (
        await client.post("/api/v1/tasks", json={"title": "Só do A"}, headers=bearer(a))
    ).json()

    assert (
        await client.patch(
            f"/api/v1/tasks/{task_a['id']}", json={"status": "done"}, headers=bearer(b)
        )
    ).status_code == 404
    assert (
        await client.delete(f"/api/v1/tasks/{task_a['id']}", headers=bearer(b))
    ).status_code == 404
    # B não consegue usar a categoria do A
    r = await client.post(
        "/api/v1/tasks", json={"title": "X", "category_id": cat_a["id"]}, headers=bearer(b)
    )
    assert r.status_code == 404
    assert (await client.get("/api/v1/tasks/day", headers=bearer(b))).json()["tasks"] == []
    assert (await client.get("/api/v1/tasks/categories", headers=bearer(b))).json() == []
