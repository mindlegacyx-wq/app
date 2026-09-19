"""Fase 12: transcrição de fotos, materiais e geração de teoria/resoluções/mapa/quiz (IA fake)."""

import io
import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import timedelta

import pytest
from httpx import AsyncClient
from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import ai
from app.core.config import get_settings
from app.core.db import get_session_factory
from app.main import app
from tests.conftest import bearer
from tests.test_routines import onboard, today

MINDMAP = {
    "title": "Equações",
    "children": [
        {"title": "1º grau", "note": "ax + b = 0", "children": [{"title": "isolar x"}]},
        {"title": "2º grau", "children": [{"title": "Bhaskara"}, {"title": "soma e produto"}]},
    ],
}
QUIZ = {
    "questions": [
        {
            "question": "Qual a raiz de 2x − 4 = 0?",
            "options": ["1", "2", "3", "4"],
            "answer": 1,
            "explanation": "2x = 4 → x = 2.",
        },
        {"question": "inválida", "options": ["a"], "answer": 5},
    ]
}


class FakeAI:
    """Substitui `ai.chat`: registra as chamadas e devolve conteúdo pelo tipo do pedido."""

    def __init__(self) -> None:
        self.calls: list[ai.ChatRequest] = []
        self.fail_on: set[str] = set()

    async def __call__(self, req: ai.ChatRequest) -> str:
        self.calls.append(req)
        if req.images:
            return "## Exercício 1\nResolva 2x − 4 = 0.\n\n## Exercício 2\nCalcule 3/4 + 1/2."
        if "MAPA MENTAL" in req.user:
            if "mindmap" in self.fail_on:
                raise ai.AIError("cota esgotada")
            return "```json\n" + json.dumps(MINDMAP) + "\n```"
        if "QUIZ" in req.user:
            return json.dumps(QUIZ)
        if "PASSO A PASSO" in req.user:
            return "### Exercício 1\n1. 2x = 4\n2. x = 2\n\n**Resposta:** x = 2"
        return "# Equações\n\n## 1º grau\nIsolar a incógnita…"


@pytest.fixture
def fake_ai(monkeypatch: pytest.MonkeyPatch) -> FakeAI:
    fake = FakeAI()
    monkeypatch.setattr(ai, "chat", fake)
    monkeypatch.setattr(get_settings(), "ai_api_key", "test-key")
    return fake


@pytest.fixture
def background_in_test_session(db_session: AsyncSession) -> AsyncIterator[None]:
    """A tarefa em segundo plano usa a mesma sessão transacional do teste."""

    @asynccontextmanager
    async def _cm() -> AsyncIterator[AsyncSession]:
        yield db_session

    app.dependency_overrides[get_session_factory] = lambda: _cm
    yield
    app.dependency_overrides.pop(get_session_factory, None)


def _png(color: tuple[int, int, int] = (255, 255, 255)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (900, 1400), color).save(buf, format="PNG")
    return buf.getvalue()


async def _exam(client: AsyncClient, h: dict[str, str]) -> dict:
    r = await client.post(
        "/api/v1/exams",
        json={
            "title": "Prova de Matemática",
            "date": (today() + timedelta(days=4)).isoformat(),
            "topics": ["Equações de 1º grau"],
        },
        headers=h,
    )
    assert r.status_code == 201, r.text
    return r.json()


async def test_not_configured_state(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "ai_api_key", "")
    token = await onboard(client)
    h = bearer(token)
    exam = await _exam(client, h)
    assert (await client.get("/api/v1/ai/status", headers=h)).json()["configured"] is False
    state = (await client.get(f"/api/v1/exams/{exam['id']}/ai", headers=h)).json()
    assert state["configured"] is False and state["can_generate"] is False
    assert [a["kind"] for a in state["artifacts"]] == ["theory", "solutions", "mindmap", "quiz"]
    # Materiais em texto funcionam mesmo sem IA; gerar não
    r = await client.post(
        f"/api/v1/exams/{exam['id']}/materials",
        json={"content": "1) Resolva x + 1 = 3"},
        headers=h,
    )
    assert r.status_code == 201
    r = await client.post(f"/api/v1/exams/{exam['id']}/ai/generate", json={}, headers=h)
    assert r.status_code == 400 and r.json()["error"]["code"] == "ai_not_configured"


async def test_transcribe_photos_and_save_material(client: AsyncClient, fake_ai: FakeAI) -> None:
    token = await onboard(client)
    h = bearer(token)
    exam = await _exam(client, h)
    r = await client.post(
        f"/api/v1/exams/{exam['id']}/materials/transcribe",
        files=[
            ("files", ("a.png", _png(), "image/png")),
            ("files", ("b.png", _png(), "image/png")),
        ],
        headers=h,
    )
    assert r.status_code == 200, r.text
    assert r.json()["images"] == 2 and "Exercício 1" in r.json()["content"]
    req = fake_ai.calls[-1]
    assert len(req.images) == 2
    # A foto foi normalizada (JPEG, lado maior ≤ 1600) antes de ir para o provedor
    img = Image.open(io.BytesIO(req.images[0]))
    assert img.format == "JPEG" and max(img.size) <= 1600

    # Arquivo que não é imagem → erro amigável; nada é salvo
    r = await client.post(
        f"/api/v1/exams/{exam['id']}/materials/transcribe",
        files=[("files", ("x.txt", b"nao sou imagem", "text/plain"))],
        headers=h,
    )
    assert r.status_code == 400 and "imagem" in r.json()["error"]["message"]

    # O usuário revisa e salva como material (só texto)
    r = await client.post(
        f"/api/v1/exams/{exam['id']}/materials",
        json={"title": "Lista 3", "source": "photo", "content": r"## Exercício 1\nResolva…"},
        headers=h,
    )
    assert r.status_code == 201 and r.json()["source"] == "photo"
    mid = r.json()["id"]
    r = await client.patch(
        f"/api/v1/exams/{exam['id']}/materials/{mid}",
        json={"content": "## Exercício 1\nResolva 2x − 4 = 0."},
        headers=h,
    )
    assert r.status_code == 200
    state = (await client.get(f"/api/v1/exams/{exam['id']}/ai", headers=h)).json()
    assert len(state["materials"]) == 1 and state["can_generate"] is True
    assert (
        await client.delete(f"/api/v1/exams/{exam['id']}/materials/{mid}", headers=h)
    ).status_code == 204


async def test_generate_all_kinds_in_background(
    client: AsyncClient, fake_ai: FakeAI, background_in_test_session: None
) -> None:
    token = await onboard(client)
    h = bearer(token)
    exam = await _exam(client, h)
    # Sem material → não gera
    r = await client.post(f"/api/v1/exams/{exam['id']}/ai/generate", json={}, headers=h)
    assert r.status_code == 409
    await client.post(
        f"/api/v1/exams/{exam['id']}/materials",
        json={"content": "1) Resolva 2x − 4 = 0\n2) Calcule 3/4 + 1/2"},
        headers=h,
    )

    r = await client.post(f"/api/v1/exams/{exam['id']}/ai/generate", json={}, headers=h)
    assert r.status_code == 200, r.text
    # A tarefa roda depois da resposta; ao consultar, tudo está pronto
    state = (await client.get(f"/api/v1/exams/{exam['id']}/ai", headers=h)).json()
    by_kind = {a["kind"]: a for a in state["artifacts"]}
    assert {a["status"] for a in by_kind.values()} == {"done"}
    assert by_kind["theory"]["content_md"].startswith("# Equações")
    assert "**Resposta:** x = 2" in by_kind["solutions"]["content_md"]
    assert by_kind["mindmap"]["content_json"]["children"][1]["children"][0]["title"] == "Bhaskara"
    # Questão inválida do quiz foi descartada
    assert len(by_kind["quiz"]["content_json"]["questions"]) == 1
    assert by_kind["quiz"]["content_json"]["questions"][0]["answer"] == 1
    assert all(a["stale"] is False for a in by_kind.values())
    assert len(fake_ai.calls) == 4
    # O contexto enviado tem título, conteúdos e o material
    assert "Prova de Matemática" in fake_ai.calls[0].user
    assert "Equações de 1º grau" in fake_ai.calls[0].user
    assert "2x − 4 = 0" in fake_ai.calls[0].user

    # Mudar o material marca os artefatos como desatualizados
    await client.post(
        f"/api/v1/exams/{exam['id']}/materials", json={"content": "3) Nova questão"}, headers=h
    )
    state = (await client.get(f"/api/v1/exams/{exam['id']}/ai", headers=h)).json()
    assert all(a["stale"] is True for a in state["artifacts"])

    # Regenerar só o mapa mental, com falha do provedor → status failed com mensagem
    fake_ai.fail_on.add("mindmap")
    r = await client.post(
        f"/api/v1/exams/{exam['id']}/ai/generate", json={"kinds": ["mindmap"]}, headers=h
    )
    assert r.status_code == 200
    state = (await client.get(f"/api/v1/exams/{exam['id']}/ai", headers=h)).json()
    by_kind = {a["kind"]: a for a in state["artifacts"]}
    assert by_kind["mindmap"]["status"] == "failed" and "cota" in by_kind["mindmap"]["error"]
    assert by_kind["theory"]["status"] == "done"  # os outros ficaram como estavam


async def test_ai_is_isolated_between_users(client: AsyncClient, fake_ai: FakeAI) -> None:
    a = await onboard(client, email="a@exemplo.com")
    client.cookies.clear()
    b = await onboard(client, email="b@exemplo.com")
    exam = await _exam(client, bearer(a))
    r = await client.post(
        f"/api/v1/exams/{exam['id']}/materials", json={"content": "x"}, headers=bearer(b)
    )
    assert r.status_code == 404
    assert (
        await client.get(f"/api/v1/exams/{exam['id']}/ai", headers=bearer(b))
    ).status_code == 404
    r = await client.post(f"/api/v1/exams/{exam['id']}/ai/generate", json={}, headers=bearer(b))
    assert r.status_code == 404


def test_parse_json_tolerates_wrapping() -> None:
    assert ai.parse_json('```json\n{"a": 1}\n```') == {"a": 1}
    assert ai.parse_json('Aqui está: {"a": [1, 2]} espero que ajude') == {"a": [1, 2]}
    with pytest.raises(ai.AIError):
        ai.parse_json("sem json nenhum")
