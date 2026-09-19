"""Serve o PWA compilado (frontend/dist) pela própria API — deploy em um container só.

Ligado por STATIC_DIR (ex.: /srv/static). Regras de cache:

- ``/assets/*``: arquivos com hash no nome → cache de 1 ano, imutável.
- ``index.html``, ``sw.js``, ``manifest.webmanifest``: sem cache (o navegador sempre confere se
  há versão nova — é assim que o PWA se atualiza sozinho).
- demais arquivos da raiz (ícones, fontes): 1 dia.
- qualquer outro caminho que não seja arquivo → ``index.html`` (rotas do React Router).
- ``/api/*`` nunca cai no fallback: 404 em JSON no formato da API.
"""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse, Response
from starlette.staticfiles import PathLike, StaticFiles
from starlette.types import Scope

IMMUTABLE = "public, max-age=31536000, immutable"
NO_CACHE = "no-cache"
ONE_DAY = "public, max-age=86400"
_ALWAYS_FRESH = {"index.html", "sw.js", "manifest.webmanifest", "registerSW.js"}


class ImmutableStaticFiles(StaticFiles):
    """Assets com hash no nome: pode guardar para sempre."""

    def file_response(
        self,
        full_path: PathLike,
        stat_result: os.stat_result,
        scope: Scope,
        status_code: int = 200,
    ) -> Response:
        response = super().file_response(full_path, stat_result, scope, status_code)
        response.headers["Cache-Control"] = IMMUTABLE
        return response


def _cache_for(name: str) -> str:
    return NO_CACHE if name in _ALWAYS_FRESH else ONE_DAY


def mount_static(app: FastAPI, static_dir: str) -> bool:
    """Registra as rotas do PWA. Devolve False (sem montar nada) se a pasta não tem index.html.

    Deve ser chamado DEPOIS de todos os routers da API: a rota coringa fica por último.
    """
    root = Path(static_dir).resolve()
    index = root / "index.html"
    if not index.is_file():
        return False

    assets = root / "assets"
    if assets.is_dir():
        app.mount("/assets", ImmutableStaticFiles(directory=assets), name="assets")

    @app.api_route("/{path:path}", methods=["GET", "HEAD"], include_in_schema=False)
    async def spa(path: str) -> Response:
        if path == "api" or path.startswith("api/"):
            return JSONResponse(
                status_code=404,
                content={
                    "error": {"code": "not_found", "message": "Rota não encontrada.", "details": {}}
                },
            )
        if path:
            candidate = (root / path).resolve()
            if candidate.is_relative_to(root) and candidate.is_file():
                headers = {"Cache-Control": _cache_for(candidate.name)}
                return FileResponse(candidate, headers=headers)
        return FileResponse(index, headers={"Cache-Control": NO_CACHE})

    return True
