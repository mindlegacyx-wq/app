"""Fase 9: matérias e agenda semanal (blocos por dia/hora, conflitos, cópia, janelas livres)."""

from httpx import AsyncClient

from tests.conftest import bearer
from tests.test_routines import onboard, today


async def _subject(
    client: AsyncClient, h: dict[str, str], name: str, color: str = "#5AC8FA"
) -> dict:
    r = await client.post("/api/v1/subjects", json={"name": name, "color": color}, headers=h)
    assert r.status_code == 201, r.text
    return r.json()


async def test_subjects_crud(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    assert (await client.get("/api/v1/subjects", headers=h)).json() == []
    math = await _subject(client, h, "Matemática")
    r = await client.post("/api/v1/subjects", json={"name": "Física", "color": "azul"}, headers=h)
    assert r.status_code == 422
    r = await client.patch(
        f"/api/v1/subjects/{math['id']}",
        json={"teacher": "Prof. Ana", "color": "#FF9F43"},
        headers=h,
    )
    assert r.status_code == 200 and r.json()["teacher"] == "Prof. Ana"
    r = await client.patch(
        f"/api/v1/subjects/{math['id']}", json={"clear_teacher": True}, headers=h
    )
    assert r.json()["teacher"] is None
    assert (await client.delete(f"/api/v1/subjects/{math['id']}", headers=h)).status_code == 204
    assert (await client.get("/api/v1/subjects", headers=h)).json() == []


async def test_blocks_create_in_many_days_and_week_view(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    math = await _subject(client, h, "Matemática")
    r = await client.post(
        "/api/v1/schedule/blocks",
        json={
            "title": "Matemática",
            "kind": "class",
            "subject_id": math["id"],
            "weekdays": [0, 2, 4],
            "start_time": "07:30",
            "end_time": "08:15:30",
            "location": "Sala 12",
        },
        headers=h,
    )
    assert r.status_code == 201, r.text
    created = r.json()
    assert [b["weekday"] for b in created] == [0, 2, 4]
    assert created[0]["end_time"] == "08:15:00" and created[0]["duration_minutes"] == 45
    assert created[0]["subject_name"] == "Matemática" and created[0]["subject_color"] == "#5AC8FA"

    week = (await client.get("/api/v1/schedule", headers=h)).json()
    assert len(week["days"]) == 7
    assert week["days"][0]["total_minutes"] == 45 and week["days"][1]["total_minutes"] == 0
    assert [s["name"] for s in week["subjects"]] == ["Matemática"]

    # Validação: fim antes do início; dia inválido
    r = await client.post(
        "/api/v1/schedule/blocks",
        json={"title": "X", "weekdays": [0], "start_time": "09:00", "end_time": "08:00"},
        headers=h,
    )
    assert r.status_code == 422
    r = await client.post(
        "/api/v1/schedule/blocks",
        json={"title": "X", "weekdays": [7], "start_time": "09:00", "end_time": "10:00"},
        headers=h,
    )
    assert r.status_code == 422


async def test_blocks_reject_overlap_and_allow_adjacent(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    await client.post(
        "/api/v1/schedule/blocks",
        json={"title": "Aula 1", "weekdays": [0], "start_time": "07:30", "end_time": "08:15"},
        headers=h,
    )
    # Encostado é permitido
    r = await client.post(
        "/api/v1/schedule/blocks",
        json={"title": "Aula 2", "weekdays": [0], "start_time": "08:15", "end_time": "09:00"},
        headers=h,
    )
    assert r.status_code == 201
    # Sobreposto é recusado, e nada é criado em nenhum dos dias pedidos
    r = await client.post(
        "/api/v1/schedule/blocks",
        json={"title": "Curso", "weekdays": [0, 1], "start_time": "08:00", "end_time": "12:00"},
        headers=h,
    )
    assert r.status_code == 409
    assert "Aula 1" in r.json()["error"]["message"]
    week = (await client.get("/api/v1/schedule", headers=h)).json()
    assert len(week["days"][0]["blocks"]) == 2 and week["days"][1]["blocks"] == []

    # Editar horário para cima de outro bloco → conflito; pausar o bloco libera o horário
    b2 = week["days"][0]["blocks"][1]
    r = await client.patch(
        f"/api/v1/schedule/blocks/{b2['id']}", json={"start_time": "08:00"}, headers=h
    )
    assert r.status_code == 409
    r = await client.patch(
        f"/api/v1/schedule/blocks/{b2['id']}", json={"is_active": False}, headers=h
    )
    assert r.status_code == 200 and r.json()["is_active"] is False
    r = await client.post(
        "/api/v1/schedule/blocks",
        json={"title": "Reforço", "weekdays": [0], "start_time": "08:15", "end_time": "09:00"},
        headers=h,
    )
    assert r.status_code == 201


async def test_day_view_free_windows_and_workout_block(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    wd = today().weekday()
    workout = (
        await client.post(
            "/api/v1/workouts",
            json={"name": "Treino A", "days_of_week": [wd]},
            headers=h,
        )
    ).json()
    for title, start, end in (
        ("Aula 1", "07:30", "08:15"),
        ("Aula 2", "08:15", "09:00"),
        ("Curso", "13:00", "17:30"),
    ):
        r = await client.post(
            "/api/v1/schedule/blocks",
            json={"title": title, "weekdays": [wd], "start_time": start, "end_time": end},
            headers=h,
        )
        assert r.status_code == 201, r.text
    r = await client.post(
        "/api/v1/schedule/blocks",
        json={
            "title": "Treino",
            "kind": "workout",
            "workout_id": workout["id"],
            "weekdays": [wd],
            "start_time": "18:15",
            "end_time": "19:15",
        },
        headers=h,
    )
    assert r.status_code == 201, r.text

    day = (await client.get("/api/v1/schedule/day", headers=h)).json()
    assert day["date"] == today().isoformat() and day["weekday"] == wd
    assert [b["title"] for b in day["blocks"]] == ["Aula 1", "Aula 2", "Curso", "Treino"]
    assert day["blocks"][3]["workout_id"] == workout["id"]
    # Janelas livres dentro de 06:00–23:00, ignorando buracos menores que 20 min
    assert [(w["start"], w["end"]) for w in day["free"]] == [
        ("06:00:00", "07:30:00"),
        ("09:00:00", "13:00:00"),
        ("17:30:00", "18:15:00"),
        ("19:15:00", "23:00:00"),
    ]

    # Treino inexistente ou de outro usuário → 404
    r = await client.post(
        "/api/v1/schedule/blocks",
        json={
            "title": "Treino B",
            "kind": "workout",
            "workout_id": "00000000-0000-0000-0000-000000000000",
            "weekdays": [wd],
            "start_time": "20:00",
            "end_time": "21:00",
        },
        headers=h,
    )
    assert r.status_code == 404


async def test_workout_block_adds_day_to_plan(client: AsyncClient) -> None:
    """Marcar um treino na agenda num dia fora do plano acrescenta o dia ao plano."""
    token = await onboard(client)
    h = bearer(token)
    workout = (
        await client.post(
            "/api/v1/workouts", json={"name": "Treino A", "days_of_week": [0, 2]}, headers=h
        )
    ).json()
    r = await client.post(
        "/api/v1/schedule/blocks",
        json={
            "title": "Treino",
            "kind": "workout",
            "workout_id": workout["id"],
            "weekdays": [0, 5],
            "start_time": "18:15",
            "end_time": "19:15",
        },
        headers=h,
    )
    assert r.status_code == 201, r.text
    w = (await client.get(f"/api/v1/workouts/{workout['id']}", headers=h)).json()
    assert w["days_of_week"] == [0, 2, 5]
    # Mover o bloco de sábado para domingo acrescenta domingo (o plano não perde dias sozinho)
    sat = next(b for b in r.json() if b["weekday"] == 5)
    r = await client.patch(f"/api/v1/schedule/blocks/{sat['id']}", json={"weekday": 6}, headers=h)
    assert r.status_code == 200
    w = (await client.get(f"/api/v1/workouts/{workout['id']}", headers=h)).json()
    assert w["days_of_week"] == [0, 2, 5, 6]


async def test_copy_day_skips_conflicts(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    for title, start, end in (("Aula 1", "07:30", "08:15"), ("Aula 2", "08:15", "09:00")):
        await client.post(
            "/api/v1/schedule/blocks",
            json={"title": title, "weekdays": [0], "start_time": start, "end_time": end},
            headers=h,
        )
    # Terça já tem algo às 08:00 → um dos dois conflita
    await client.post(
        "/api/v1/schedule/blocks",
        json={"title": "Ocupado", "weekdays": [1], "start_time": "08:00", "end_time": "08:30"},
        headers=h,
    )
    r = await client.post(
        "/api/v1/schedule/days/0/copy", json={"to_weekdays": [1, 2, 0]}, headers=h
    )
    assert r.status_code == 200, r.text
    assert r.json() == {"created": 2, "skipped": 2}
    week = (await client.get("/api/v1/schedule", headers=h)).json()
    assert [b["title"] for b in week["days"][2]["blocks"]] == ["Aula 1", "Aula 2"]
    assert [b["title"] for b in week["days"][1]["blocks"]] == ["Ocupado"]
    assert (
        await client.post("/api/v1/schedule/days/9/copy", json={"to_weekdays": [1]}, headers=h)
    ).status_code == 422


async def test_schedule_is_isolated_and_goes_to_trash(client: AsyncClient) -> None:
    a = await onboard(client, email="a@exemplo.com")
    client.cookies.clear()
    b = await onboard(client, email="b@exemplo.com")
    subj = await _subject(client, bearer(a), "Química")
    block = (
        await client.post(
            "/api/v1/schedule/blocks",
            json={
                "title": "Química",
                "subject_id": subj["id"],
                "weekdays": [3],
                "start_time": "10:00",
                "end_time": "10:45",
            },
            headers=bearer(a),
        )
    ).json()[0]
    # B não vê nem edita
    assert (await client.get("/api/v1/schedule", headers=bearer(b))).json()["days"][3][
        "blocks"
    ] == []
    assert (
        await client.patch(
            f"/api/v1/schedule/blocks/{block['id']}", json={"title": "x"}, headers=bearer(b)
        )
    ).status_code == 404
    # B não consegue usar a matéria de A
    r = await client.post(
        "/api/v1/schedule/blocks",
        json={
            "title": "Q",
            "subject_id": subj["id"],
            "weekdays": [3],
            "start_time": "10:00",
            "end_time": "10:45",
        },
        headers=bearer(b),
    )
    assert r.status_code == 404
    # Excluir vai para a lixeira e pode ser restaurado
    await client.delete(f"/api/v1/schedule/blocks/{block['id']}", headers=bearer(a))
    trash = (await client.get("/api/v1/trash", headers=bearer(a))).json()["items"]
    assert [(i["kind"], i["title"]) for i in trash] == [("schedule_block", "Química")]
    assert trash[0]["subtitle"] == "qui 10:00–10:45"
    r = await client.post(
        "/api/v1/trash/restore",
        json={"kind": "schedule_block", "id": block["id"]},
        headers=bearer(a),
    )
    assert r.status_code == 200
    assert (
        len((await client.get("/api/v1/schedule", headers=bearer(a))).json()["days"][3]["blocks"])
        == 1
    )
