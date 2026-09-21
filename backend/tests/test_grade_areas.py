"""Fase 21: soma de pontos, áreas de conhecimento e modo de lançamento da matéria."""

from decimal import Decimal

from httpx import AsyncClient

from app.modules.grades.models import Grade
from app.modules.grades.service import area_average, over_limit, period_average, period_max_points
from tests.conftest import bearer
from tests.test_routines import onboard

YEAR = 2026


def g(value: str, weight: str = "1", points: str | None = None) -> Grade:
    return Grade(
        value=Decimal(value),
        weight=Decimal(weight),
        max_points=Decimal(points) if points else None,
    )


def test_sum_mode_adds_the_points() -> None:
    # prova valendo 6 (tirou 5,5) + trabalho valendo 4 (tirou 4,0) = 9,5
    assert period_average([g("5.5", points="6"), g("4.0", points="4")], "sum") == Decimal("9.50")


TEN = Decimal("10")


def test_soma_que_passa_do_teto_vira_proporcao() -> None:
    """O caso da Arte: duas atividades valendo 10 cada, numa escola de 0 a 10."""
    arte = [g("10", points="10"), g("10", points="10")]
    assert over_limit(arte, TEN)
    assert period_average(arte, "sum", TEN) == Decimal("10.00")  # e não 20
    assert period_max_points(arte, TEN) == Decimal("10.00")  # "10 de 10"

    # valendo o mesmo, é o "soma e divide pela quantidade": 8 e 6 → 7
    assert period_average([g("8", points="10"), g("6", points="10")], "sum", TEN) == Decimal("7.00")

    # valias diferentes: gabaritou tudo, tem que dar 10 — dividir por 3 daria 6,67
    tudo = [g("6", points="6"), g("4", points="4"), g("10", points="10")]
    assert period_average(tudo, "sum", TEN) == Decimal("10.00")


def test_soma_que_nao_passa_do_teto_continua_soma() -> None:
    # prova vale 6 + trabalho vale 4: fecha 10 certinho, soma normal
    assert period_average([g("5.5", points="6"), g("4", points="4")], "sum", TEN) == Decimal("9.50")
    # nota parcial: 4 de 5 lançados continua 4 (ainda vai ter mais atividade)
    parcial = [g("4", points="5")]
    assert not over_limit(parcial, TEN)
    assert period_average(parcial, "sum", TEN) == Decimal("4.00")
    assert period_max_points(parcial, TEN) == Decimal("5.00")


def test_sem_valia_e_soma_dividida_pela_quantidade() -> None:
    sem_valia = [g("10"), g("9")]
    assert period_average(sem_valia, "sum", TEN) == Decimal("9.50")
    assert period_max_points(sem_valia, TEN) == Decimal("10.00")
    # sem valia e sem passar do teto: soma (não dá para saber que é parcial)
    assert period_average([g("3"), g("4")], "sum", TEN) == Decimal("7.00")
    assert period_max_points([g("3"), g("4")], TEN) is None


def test_weighted_mode_keeps_the_average() -> None:
    # prova 8 peso 2 + trabalho 10 peso 1 = 8,67
    assert period_average([g("8", "2"), g("10", "1")], "weighted") == Decimal("8.67")


def test_area_is_the_mean_of_the_subjects() -> None:
    assert area_average([Decimal("8"), Decimal("6"), Decimal("7")]) == Decimal("7.00")
    assert area_average([]) is None


async def _subject(client: AsyncClient, h: dict[str, str], name: str) -> str:
    r = await client.post("/api/v1/subjects", json={"name": name}, headers=h)
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def _grade(
    client: AsyncClient, h: dict[str, str], subject: str, period: int, value: float, **extra: object
) -> None:
    body = {"subject_id": subject, "year": YEAR, "period": period, "value": value, **extra}
    r = await client.post("/api/v1/grades", json=body, headers=h)
    assert r.status_code == 201, r.text


async def test_sum_mode_end_to_end(client: AsyncClient) -> None:
    h = bearer(await onboard(client))
    await client.patch("/api/v1/users/me/settings", json={"grade_mode": "sum"}, headers=h)
    mat = await _subject(client, h, "Matemática")

    await _grade(client, h, mat, 1, 5.5, title="Prova", max_points=6)
    await _grade(client, h, mat, 1, 4.0, title="Trabalho", max_points=4)

    out = (await client.get(f"/api/v1/grades?year={YEAR}", headers=h)).json()
    assert out["grade_mode"] == "sum"
    subject = out["subjects"][0]
    first = subject["periods"][0]
    assert first["average"] == 9.5
    assert first["max_points"] == 10  # o trimestre valia 10 ao todo


async def test_grade_cannot_pass_the_points_of_the_assessment(client: AsyncClient) -> None:
    h = bearer(await onboard(client))
    mat = await _subject(client, h, "História")
    r = await client.post(
        "/api/v1/grades",
        json={"subject_id": mat, "year": YEAR, "period": 1, "value": 7, "max_points": 6},
        headers=h,
    )
    assert r.status_code == 409 and "pontos" in r.json()["error"]["message"]


async def test_no_area_comes_ready_made(client: AsyncClient) -> None:
    """Cada escola divide as áreas do seu jeito: o app não inventa nenhuma."""
    h = bearer(await onboard(client))
    await client.patch("/api/v1/users/me/settings", json={"grades_by_area": True}, headers=h)
    out = (await client.get(f"/api/v1/grades?year={YEAR}", headers=h)).json()
    assert out["by_area"] is True
    assert out["areas"] == []
    assert (await client.get("/api/v1/grades/areas", headers=h)).json() == []


async def test_new_areas_get_different_colors(client: AsyncClient) -> None:
    h = bearer(await onboard(client))
    cores = []
    for name in ("Linguagens", "Exatas", "Humanas"):
        cores.append(
            (await client.post("/api/v1/grades/areas", json={"name": name}, headers=h)).json()[
                "color"
            ]
        )
    assert len(set(cores)) == 3


async def test_area_average_divides_by_the_subjects_with_grade(client: AsyncClient) -> None:
    h = bearer(await onboard(client))
    await client.patch("/api/v1/users/me/settings", json={"grades_by_area": True}, headers=h)
    linguagens = (
        await client.post("/api/v1/grades/areas", json={"name": "Linguagens"}, headers=h)
    ).json()["id"]

    port = await _subject(client, h, "Português")
    ing = await _subject(client, h, "Inglês")
    arte = await _subject(client, h, "Arte")
    for s in (port, ing, arte):
        r = await client.patch(
            f"/api/v1/grades/subjects/{s}", json={"area_id": linguagens}, headers=h
        )
        assert r.status_code == 200, r.text
        assert r.json()["area_id"] == linguagens

    await _grade(client, h, port, 1, 8)
    await _grade(client, h, ing, 1, 6)

    out = (await client.get(f"/api/v1/grades?year={YEAR}", headers=h)).json()
    area = next(a for a in out["areas"] if a["id"] == linguagens)
    assert len(area["subject_ids"]) == 3
    first = area["periods"][0]
    assert first["average"] == 7  # (8 + 6) / 2, só as lançadas
    assert (first["with_grade"], first["total"]) == (2, 3)

    # a terceira nota entra e a média muda
    await _grade(client, h, arte, 1, 10)
    out = (await client.get(f"/api/v1/grades?year={YEAR}", headers=h)).json()
    first = next(a for a in out["areas"] if a["id"] == linguagens)["periods"][0]
    assert first["average"] == 8 and (first["with_grade"], first["total"]) == (3, 3)


async def test_area_crud_and_isolation(client: AsyncClient) -> None:
    h = bearer(await onboard(client))
    a = (await client.post("/api/v1/grades/areas", json={"name": "Técnico"}, headers=h)).json()
    assert a["name"] == "Técnico"

    r = await client.patch(
        f"/api/v1/grades/areas/{a['id']}",
        json={"name": "Técnico em TI", "color": "#ff0000"},
        headers=h,
    )
    assert r.status_code == 200 and r.json()["name"] == "Técnico em TI"
    assert r.json()["color"] == "#FF0000"

    # a matéria fica, só perde a área
    s = await _subject(client, h, "Redes")
    await client.patch(f"/api/v1/grades/subjects/{s}", json={"area_id": a["id"]}, headers=h)
    assert (await client.delete(f"/api/v1/grades/areas/{a['id']}", headers=h)).status_code == 204
    subjects = (await client.get("/api/v1/subjects", headers=h)).json()
    assert [x["name"] for x in subjects] == ["Redes"]
    assert subjects[0]["area_id"] is None

    other = bearer(await onboard(client, email="outra-area@exemplo.com"))
    b = (await client.post("/api/v1/grades/areas", json={"name": "Minha"}, headers=h)).json()
    assert (
        await client.patch(f"/api/v1/grades/areas/{b['id']}", json={"name": "x"}, headers=other)
    ).status_code == 404


async def test_entry_mode_per_subject(client: AsyncClient) -> None:
    h = bearer(await onboard(client))
    s = await _subject(client, h, "Física")
    out = (await client.get(f"/api/v1/grades?year={YEAR}", headers=h)).json()
    assert out["subjects"][0]["entry_mode"] == "final"

    r = await client.patch(f"/api/v1/grades/subjects/{s}", json={"entry_mode": "items"}, headers=h)
    assert r.status_code == 200 and r.json()["grade_entry_mode"] == "items"
    out = (await client.get(f"/api/v1/grades?year={YEAR}", headers=h)).json()
    assert out["subjects"][0]["entry_mode"] == "items"


async def test_area_recebe_varias_materias_de_uma_vez(client: AsyncClient) -> None:
    """O caminho que substitui arrastar uma por uma: marcar várias e mandar de uma vez."""
    h = bearer(await onboard(client))
    a = (await client.post("/api/v1/grades/areas", json={"name": "Exatas"}, headers=h)).json()
    fis = await _subject(client, h, "Física")
    qui = await _subject(client, h, "Química")
    bio = await _subject(client, h, "Biologia")

    r = await client.put(
        f"/api/v1/grades/areas/{a['id']}/subjects",
        json={"subject_ids": [qui, fis, bio]},
        headers=h,
    )
    assert r.status_code == 200

    out = (await client.get(f"/api/v1/grades?year={YEAR}", headers=h)).json()
    assert out["areas"][0]["subject_ids"] == [qui, fis, bio]  # a ordem pedida é a ordem guardada
    assert [s["name"] for s in out["subjects"]] == ["Química", "Física", "Biologia"]

    # mandar a lista sem a Biologia tira ela da área — e a matéria continua existindo
    await client.put(
        f"/api/v1/grades/areas/{a['id']}/subjects", json={"subject_ids": [fis, qui]}, headers=h
    )
    out = (await client.get(f"/api/v1/grades?year={YEAR}", headers=h)).json()
    assert out["areas"][0]["subject_ids"] == [fis, qui]
    solta = next(s for s in out["subjects"] if s["name"] == "Biologia")
    assert solta["area_id"] is None


async def test_ordem_das_areas(client: AsyncClient) -> None:
    h = bearer(await onboard(client))
    ids = [
        (await client.post("/api/v1/grades/areas", json={"name": n}, headers=h)).json()["id"]
        for n in ("Linguagens", "Exatas", "Humanas")
    ]
    r = await client.put(
        "/api/v1/grades/areas/order", json={"area_ids": [ids[2], ids[0], ids[1]]}, headers=h
    )
    assert r.status_code == 200
    assert [a["name"] for a in r.json()] == ["Humanas", "Linguagens", "Exatas"]

    out = (await client.get(f"/api/v1/grades?year={YEAR}", headers=h)).json()
    assert [a["name"] for a in out["areas"]] == ["Humanas", "Linguagens", "Exatas"]

    # lista incompleta não passa: sinal de tela desatualizada
    r = await client.put("/api/v1/grades/areas/order", json={"area_ids": [ids[0]]}, headers=h)
    assert r.status_code == 409


async def test_ordem_das_materias_segue_a_ordem_das_areas(client: AsyncClient) -> None:
    """Arrastar em Notas também arruma a lista de matérias em Estudos."""
    h = bearer(await onboard(client))
    linguagens = (
        await client.post("/api/v1/grades/areas", json={"name": "Linguagens"}, headers=h)
    ).json()["id"]
    exatas = (await client.post("/api/v1/grades/areas", json={"name": "Exatas"}, headers=h)).json()[
        "id"
    ]
    port = await _subject(client, h, "Português")
    mat = await _subject(client, h, "Matemática")
    livre = await _subject(client, h, "Eletiva")

    await client.put(
        f"/api/v1/grades/areas/{linguagens}/subjects", json={"subject_ids": [port]}, headers=h
    )
    await client.put(
        f"/api/v1/grades/areas/{exatas}/subjects", json={"subject_ids": [mat]}, headers=h
    )
    subjects = (await client.get("/api/v1/subjects", headers=h)).json()
    assert [s["name"] for s in subjects] == ["Português", "Matemática", "Eletiva"]

    await client.put(
        "/api/v1/grades/areas/order", json={"area_ids": [exatas, linguagens]}, headers=h
    )
    subjects = (await client.get("/api/v1/subjects", headers=h)).json()
    assert [s["name"] for s in subjects] == ["Matemática", "Português", "Eletiva"]
    assert livre in [s["id"] for s in subjects]


async def test_arte_com_duas_atividades_de_dez(client: AsyncClient) -> None:
    """Ponta a ponta: o resumo mostra 10 de 10, sinaliza a conversão e a área usa 10."""
    h = bearer(await onboard(client))
    await client.patch("/api/v1/users/me/settings", json={"grade_mode": "sum"}, headers=h)
    area = (
        await client.post("/api/v1/grades/areas", json={"name": "Linguagens"}, headers=h)
    ).json()
    arte = await _subject(client, h, "Arte")
    await client.put(
        f"/api/v1/grades/areas/{area['id']}/subjects", json={"subject_ids": [arte]}, headers=h
    )
    for titulo in ("Planta Baixa", "Projeto de criação Tinkercad"):
        r = await client.post(
            "/api/v1/grades",
            json={
                "subject_id": arte,
                "year": YEAR,
                "period": 1,
                "title": titulo,
                "value": 10,
                "max_points": 10,
            },
            headers=h,
        )
        assert r.status_code == 201

    out = (await client.get(f"/api/v1/grades?year={YEAR}", headers=h)).json()
    p1 = out["subjects"][0]["periods"][0]
    assert p1["average"] == 10 and p1["max_points"] == 10 and p1["over_limit"] is True
    assert [x["title"] for x in p1["grades"]] == ["Planta Baixa", "Projeto de criação Tinkercad"]
    assert out["areas"][0]["periods"][0]["average"] == 10
    assert out["areas"][0]["year_average"] == 10
