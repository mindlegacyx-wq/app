"""Tarefas fixas: a regra gera a tarefa de cada dia, sem reescrever o passado."""

from datetime import timedelta

from httpx import AsyncClient

from tests.conftest import bearer
from tests.test_routines import onboard, today


def _weekdays(*days: int) -> list[int]:
    return list(days)


async def test_recurrence_creates_todays_task(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    day = today()

    r = await client.post(
        "/api/v1/tasks/recurrences",
        json={"title": "Beber 3 L de água", "days_of_week": [day.weekday()], "priority": "high"},
        headers=h,
    )
    assert r.status_code == 201, r.text
    rec = r.json()
    assert rec["days_of_week"] == [day.weekday()] and rec["is_active"] is True
    assert rec["start_date"] == day.isoformat()

    out = (await client.get("/api/v1/tasks/day", headers=h)).json()
    assert [t["title"] for t in out["tasks"]] == ["Beber 3 L de água"]
    assert out["tasks"][0]["recurrence_id"] == rec["id"]
    assert out["planned"] == 1 and out["completed"] == 0


async def test_only_on_the_chosen_weekdays(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    other = (today() + timedelta(days=1)).weekday()

    await client.post(
        "/api/v1/tasks/recurrences",
        json={"title": "Academia", "days_of_week": [other]},
        headers=h,
    )
    out = (await client.get("/api/v1/tasks/day", headers=h)).json()
    assert out["tasks"] == []

    # No dia certo ela aparece.
    tomorrow = (today() + timedelta(days=1)).isoformat()
    out = (await client.get(f"/api/v1/tasks/day?date={tomorrow}", headers=h)).json()
    assert [t["title"] for t in out["tasks"]] == ["Academia"]


async def test_generation_is_idempotent(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    await client.post(
        "/api/v1/tasks/recurrences",
        json={"title": "Alongar", "days_of_week": [today().weekday()]},
        headers=h,
    )
    for _ in range(3):
        out = (await client.get("/api/v1/tasks/day", headers=h)).json()
    assert len(out["tasks"]) == 1


async def test_never_creates_tasks_before_it_existed(client: AsyncClient) -> None:
    """Passado não muda: a regra nasce hoje e não enche os dias que já foram vividos."""
    token = await onboard(client)
    h = bearer(token)
    await client.post(
        "/api/v1/tasks/recurrences",
        json={"title": "Ler 10 páginas", "days_of_week": [0, 1, 2, 3, 4, 5, 6]},
        headers=h,
    )
    for back in (1, 2, 7):
        past = (today() - timedelta(days=back)).isoformat()
        out = (await client.get(f"/api/v1/tasks/day?date={past}", headers=h)).json()
        assert out["tasks"] == [], past


async def test_missed_fixed_task_does_not_become_overdue(client: AsyncClient) -> None:
    """Água não bebida ontem não vira dívida hoje — ela contou (ou não) no dia dela."""
    token = await onboard(client)
    h = bearer(token)
    tomorrow = today() + timedelta(days=1)

    rec = (
        await client.post(
            "/api/v1/tasks/recurrences",
            json={"title": "Água", "days_of_week": [0, 1, 2, 3, 4, 5, 6]},
            headers=h,
        )
    ).json()
    # a de hoje nasce aqui; no "amanhã" ela fica para trás e continua pendente
    await client.get("/api/v1/tasks/day", headers=h)
    out = (await client.get(f"/api/v1/tasks/day?date={tomorrow.isoformat()}", headers=h)).json()
    assert [t["title"] for t in out["tasks"]] == ["Água"]
    assert out["overdue"] == []

    # uma tarefa normal do mesmo dia continua aparecendo como atrasada
    await client.post(
        "/api/v1/tasks", json={"title": "Pagar boleto", "date": today().isoformat()}, headers=h
    )
    out = (await client.get(f"/api/v1/tasks/day?date={tomorrow.isoformat()}", headers=h)).json()
    assert [t["title"] for t in out["overdue"]] == ["Pagar boleto"]
    assert rec["title"] not in [t["title"] for t in out["overdue"]]


async def test_editing_the_rule_updates_todays_pending_task(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    rec = (
        await client.post(
            "/api/v1/tasks/recurrences",
            json={"title": "Água", "days_of_week": [today().weekday()], "priority": "low"},
            headers=h,
        )
    ).json()
    await client.get("/api/v1/tasks/day", headers=h)

    r = await client.patch(
        f"/api/v1/tasks/recurrences/{rec['id']}",
        json={"title": "Beber 3 L de água", "priority": "high"},
        headers=h,
    )
    assert r.status_code == 200
    out = (await client.get("/api/v1/tasks/day", headers=h)).json()
    assert [(t["title"], t["priority"]) for t in out["tasks"]] == [("Beber 3 L de água", "high")]


async def test_completed_task_keeps_its_wording_when_the_rule_changes(
    client: AsyncClient,
) -> None:
    token = await onboard(client)
    h = bearer(token)
    rec = (
        await client.post(
            "/api/v1/tasks/recurrences",
            json={"title": "Água", "days_of_week": [today().weekday()]},
            headers=h,
        )
    ).json()
    task = (await client.get("/api/v1/tasks/day", headers=h)).json()["tasks"][0]
    await client.patch(f"/api/v1/tasks/{task['id']}", json={"status": "done"}, headers=h)

    await client.patch(
        f"/api/v1/tasks/recurrences/{rec['id']}", json={"title": "Outra coisa"}, headers=h
    )
    out = (await client.get("/api/v1/tasks/day", headers=h)).json()
    assert [(t["title"], t["status"]) for t in out["tasks"]] == [("Água", "done")]


async def test_pausing_and_unchecking_a_day_removes_todays_task(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    rec = (
        await client.post(
            "/api/v1/tasks/recurrences",
            json={"title": "Água", "days_of_week": [0, 1, 2, 3, 4, 5, 6]},
            headers=h,
        )
    ).json()
    assert len((await client.get("/api/v1/tasks/day", headers=h)).json()["tasks"]) == 1

    await client.patch(
        f"/api/v1/tasks/recurrences/{rec['id']}", json={"is_active": False}, headers=h
    )
    assert (await client.get("/api/v1/tasks/day", headers=h)).json()["tasks"] == []

    # religou: volta
    await client.patch(
        f"/api/v1/tasks/recurrences/{rec['id']}", json={"is_active": True}, headers=h
    )
    assert len((await client.get("/api/v1/tasks/day", headers=h)).json()["tasks"]) == 1

    # tirou o dia de hoje da regra: sai de hoje
    others = [d for d in range(7) if d != today().weekday()]
    await client.patch(
        f"/api/v1/tasks/recurrences/{rec['id']}", json={"days_of_week": others}, headers=h
    )
    assert (await client.get("/api/v1/tasks/day", headers=h)).json()["tasks"] == []


async def test_delete_keeps_history_and_clears_today(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    rec = (
        await client.post(
            "/api/v1/tasks/recurrences",
            json={"title": "Água", "days_of_week": [0, 1, 2, 3, 4, 5, 6]},
            headers=h,
        )
    ).json()
    await client.get("/api/v1/tasks/day", headers=h)

    assert (
        await client.delete(f"/api/v1/tasks/recurrences/{rec['id']}", headers=h)
    ).status_code == 204
    assert (await client.get("/api/v1/tasks/recurrences", headers=h)).json() == []
    assert (await client.get("/api/v1/tasks/day", headers=h)).json()["tasks"] == []

    trash = (await client.get("/api/v1/trash", headers=h)).json()
    assert "task_recurrence" in {i["kind"] for i in trash["items"]}


async def test_validation_and_isolation(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    r = await client.post(
        "/api/v1/tasks/recurrences", json={"title": "X", "days_of_week": []}, headers=h
    )
    assert r.status_code == 422
    r = await client.post(
        "/api/v1/tasks/recurrences", json={"title": "X", "days_of_week": [9]}, headers=h
    )
    assert r.status_code == 422

    rec = (
        await client.post(
            "/api/v1/tasks/recurrences", json={"title": "Minha", "days_of_week": [0]}, headers=h
        )
    ).json()
    other = bearer(await onboard(client, email="outro-fixa@exemplo.com"))
    assert (await client.get("/api/v1/tasks/recurrences", headers=other)).json() == []
    assert (
        await client.patch(
            f"/api/v1/tasks/recurrences/{rec['id']}", json={"title": "hack"}, headers=other
        )
    ).status_code == 404
