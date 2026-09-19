"""Fase 8: lixeira — listar, restaurar, regras de pai/conflito e exclusão definitiva."""

from datetime import timedelta

from httpx import AsyncClient
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dates import now_utc
from app.modules.routines.models import RoutineItem
from app.modules.tasks.models import Task
from app.modules.trash import service as trash_service
from app.modules.workouts.models import Workout
from tests.conftest import bearer
from tests.test_routines import onboard, today


async def _trash(client: AsyncClient, h: dict[str, str]) -> list[dict]:
    r = await client.get("/api/v1/trash", headers=h)
    assert r.status_code == 200, r.text
    return r.json()["items"]


async def test_deleted_items_appear_grouped_and_restore(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    assert await _trash(client, h) == []

    task = (await client.post("/api/v1/tasks", json={"title": "Pagar conta"}, headers=h)).json()
    await client.delete(f"/api/v1/tasks/{task['id']}", headers=h)
    goal = (
        await client.post(
            "/api/v1/goals", json={"title": "Ler 12 livros", "area": "study"}, headers=h
        )
    ).json()
    await client.delete(f"/api/v1/goals/{goal['id']}", headers=h)
    alarm = (await client.get("/api/v1/alarms", headers=h)).json()["alarms"][0]
    await client.delete(f"/api/v1/alarms/{alarm['id']}", headers=h)

    items = await _trash(client, h)
    assert {(i["kind"], i["title"]) for i in items} == {
        ("task", "Pagar conta"),
        ("goal", "Ler 12 livros"),
        ("alarm", "Acordar · 06:00"),
    }
    assert all(i["expires_at"] > i["deleted_at"] for i in items)
    assert (await client.get("/api/v1/trash", headers=h)).json()["retention_days"] == 30

    r = await client.post(
        "/api/v1/trash/restore", json={"kind": "task", "id": task["id"]}, headers=h
    )
    assert r.status_code == 200 and r.json()["restored"] is True
    assert {i["kind"] for i in await _trash(client, h)} == {"goal", "alarm"}
    day = (await client.get("/api/v1/tasks/day", headers=h)).json()
    assert [t["title"] for t in day["tasks"]] == ["Pagar conta"]

    # Restaurar de novo → não está mais na lixeira
    r = await client.post(
        "/api/v1/trash/restore", json={"kind": "task", "id": task["id"]}, headers=h
    )
    assert r.status_code == 404
    r = await client.post(
        "/api/v1/trash/restore", json={"kind": "nada", "id": task["id"]}, headers=h
    )
    assert r.status_code == 404


async def test_child_of_deleted_parent_is_hidden_and_restore_rules(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    morning = next(
        r
        for r in (await client.get("/api/v1/routines", headers=h)).json()
        if r["kind"] == "morning"
    )
    item = (
        await client.post(
            f"/api/v1/routines/{morning['id']}/items", json={"title": "Alongar"}, headers=h
        )
    ).json()
    # Item excluído sozinho aparece; depois de excluir a rotina, só a rotina aparece.
    await client.delete(f"/api/v1/routines/items/{item['id']}", headers=h)
    assert [i["kind"] for i in await _trash(client, h)] == ["routine_item"]
    await client.delete(f"/api/v1/routines/{morning['id']}", headers=h)
    assert [i["kind"] for i in await _trash(client, h)] == ["routine"]

    # Restaurar o item com o pai na lixeira → conflito
    r = await client.post(
        "/api/v1/trash/restore", json={"kind": "routine_item", "id": item["id"]}, headers=h
    )
    assert r.status_code == 409

    # Criar outra rotina da manhã e tentar restaurar a antiga → conflito (só uma da manhã)
    await client.post("/api/v1/routines", json={"name": "Nova manhã", "kind": "morning"}, headers=h)
    r = await client.post(
        "/api/v1/trash/restore", json={"kind": "routine", "id": morning["id"]}, headers=h
    )
    assert r.status_code == 409
    # Removendo a nova, a antiga volta com o item ainda excluído (restaurável em seguida)
    new_id = next(
        r["id"]
        for r in (await client.get("/api/v1/routines", headers=h)).json()
        if r["kind"] == "morning"
    )
    await client.delete(f"/api/v1/routines/{new_id}", headers=h)
    r = await client.post(
        "/api/v1/trash/restore", json={"kind": "routine", "id": morning["id"]}, headers=h
    )
    assert r.status_code == 200
    kinds = sorted(i["kind"] for i in await _trash(client, h))
    assert kinds == ["routine", "routine_item"]  # a "Nova manhã" e o item "Alongar"
    r = await client.post(
        "/api/v1/trash/restore", json={"kind": "routine_item", "id": item["id"]}, headers=h
    )
    assert r.status_code == 200
    restored = (await client.get(f"/api/v1/routines/{morning['id']}", headers=h)).json()
    assert [i["title"] for i in restored["items"]] == ["Alongar"]


async def test_purge_removes_expired_but_keeps_history(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    token = await onboard(client)
    h = bearer(token)
    # Treino sem sessão (será apagado) e treino com sessão (fica, por causa do histórico)
    plain = (
        await client.post(
            "/api/v1/workouts",
            json={"name": "Sem sessão", "days_of_week": [0, 1, 2, 3, 4, 5, 6]},
            headers=h,
        )
    ).json()
    used = (
        await client.post(
            "/api/v1/workouts",
            json={"name": "Com sessão", "days_of_week": [0, 1, 2, 3, 4, 5, 6]},
            headers=h,
        )
    ).json()
    await client.post(
        f"/api/v1/workouts/{used['id']}/exercises", json={"name": "Agachamento"}, headers=h
    )
    r = await client.post(
        f"/api/v1/workouts/{used['id']}/sessions", json={"date": today().isoformat()}, headers=h
    )
    assert r.status_code in (200, 201), r.text
    await client.patch(
        f"/api/v1/workouts/sessions/{r.json()['id']}", json={"status": "completed"}, headers=h
    )
    # Item de rotina com check (fica) e tarefa (apagada)
    morning = next(
        r
        for r in (await client.get("/api/v1/routines", headers=h)).json()
        if r["kind"] == "morning"
    )
    item = (
        await client.post(
            f"/api/v1/routines/{morning['id']}/items", json={"title": "Água"}, headers=h
        )
    ).json()
    await client.put(
        f"/api/v1/routines/items/{item['id']}/check",
        json={"date": today().isoformat(), "done": True},
        headers=h,
    )
    task = (await client.post("/api/v1/tasks", json={"title": "Velha"}, headers=h)).json()

    for path in (
        f"/api/v1/workouts/{plain['id']}",
        f"/api/v1/workouts/{used['id']}",
        f"/api/v1/routines/items/{item['id']}",
        f"/api/v1/tasks/{task['id']}",
    ):
        assert (await client.delete(path, headers=h)).status_code == 204
    assert len(await _trash(client, h)) == 4

    # Envelhece tudo 31 dias e roda a limpeza
    old = now_utc() - timedelta(days=31)
    for model in (Workout, RoutineItem):
        await db_session.execute(
            update(model).where(model.deleted_at.is_not(None)).values(deleted_at=old)
        )
    await db_session.execute(
        update(Task).where(Task.deleted_at.is_not(None)).values(deleted_at=old)
    )
    await db_session.flush()

    purged = await trash_service.purge_expired(db_session)
    assert purged == 2  # treino sem sessão + tarefa

    remaining = (await db_session.scalars(select(Workout.name))).all()
    assert remaining == ["Com sessão"]
    assert (
        await db_session.scalar(select(RoutineItem).where(RoutineItem.id == item["id"]))
    ) is not None
    # Fora da janela de 30 dias, nada aparece na lixeira (o que ficou está apenas oculto)
    assert await _trash(client, h) == []
    # E o histórico de treinos continua íntegro
    hist = (
        await client.get(
            "/api/v1/workouts/history",
            params={"start": today().isoformat(), "end": today().isoformat()},
            headers=h,
        )
    ).json()
    assert [i["workout_name"] for i in hist["items"]] == ["Com sessão"]


async def test_trash_is_isolated_between_users(client: AsyncClient) -> None:
    a = await onboard(client, email="a@exemplo.com")
    client.cookies.clear()
    b = await onboard(client, email="b@exemplo.com")
    task = (await client.post("/api/v1/tasks", json={"title": "De A"}, headers=bearer(a))).json()
    await client.delete(f"/api/v1/tasks/{task['id']}", headers=bearer(a))
    assert await _trash(client, bearer(b)) == []
    r = await client.post(
        "/api/v1/trash/restore", json={"kind": "task", "id": task["id"]}, headers=bearer(b)
    )
    assert r.status_code == 404
    routines_b = (await client.get("/api/v1/routines", headers=bearer(b))).json()
    assert len(routines_b) == 2  # nada de A vazou para B
