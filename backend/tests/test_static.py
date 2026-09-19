"""STATIC_DIR: a API entrega o PWA compilado com as regras de cache certas e sem engolir /api."""

from pathlib import Path

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.static import IMMUTABLE, NO_CACHE, ONE_DAY, mount_static


def _dist(tmp_path: Path) -> Path:
    (tmp_path / "assets").mkdir()
    (tmp_path / "icons").mkdir()
    (tmp_path / "index.html").write_text("<!doctype html><title>Disciplina</title>")
    (tmp_path / "sw.js").write_text("// sw")
    (tmp_path / "manifest.webmanifest").write_text("{}")
    (tmp_path / "assets" / "index-abc123.js").write_text("console.log(1)")
    (tmp_path / "icons" / "icon-192.png").write_bytes(b"\x89PNG")
    return tmp_path


async def test_serves_spa_assets_and_api_404(tmp_path: Path) -> None:
    app = FastAPI()

    @app.get("/api/v1/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    assert mount_static(app, str(_dist(tmp_path))) is True
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        r = await c.get("/")
        assert r.status_code == 200 and "Disciplina" in r.text
        assert r.headers["cache-control"] == NO_CACHE

        # Rota do React Router → index.html (o app decide o que mostrar)
        r = await c.get("/estudos/123/sessao/2026-09-20")
        assert r.status_code == 200 and "Disciplina" in r.text

        r = await c.get("/assets/index-abc123.js")
        assert r.status_code == 200 and r.headers["cache-control"] == IMMUTABLE

        r = await c.get("/sw.js")
        assert r.status_code == 200 and r.headers["cache-control"] == NO_CACHE
        r = await c.get("/manifest.webmanifest")
        assert r.headers["cache-control"] == NO_CACHE
        r = await c.get("/icons/icon-192.png")
        assert r.status_code == 200 and r.headers["cache-control"] == ONE_DAY

        # A API continua respondendo; rota inexistente da API não vira index.html
        assert (await c.get("/api/v1/health")).json() == {"status": "ok"}
        r = await c.get("/api/v1/nao-existe")
        assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"

        # Sem escapar da pasta
        r = await c.get("/..%2F..%2Fetc%2Fpasswd")
        assert r.status_code == 200 and "Disciplina" in r.text


def test_missing_index_disables_static(tmp_path: Path) -> None:
    assert mount_static(FastAPI(), str(tmp_path)) is False


async def test_head_requests_work(tmp_path: Path) -> None:
    app = FastAPI()
    mount_static(app, str(_dist(tmp_path)))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        r = await c.head("/")
        assert r.status_code == 200 and r.headers["cache-control"] == NO_CACHE
        assert (await c.head("/assets/index-abc123.js")).status_code == 200
