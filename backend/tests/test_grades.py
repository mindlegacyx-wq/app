"""Fase 11: notas por matéria e período, régua configurável, média do ano e quanto preciso tirar."""

from datetime import timedelta
from decimal import Decimal

from httpx import AsyncClient

from app.modules.grades.service import needed_average
from tests.conftest import bearer
from tests.test_routines import onboard, today

YEAR = today().year


def test_needed_average_math() -> None:
    six, ten = Decimal("6"), Decimal("10")
    # Sem notas: precisa da média mínima em todos os períodos
    assert needed_average(3, six, [], ten) == (3, Decimal("6.00"), None, "no_grades")
    # 1º tri 7,5 → precisa de 5,25 nos dois restantes: no caminho
    assert needed_average(3, six, [Decimal("7.5")], ten) == (
        2,
        Decimal("5.25"),
        Decimal("7.50"),
        "on_track",
    )
    # 4,0 e 5,0 → precisa de 9,0 no último: em risco
    assert needed_average(3, six, [Decimal("4"), Decimal("5")], ten) == (
        1,
        Decimal("9.00"),
        Decimal("4.50"),
        "at_risk",
    )
    # 3,0 e 4,0 → precisaria de 11: não fecha sem recuperação
    assert needed_average(3, six, [Decimal("3"), Decimal("4")], ten)[3] == "failing"
    # 9 e 9 → já garantiu (precisa de 0)
    assert needed_average(3, six, [Decimal("9"), Decimal("9")], ten) == (
        1,
        Decimal("0.00"),
        Decimal("9.00"),
        "approved",
    )
    # Ano fechado
    assert needed_average(3, six, [Decimal("6"), Decimal("6"), Decimal("6")], ten) == (
        0,
        None,
        Decimal("6.00"),
        "approved",
    )
    assert needed_average(2, six, [Decimal("5"), Decimal("6.9")], ten)[3] == "closed_failed"


async def _subject(client: AsyncClient, h: dict[str, str], name: str) -> dict:
    r = await client.post("/api/v1/subjects", json={"name": name}, headers=h)
    assert r.status_code == 201, r.text
    return r.json()


async def test_grades_crud_and_summary(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    math = await _subject(client, h, "Matemática")
    await _subject(client, h, "História")

    # Régua padrão: média 6, 3 períodos, nota máxima 10
    s = (await client.get("/api/v1/grades", headers=h)).json()
    assert (s["passing_grade"], s["periods_per_year"], s["grade_max"]) == (6.0, 3, 10.0)
    assert s["year"] == YEAR and s["years"] == [YEAR]
    assert [x["name"] for x in s["subjects"]] == ["Matemática", "História"]
    assert s["subjects"][0]["status"] == "no_grades"
    assert s["subjects"][0]["needed_average"] == 6.0

    # Duas notas no 1º trimestre com pesos → média ponderada 7,00 = (8*2 + 5*1)/3
    r = await client.post(
        "/api/v1/grades",
        json={
            "subject_id": math["id"],
            "year": YEAR,
            "period": 1,
            "title": "Prova",
            "value": "8",
            "weight": "2",
        },
        headers=h,
    )
    assert r.status_code == 201, r.text
    g1 = r.json()
    assert g1["value"] == 8.0 and g1["weight"] == 2.0
    r = await client.post(
        "/api/v1/grades",
        json={"subject_id": math["id"], "year": YEAR, "period": 1, "value": "5"},
        headers=h,
    )
    assert r.status_code == 201
    s = (await client.get("/api/v1/grades", headers=h)).json()
    m = s["subjects"][0]
    assert m["periods"][0]["average"] == 7.0 and m["periods"][1]["average"] is None
    assert m["year_average"] == 7.0 and m["remaining_periods"] == 2
    assert m["needed_average"] == 5.5 and m["status"] == "on_track"

    # 2º trimestre 4,0 → média 5,5; precisa de 7,0 no 3º: em risco
    r = await client.post(
        "/api/v1/grades",
        json={"subject_id": math["id"], "year": YEAR, "period": 2, "value": "4"},
        headers=h,
    )
    g3 = r.json()
    m = (await client.get("/api/v1/grades", headers=h)).json()["subjects"][0]
    assert (m["year_average"], m["needed_average"], m["status"]) == (5.5, 7.0, "at_risk")

    # Editar e excluir
    r = await client.patch(
        f"/api/v1/grades/{g3['id']}", json={"value": "6.5", "title": "Recuperação"}, headers=h
    )
    assert r.status_code == 200 and r.json()["title"] == "Recuperação"
    assert (await client.delete(f"/api/v1/grades/{g1['id']}", headers=h)).status_code == 204
    m = (await client.get("/api/v1/grades", headers=h)).json()["subjects"][0]
    assert m["periods"][0]["average"] == 5.0 and m["periods"][1]["average"] == 6.5

    # Validações: período fora da régua, nota acima do máximo, matéria de outro usuário
    r = await client.post(
        "/api/v1/grades",
        json={"subject_id": math["id"], "year": YEAR, "period": 4, "value": "7"},
        headers=h,
    )
    assert r.status_code == 409
    r = await client.post(
        "/api/v1/grades",
        json={"subject_id": math["id"], "year": YEAR, "period": 3, "value": "11"},
        headers=h,
    )
    assert r.status_code == 409


async def test_grade_settings_and_exam_link(client: AsyncClient) -> None:
    token = await onboard(client)
    h = bearer(token)
    subj = await _subject(client, h, "Física")

    # Escola com 4 bimestres, média 7, escala até 100
    r = await client.patch(
        "/api/v1/users/me/settings",
        json={"passing_grade": "70", "periods_per_year": 4, "grade_max": "100"},
        headers=h,
    )
    assert r.status_code == 200, r.text
    assert r.json()["settings"]["passing_grade"] == 70.0
    r = await client.patch(
        "/api/v1/users/me/settings", json={"passing_grade": "8", "grade_max": "5"}, headers=h
    )
    assert r.status_code == 422

    # Nota ligada a uma prova
    exam = (
        await client.post(
            "/api/v1/exams",
            json={
                "title": "Prova de Física",
                "subject_id": subj["id"],
                "date": (today() + timedelta(days=1)).isoformat(),
            },
            headers=h,
        )
    ).json()
    r = await client.post(
        "/api/v1/grades",
        json={
            "subject_id": subj["id"],
            "exam_id": exam["id"],
            "year": YEAR,
            "period": 1,
            "value": "85",
        },
        headers=h,
    )
    assert r.status_code == 201, r.text
    assert r.json()["exam_id"] == exam["id"]
    s = (await client.get("/api/v1/grades", headers=h)).json()
    assert s["periods_per_year"] == 4 and len(s["subjects"][0]["periods"]) == 4
    # (70*4 − 85) / 3 = 65
    assert s["subjects"][0]["needed_average"] == 65.0
    assert s["subjects"][0]["status"] == "on_track"


async def test_grades_isolated_between_users(client: AsyncClient) -> None:
    a = await onboard(client, email="a@exemplo.com")
    client.cookies.clear()
    b = await onboard(client, email="b@exemplo.com")
    subj = await _subject(client, bearer(a), "Química")
    r = await client.post(
        "/api/v1/grades",
        json={"subject_id": subj["id"], "year": YEAR, "period": 1, "value": "9"},
        headers=bearer(a),
    )
    grade = r.json()
    # B não vê a matéria nem a nota, e não consegue lançar na matéria de A
    assert (await client.get("/api/v1/grades", headers=bearer(b))).json()["subjects"] == []
    assert (
        await client.patch(f"/api/v1/grades/{grade['id']}", json={"value": "1"}, headers=bearer(b))
    ).status_code == 404
    r = await client.post(
        "/api/v1/grades",
        json={"subject_id": subj["id"], "year": YEAR, "period": 1, "value": "1"},
        headers=bearer(b),
    )
    assert r.status_code == 404
