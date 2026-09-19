"""Fase 10: provas/trabalhos, conteúdos, sessões de estudo automáticas e percentual."""

from datetime import timedelta

from httpx import AsyncClient

from tests.conftest import bearer
from tests.test_routines import onboard, today


async def _exam(client: AsyncClient, h: dict[str, str], **over: object) -> dict:
    body: dict[str, object] = {
        "title": "Prova de Matemática",
        "kind": "exam",
        "date": (today() + timedelta(days=5)).isoformat(),
        "lead_days": 7,
        "minutes_per_day": 30,
        "topics": ["Frações", "Equações de 1º grau"],
    }
    body.update(over)
    r = await client.post("/api/v1/exams", json=body, headers=h)
    assert r.status_code == 201, r.text
    return r.json()


async def test_exam_crud_topics_and_window(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    r = await client.post("/api/v1/subjects", json={"name": "Matemática"}, headers=h)
    subject = r.json()
    exam = await _exam(client, h, subject_id=subject["id"])
    assert exam["subject_name"] == "Matemática" and exam["days_until"] == 5
    # Janela começa hoje (cadastro), não 7 dias antes: 5 sessões até a véspera
    assert exam["study_from"] == today().isoformat()
    assert exam["sessions_total"] == 5 and exam["sessions_done"] == 0
    assert [t["title"] for t in exam["topics"]] == ["Frações", "Equações de 1º grau"]
    assert len(exam["sessions"]) == 5 and exam["sessions"][0]["status"] is None

    # Conteúdos: adicionar, marcar, excluir
    r = await client.post(
        f"/api/v1/exams/{exam['id']}/topics", json={"title": "Potências"}, headers=h
    )
    assert r.status_code == 201 and r.json()["sort_order"] == 2
    topic = exam["topics"][0]
    r = await client.patch(
        f"/api/v1/exams/{exam['id']}/topics/{topic['id']}", json={"is_done": True}, headers=h
    )
    assert r.status_code == 200 and r.json()["is_done"] is True
    detail = (await client.get(f"/api/v1/exams/{exam['id']}", headers=h)).json()
    assert detail["topics_total"] == 3 and detail["topics_done"] == 1
    r = await client.delete(f"/api/v1/exams/{exam['id']}/topics/{topic['id']}", headers=h)
    assert r.status_code == 204

    # Editar: adiar a prova aumenta a janela; marcar feita para de cobrar
    r = await client.patch(
        f"/api/v1/exams/{exam['id']}",
        json={"date": (today() + timedelta(days=10)).isoformat(), "minutes_per_day": 45},
        headers=h,
    )
    assert r.status_code == 200 and r.json()["sessions_total"] == 7  # lead_days = 7
    assert r.json()["study_from"] == (today() + timedelta(days=3)).isoformat()
    r = await client.patch(f"/api/v1/exams/{exam['id']}", json={"status": "done"}, headers=h)
    assert r.json()["status"] == "done" and r.json()["done_at"] is not None
    assert (await client.get("/api/v1/exams", headers=h)).json() == []
    assert len((await client.get("/api/v1/exams?include_past=true", headers=h)).json()) == 1

    # Validações
    r = await client.post(
        "/api/v1/exams",
        json={"title": "X", "date": today().isoformat(), "lead_days": 0},
        headers=h,
    )
    assert r.status_code == 422


async def test_study_day_sessions_and_score(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    exam = await _exam(client, h)
    # Trabalho que só começa a cobrar daqui a 3 dias: hoje não aparece
    await _exam(
        client,
        h,
        title="Trabalho de História",
        kind="assignment",
        date=(today() + timedelta(days=5)).isoformat(),
        lead_days=2,
    )

    day = (await client.get("/api/v1/study/day", headers=h)).json()
    assert day["date"] == today().isoformat()
    assert [s["exam_title"] for s in day["sessions"]] == ["Prova de Matemática"]
    s0 = day["sessions"][0]
    assert s0["id"] is None and s0["status"] is None and s0["planned_minutes"] == 30
    # Sem agenda, o dia inteiro (06:00–23:00) é buraco: a sugestão existe
    assert s0["suggested_start"] is not None
    assert day["planned"] == 1 and day["completed"] == 0

    # Entra no percentual do dia
    score = (await client.get("/api/v1/progress/day", headers=h)).json()
    assert score["breakdown"]["study"] == {"planned": 1, "completed": 0}
    assert {"kind": "study", "title": "Estudar: Prova de Matemática"} in score["missing"]

    # Começar → em andamento; concluir com o tempo focado
    r = await client.post("/api/v1/study/sessions", json={"exam_id": exam["id"]}, headers=h)
    assert r.status_code == 200, r.text
    started = r.json()
    assert started["id"] and started["status"] == "in_progress" and started["started_at"]
    r = await client.post("/api/v1/study/sessions", json={"exam_id": exam["id"]}, headers=h)
    assert r.json()["id"] == started["id"]  # idempotente
    r = await client.patch(
        f"/api/v1/study/sessions/{started['id']}",
        json={"status": "completed", "focused_seconds": 1500},
        headers=h,
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "completed" and r.json()["focused_seconds"] == 1500
    score = (await client.get("/api/v1/progress/day", headers=h)).json()
    assert score["breakdown"]["study"] == {"planned": 1, "completed": 1}

    # Detalhe da prova reflete a sessão concluída
    detail = (await client.get(f"/api/v1/exams/{exam['id']}", headers=h)).json()
    assert detail["sessions_done"] == 1
    assert detail["sessions"][0]["status"] == "completed"

    # Amanhã as duas cobram (sem registro ainda); a sugestão de horário não repete o mesmo buraco
    tomorrow = (today() + timedelta(days=3)).isoformat()
    day = (await client.get(f"/api/v1/study/day?date={tomorrow}", headers=h)).json()
    assert [s["exam_title"] for s in day["sessions"]] == [
        "Prova de Matemática",
        "Trabalho de História",
    ]
    a, b = day["sessions"]
    assert a["suggested_start"] != b["suggested_start"]
    assert day["total_minutes"] == 60

    # Prova feita some do dia; sessão concluída de uma prova feita continua no histórico
    await client.patch(f"/api/v1/exams/{exam['id']}", json={"status": "done"}, headers=h)
    day = (await client.get(f"/api/v1/study/day?date={tomorrow}", headers=h)).json()
    assert [s["exam_title"] for s in day["sessions"]] == ["Trabalho de História"]
    r = await client.post("/api/v1/study/sessions", json={"exam_id": exam["id"]}, headers=h)
    assert r.status_code == 409


async def test_session_slots_fit_agenda_free_windows(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    on = today() + timedelta(days=1)
    wd = on.weekday()
    for title, start, end in (("Aulas", "07:00", "12:00"), ("Curso", "13:00", "18:00")):
        r = await client.post(
            "/api/v1/schedule/blocks",
            json={"title": title, "weekdays": [wd], "start_time": start, "end_time": end},
            headers=h,
        )
        assert r.status_code == 201
    exam = await _exam(client, h, minutes_per_day=60)
    day = (await client.get(f"/api/v1/study/day?date={on.isoformat()}", headers=h)).json()
    s = day["sessions"][0]
    assert s["exam_id"] == exam["id"]
    # Maior buraco do dia é 18:00–23:00 → a sessão de 60 min é sugerida às 18:00
    assert (s["suggested_start"], s["suggested_end"]) == ("18:00:00", "19:00:00")


async def test_skip_and_closed_day_rules(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    exam = await _exam(client, h)
    r = await client.post("/api/v1/study/sessions", json={"exam_id": exam["id"]}, headers=h)
    sid = r.json()["id"]
    r = await client.patch(f"/api/v1/study/sessions/{sid}", json={"status": "skipped"}, headers=h)
    assert r.status_code == 200 and r.json()["status"] == "skipped"
    score = (await client.get("/api/v1/progress/day", headers=h)).json()
    # Pulado continua planejado e não feito (mesma regra do treino)
    assert score["breakdown"]["study"] == {"planned": 1, "completed": 0}
    assert {"kind": "study", "title": "Estudar: Prova de Matemática (pulado)"} in score["missing"]

    # Não dá para registrar num dia futuro nem num dia já fechado
    future = (today() + timedelta(days=2)).isoformat()
    r = await client.post(
        "/api/v1/study/sessions", json={"exam_id": exam["id"], "date": future}, headers=h
    )
    assert r.status_code == 400
    past = (today() - timedelta(days=3)).isoformat()
    r = await client.post(
        "/api/v1/study/sessions", json={"exam_id": exam["id"], "date": past}, headers=h
    )
    assert r.status_code == 400


async def test_exams_isolated_and_trash(client: AsyncClient) -> None:
    a = await onboard(client, email="a@exemplo.com")
    client.cookies.clear()
    b = await onboard(client, email="b@exemplo.com")
    exam = await _exam(client, bearer(a))
    assert (await client.get("/api/v1/exams", headers=bearer(b))).json() == []
    assert (await client.get(f"/api/v1/exams/{exam['id']}", headers=bearer(b))).status_code == 404
    r = await client.post("/api/v1/study/sessions", json={"exam_id": exam["id"]}, headers=bearer(b))
    assert r.status_code == 404

    # Excluir → lixeira → restaurar
    assert (
        await client.delete(f"/api/v1/exams/{exam['id']}", headers=bearer(a))
    ).status_code == 204
    assert (await client.get("/api/v1/study/day", headers=bearer(a))).json()["planned"] == 0
    trash = (await client.get("/api/v1/trash", headers=bearer(a))).json()["items"]
    assert [(i["kind"], i["title"]) for i in trash] == [("exam", "Prova de Matemática")]
    assert trash[0]["subtitle"].startswith("Prova · ")
    r = await client.post(
        "/api/v1/trash/restore", json={"kind": "exam", "id": exam["id"]}, headers=bearer(a)
    )
    assert r.status_code == 200
    assert (await client.get("/api/v1/study/day", headers=bearer(a))).json()["planned"] == 1
