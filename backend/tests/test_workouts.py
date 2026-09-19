from datetime import timedelta

from httpx import AsyncClient

from tests.conftest import bearer
from tests.test_routines import onboard, today


async def _plan(client: AsyncClient, h: dict, name: str = "Treino A", days=None) -> dict:
    days = days if days is not None else list(range(7))
    r = await client.post("/api/v1/workouts", json={"name": name, "days_of_week": days}, headers=h)
    assert r.status_code == 201, r.text
    return r.json()


async def _exercise(client: AsyncClient, h: dict, wid: str, name: str, **extra) -> dict:
    r = await client.post(
        f"/api/v1/workouts/{wid}/exercises", json={"name": name, **extra}, headers=h
    )
    assert r.status_code == 201, r.text
    return r.json()


async def test_workout_and_exercises_crud_and_reorder(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    w = await _plan(client, h, days=[0, 2, 4])
    assert w["days_of_week"] == [0, 2, 4] and w["exercises"] == [] and w["is_active"] is True

    e1 = await _exercise(
        client, h, w["id"], "Agachamento", sets=4, reps="8-10", load="60kg", rest_seconds=90
    )
    e2 = await _exercise(client, h, w["id"], "Supino", sets=3, reps="12")
    e3 = await _exercise(client, h, w["id"], "Prancha", reps="45s")
    assert e1["rest_seconds"] == 90 and e3["sets"] is None

    got = (await client.get(f"/api/v1/workouts/{w['id']}", headers=h)).json()
    assert [e["name"] for e in got["exercises"]] == ["Agachamento", "Supino", "Prancha"]

    r = await client.put(
        f"/api/v1/workouts/{w['id']}/exercises/order",
        json={"exercise_ids": [e3["id"], e1["id"], e2["id"]]},
        headers=h,
    )
    assert [e["name"] for e in r.json()["exercises"]] == ["Prancha", "Agachamento", "Supino"]

    r = await client.patch(
        f"/api/v1/workouts/exercises/{e2['id']}",
        json={"load": "40kg", "clear": ["reps"]},
        headers=h,
    )
    assert r.json()["load"] == "40kg" and r.json()["reps"] is None

    r = await client.patch(
        f"/api/v1/workouts/{w['id']}",
        json={"name": "Treino A · Pernas", "notes": "foco"},
        headers=h,
    )
    assert r.json()["name"] == "Treino A · Pernas" and r.json()["notes"] == "foco"

    assert (
        await client.delete(f"/api/v1/workouts/exercises/{e3['id']}", headers=h)
    ).status_code == 204
    assert (
        len((await client.get(f"/api/v1/workouts/{w['id']}", headers=h)).json()["exercises"]) == 2
    )
    assert (await client.delete(f"/api/v1/workouts/{w['id']}", headers=h)).status_code == 204
    assert (await client.get("/api/v1/workouts", headers=h)).json() == []

    r = await client.post("/api/v1/workouts", json={"name": "X", "days_of_week": []}, headers=h)
    assert r.status_code == 422


async def test_day_overview_respects_weekday_and_exercises(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    t = today()
    other = (t.weekday() + 1) % 7

    empty = await _plan(client, h, "Sem exercícios")
    off = await _plan(client, h, "Outro dia", days=[other])
    await _exercise(client, h, off["id"], "Corrida")
    todayw = await _plan(client, h, "Hoje", days=[t.weekday()])
    await _exercise(client, h, todayw["id"], "Remada")

    day = (await client.get("/api/v1/workouts/day", headers=h)).json()
    assert [w["workout_id"] for w in day["workouts"]] == [todayw["id"]]
    assert day["planned"] == 1 and day["completed"] == 0
    assert day["workouts"][0]["session"] is None
    assert empty["id"] not in [w["workout_id"] for w in day["workouts"]]

    # Pausar o plano tira do dia
    await client.patch(f"/api/v1/workouts/{todayw['id']}", json={"is_active": False}, headers=h)
    assert (await client.get("/api/v1/workouts/day", headers=h)).json()["planned"] == 0


async def test_session_flow_and_score(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    tday = today().isoformat()
    w = await _plan(client, h)
    a = await _exercise(client, h, w["id"], "Agachamento", rest_seconds=60)
    b = await _exercise(client, h, w["id"], "Supino")

    # Entra no percentual: 1 acordar + 1 treino
    p = (await client.get("/api/v1/progress/day", headers=h)).json()
    assert p["breakdown"]["workout"] == {"planned": 1, "completed": 0}
    assert {"kind": "workout", "title": "Treino A"} in p["missing"]

    # Iniciar (idempotente)
    r = await client.post(f"/api/v1/workouts/{w['id']}/sessions", json={"date": tday}, headers=h)
    assert r.status_code == 200, r.text
    s = r.json()
    assert s["status"] == "in_progress" and s["started_at"] is not None
    again = (
        await client.post(f"/api/v1/workouts/{w['id']}/sessions", json={"date": tday}, headers=h)
    ).json()
    assert again["id"] == s["id"]

    # Marcar exercícios
    r = await client.put(
        f"/api/v1/workouts/sessions/{s['id']}/exercises/{a['id']}",
        json={"completed": True},
        headers=h,
    )
    assert r.status_code == 200
    day = (await client.get("/api/v1/workouts/day", headers=h)).json()
    dw = day["workouts"][0]
    assert dw["exercises_done"] == 1 and dw["exercises"][0]["completed"] is True
    assert day["completed"] == 0  # só conta quando a sessão é concluída

    # Concluir
    r = await client.patch(
        f"/api/v1/workouts/sessions/{s['id']}", json={"status": "completed"}, headers=h
    )
    assert r.json()["status"] == "completed" and r.json()["completed_at"] is not None
    day = (await client.get("/api/v1/workouts/day", headers=h)).json()
    assert day["completed"] == 1
    p = (await client.get("/api/v1/progress/day", headers=h)).json()
    assert p["breakdown"]["workout"] == {"planned": 1, "completed": 1}

    # Pular: planejado e não concluído; aparece como pulado no que ficou de fora
    await client.patch(
        f"/api/v1/workouts/sessions/{s['id']}", json={"status": "skipped"}, headers=h
    )
    p = (await client.get("/api/v1/progress/day", headers=h)).json()
    assert p["breakdown"]["workout"] == {"planned": 1, "completed": 0}
    assert {"kind": "workout", "title": "Treino A (pulado)"} in p["missing"]

    # Marcar um exercício depois de pular reabre a sessão
    r = await client.put(
        f"/api/v1/workouts/sessions/{s['id']}/exercises/{b['id']}",
        json={"completed": True},
        headers=h,
    )
    assert r.json()["status"] == "in_progress"

    # Exercício de outro treino não entra nesta sessão
    other = await _plan(client, h, "Outro")
    oe = await _exercise(client, h, other["id"], "Rosca")
    r = await client.put(
        f"/api/v1/workouts/sessions/{s['id']}/exercises/{oe['id']}",
        json={"completed": True},
        headers=h,
    )
    assert r.status_code == 409

    # Sessão em dia futuro não pode
    tomorrow = (today() + timedelta(days=1)).isoformat()
    r = await client.post(
        f"/api/v1/workouts/{w['id']}/sessions", json={"date": tomorrow}, headers=h
    )
    assert r.status_code == 400 and r.json()["error"]["code"] == "date_not_allowed"


async def test_history_lists_finished_sessions(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    tday = today().isoformat()
    w = await _plan(client, h, "Pernas")
    e = await _exercise(client, h, w["id"], "Agachamento")
    s = (
        await client.post(f"/api/v1/workouts/{w['id']}/sessions", json={"date": tday}, headers=h)
    ).json()

    # Em andamento não aparece no histórico
    hist = (await client.get("/api/v1/workouts/history", headers=h)).json()
    assert hist["items"] == []

    await client.put(
        f"/api/v1/workouts/sessions/{s['id']}/exercises/{e['id']}",
        json={"completed": True},
        headers=h,
    )
    await client.patch(
        f"/api/v1/workouts/sessions/{s['id']}", json={"status": "completed"}, headers=h
    )
    hist = (await client.get("/api/v1/workouts/history", headers=h)).json()
    assert len(hist["items"]) == 1
    item = hist["items"][0]
    assert item["workout_name"] == "Pernas" and item["status"] == "completed"
    assert item["exercises_done"] == 1 and item["exercises_total"] == 1
    assert item["date"] == tday

    r = await client.get(
        f"/api/v1/workouts/history?start={tday}&end={(today() - timedelta(days=1)).isoformat()}",
        headers=h,
    )
    assert r.status_code == 400


async def test_workouts_are_isolated_between_users(client: AsyncClient) -> None:
    a = await onboard(client, email="a@exemplo.com")
    client.cookies.clear()
    b = await onboard(client, email="b@exemplo.com")
    w = await _plan(client, bearer(a))
    e = await _exercise(client, bearer(a), w["id"], "X")
    s = (
        await client.post(
            f"/api/v1/workouts/{w['id']}/sessions",
            json={"date": today().isoformat()},
            headers=bearer(a),
        )
    ).json()

    assert (await client.get(f"/api/v1/workouts/{w['id']}", headers=bearer(b))).status_code == 404
    assert (
        await client.post(
            f"/api/v1/workouts/{w['id']}/sessions",
            json={"date": today().isoformat()},
            headers=bearer(b),
        )
    ).status_code == 404
    assert (
        await client.put(
            f"/api/v1/workouts/sessions/{s['id']}/exercises/{e['id']}",
            json={"completed": True},
            headers=bearer(b),
        )
    ).status_code == 404
    assert (
        await client.patch(
            f"/api/v1/workouts/sessions/{s['id']}", json={"status": "completed"}, headers=bearer(b)
        )
    ).status_code == 404
    assert (await client.get("/api/v1/workouts/day", headers=bearer(b))).json()["planned"] == 0
