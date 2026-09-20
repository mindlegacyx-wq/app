"""Fase 16: carga por série, progressão, biblioteca e peso corporal."""

from datetime import timedelta

from httpx import AsyncClient

from app.modules.workouts import service as workouts_service
from app.modules.workouts.library import BY_KEY, CATALOG
from tests.conftest import bearer
from tests.test_routines import onboard, today


def test_library_is_coherent() -> None:
    assert len(BY_KEY) == len(CATALOG)
    assert all(e.load_mode in {"total", "per_side", "bodyweight"} for e in CATALOG)
    # Barra tem peso de barra; o resto não
    for e in CATALOG:
        if e.load_mode == "per_side":
            assert e.bar_weight > 0, e.key
        else:
            assert e.bar_weight == 0, e.key


def test_reps_top_reads_the_range() -> None:
    assert workouts_service.reps_top("12") == 12
    assert workouts_service.reps_top("8-10") == 10
    assert workouts_service.reps_top("8 a 12") == 12
    assert workouts_service.reps_top("30s") is None  # tempo não é repetição
    assert workouts_service.reps_top(None) is None


async def _plan(client: AsyncClient, h: dict[str, str], library_key: str = "supino_reto") -> dict:
    w = (
        await client.post(
            "/api/v1/workouts",
            json={"name": "Peito", "days_of_week": [0, 1, 2, 3, 4, 5, 6]},
            headers=h,
        )
    ).json()
    e = (
        await client.post(
            f"/api/v1/workouts/{w['id']}/exercises",
            json={"name": "Supino reto", "sets": 3, "reps": "8-10", "library_key": library_key},
            headers=h,
        )
    ).json()
    return {"workout": w, "exercise": e}


async def test_library_endpoint_groups_by_muscle(client: AsyncClient) -> None:
    token = await onboard(client)
    r = await client.get("/api/v1/workouts/library", headers=bearer(token))
    assert r.status_code == 200, r.text
    groups = r.json()["groups"]
    assert {g["muscle"] for g in groups} >= {"chest", "back", "legs"}
    chest = next(g for g in groups if g["muscle"] == "chest")
    supino = next(e for e in chest["exercises"] if e["key"] == "supino_reto")
    assert supino["load_mode"] == "per_side" and supino["bar_weight"] == 20


async def test_exercise_inherits_library_preset(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    plan = await _plan(client, h)
    e = plan["exercise"]
    assert e["load_mode"] == "per_side"
    assert e["bar_weight"] == 20 and e["increment"] == 5  # 2,5 de cada lado
    assert e["muscle"] == "chest" and e["icon"] == "barbell"
    assert e["rest_seconds"] == 120  # descanso sugerido da biblioteca


async def test_session_prefills_sets_and_tracks_volume(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    plan = await _plan(client, h)
    day = today().isoformat()
    session = (
        await client.post(
            f"/api/v1/workouts/{plan['workout']['id']}/sessions", json={"date": day}, headers=h
        )
    ).json()

    r = await client.get(f"/api/v1/workouts/sessions/{session['id']}", headers=h)
    assert r.status_code == 200, r.text
    detail = r.json()
    assert detail["planned_sets"] == 3 and detail["done_sets"] == 0
    item = detail["exercises"][0]
    assert [s["set_number"] for s in item["sets"]] == [1, 2, 3]
    # Sem histórico: sem peso sugerido, mas as reps vêm do alvo
    assert item["progress"]["last_date"] is None
    assert item["sets"][0]["weight"] is None and item["sets"][0]["reps"] == 10

    # Registrar 60 kg × 10 nas três séries
    for s in item["sets"]:
        r = await client.patch(
            f"/api/v1/workouts/sets/{s['id']}",
            json={"weight": 60, "reps": 10, "done": True},
            headers=h,
        )
        assert r.status_code == 200, r.text
    detail = (await client.get(f"/api/v1/workouts/sessions/{session['id']}", headers=h)).json()
    assert detail["done_sets"] == 3
    assert detail["total_volume"] == 1800  # 60 × 10 × 3

    # Série extra entra no fim
    r = await client.post(
        f"/api/v1/workouts/sessions/{session['id']}/sets",
        json={"exercise_id": plan["exercise"]["id"], "weight": 50, "reps": 12},
        headers=h,
    )
    assert r.status_code == 201 and r.json()["set_number"] == 4
    r = await client.delete(f"/api/v1/workouts/sets/{r.json()['id']}", headers=h)
    assert r.status_code == 204


async def test_next_session_suggests_more_weight_when_you_closed_the_range(
    client: AsyncClient, db_session
) -> None:
    from sqlalchemy import text

    token = await onboard(client)
    h = bearer(token)
    plan = await _plan(client, h)
    day = today()
    session = (
        await client.post(
            f"/api/v1/workouts/{plan['workout']['id']}/sessions",
            json={"date": day.isoformat()},
            headers=h,
        )
    ).json()
    detail = (await client.get(f"/api/v1/workouts/sessions/{session['id']}", headers=h)).json()
    for s in detail["exercises"][0]["sets"]:
        await client.patch(
            f"/api/v1/workouts/sets/{s['id']}",
            json={"weight": 60, "reps": 10, "done": True},  # fechou o topo (8-10)
            headers=h,
        )
    # Empurra a sessão para ontem, para "hoje" ser um treino novo
    await db_session.execute(
        text("UPDATE workout_sessions SET date = :d WHERE id = CAST(:i AS uuid)").bindparams(
            d=day - timedelta(days=1), i=session["id"]
        )
    )
    await db_session.flush()

    new_session = (
        await client.post(
            f"/api/v1/workouts/{plan['workout']['id']}/sessions",
            json={"date": day.isoformat()},
            headers=h,
        )
    ).json()
    detail = (await client.get(f"/api/v1/workouts/sessions/{new_session['id']}", headers=h)).json()
    progress = detail["exercises"][0]["progress"]
    assert progress["last_date"] == (day - timedelta(days=1)).isoformat()
    assert progress["best_weight"] == 60
    assert progress["should_increase"] is True
    assert progress["suggested_weight"] == 65  # 60 + uma anilha de 2,5 de cada lado
    assert detail["exercises"][0]["sets"][0]["weight"] == 65  # já vem preenchido

    # Histórico do exercício alimenta o gráfico
    r = await client.get(f"/api/v1/workouts/exercises/{plan['exercise']['id']}/history", headers=h)
    assert r.status_code == 200
    points = r.json()["points"]
    assert len(points) == 1 and points[0]["best_weight"] == 60 and points[0]["total_volume"] == 1800


async def test_no_suggestion_when_you_did_not_close_the_range(
    client: AsyncClient, db_session
) -> None:
    from sqlalchemy import text

    token = await onboard(client)
    h = bearer(token)
    plan = await _plan(client, h)
    day = today()
    session = (
        await client.post(
            f"/api/v1/workouts/{plan['workout']['id']}/sessions",
            json={"date": day.isoformat()},
            headers=h,
        )
    ).json()
    detail = (await client.get(f"/api/v1/workouts/sessions/{session['id']}", headers=h)).json()
    for i, s in enumerate(detail["exercises"][0]["sets"]):
        await client.patch(
            f"/api/v1/workouts/sets/{s['id']}",
            json={"weight": 60, "reps": 10 if i == 0 else 7, "done": True},
            headers=h,
        )
    await db_session.execute(
        text("UPDATE workout_sessions SET date = :d WHERE id = CAST(:i AS uuid)").bindparams(
            d=day - timedelta(days=1), i=session["id"]
        )
    )
    await db_session.flush()
    new_session = (
        await client.post(
            f"/api/v1/workouts/{plan['workout']['id']}/sessions",
            json={"date": day.isoformat()},
            headers=h,
        )
    ).json()
    progress = (
        await client.get(f"/api/v1/workouts/sessions/{new_session['id']}", headers=h)
    ).json()["exercises"][0]["progress"]
    assert progress["should_increase"] is False
    assert progress["suggested_weight"] == 60  # repete a carga até fechar o número


async def test_body_weight_records_and_change(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    day = today()
    r = await client.post("/api/v1/workouts/body-weight", json={"weight": 82.5}, headers=h)
    assert r.status_code == 201 and r.json()["weight"] == 82.5
    # Mesmo dia duas vezes: atualiza, não duplica
    await client.post("/api/v1/workouts/body-weight", json={"weight": 82.1}, headers=h)
    r = await client.post(
        "/api/v1/workouts/body-weight",
        json={"weight": 85, "date": (day - timedelta(days=40)).isoformat()},
        headers=h,
    )
    assert r.status_code == 201

    data = (await client.get("/api/v1/workouts/body-weight", headers=h)).json()
    assert [e["weight"] for e in data["entries"]] == [85, 82.1]
    assert data["latest"] == 82.1
    assert data["change_30d"] == -2.9  # perdeu 2,9 kg em relação a 40 dias atrás

    assert (
        await client.delete(f"/api/v1/workouts/body-weight/{day.isoformat()}", headers=h)
    ).status_code == 204
    assert (await client.get("/api/v1/workouts/body-weight", headers=h)).json()["latest"] == 85


async def test_sets_are_private(client: AsyncClient) -> None:
    a = await onboard(client, email="a@exemplo.com")
    client.cookies.clear()
    b = await onboard(client, email="b@exemplo.com")
    plan = await _plan(client, bearer(a))
    session = (
        await client.post(
            f"/api/v1/workouts/{plan['workout']['id']}/sessions",
            json={"date": today().isoformat()},
            headers=bearer(a),
        )
    ).json()
    assert (
        await client.get(f"/api/v1/workouts/sessions/{session['id']}", headers=bearer(b))
    ).status_code == 404
    assert (await client.get("/api/v1/workouts/body-weight", headers=bearer(b))).json()[
        "entries"
    ] == []


async def test_finishing_all_sets_marks_the_exercise_in_the_day(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    plan = await _plan(client, h)
    day = today().isoformat()
    session = (
        await client.post(
            f"/api/v1/workouts/{plan['workout']['id']}/sessions", json={"date": day}, headers=h
        )
    ).json()
    detail = (await client.get(f"/api/v1/workouts/sessions/{session['id']}", headers=h)).json()
    sets = detail["exercises"][0]["sets"]

    # Só a primeira série: o exercício ainda não conta como feito
    await client.patch(
        f"/api/v1/workouts/sets/{sets[0]['id']}",
        json={"weight": 60, "reps": 10, "done": True},
        headers=h,
    )
    day_view = (await client.get(f"/api/v1/workouts/day?date={day}", headers=h)).json()
    assert day_view["workouts"][0]["exercises"][0]["completed"] is False

    for s in sets[1:]:
        await client.patch(
            f"/api/v1/workouts/sets/{s['id']}",
            json={"weight": 60, "reps": 10, "done": True},
            headers=h,
        )
    day_view = (await client.get(f"/api/v1/workouts/day?date={day}", headers=h)).json()
    assert day_view["workouts"][0]["exercises"][0]["completed"] is True

    # Desmarcar uma série volta atrás
    await client.patch(f"/api/v1/workouts/sets/{sets[0]['id']}", json={"done": False}, headers=h)
    day_view = (await client.get(f"/api/v1/workouts/day?date={day}", headers=h)).json()
    assert day_view["workouts"][0]["exercises"][0]["completed"] is False
