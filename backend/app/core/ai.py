"""Cliente mínimo para provedores compatíveis com a API de chat da OpenAI.

Funciona com Groq, Gemini (endpoint OpenAI-compatible), Mistral, OpenAI, Ollama… — só muda
`AI_BASE_URL`, `AI_API_KEY` e os nomes dos modelos no `.env`. Sem chave, `is_configured()`
é False e o app mostra a funcionalidade como "não configurada" em vez de falhar.

Imagens vão inline (data URL) e nunca são guardadas: só o texto transcrito fica no banco.
"""

from __future__ import annotations

import base64
import io
import json
import re
from dataclasses import dataclass, field
from typing import Any

import httpx
from PIL import Image, ImageOps

from app.core.config import get_settings
from app.core.errors import AppError

MAX_IMAGE_SIDE = 1600  # px; suficiente para ler exercícios e barato em tokens
JPEG_QUALITY = 82


class AIError(AppError):
    code = "ai_error"


class AINotConfiguredError(AppError):
    code = "ai_not_configured"


def is_configured() -> bool:
    s = get_settings()
    return bool(s.ai_api_key and s.ai_base_url and s.ai_model)


@dataclass
class ChatRequest:
    system: str
    user: str
    images: list[bytes] = field(default_factory=list)  # bytes de imagem (jpeg/png/webp)
    json_mode: bool = False
    max_tokens: int = 4000
    temperature: float = 0.2


def prepare_image(raw: bytes) -> bytes:
    """Normaliza a foto: corrige rotação EXIF, limita o lado maior e recomprime em JPEG."""
    try:
        opened = Image.open(io.BytesIO(raw))
        img: Image.Image = (ImageOps.exif_transpose(opened) or opened).convert("RGB")
    except Exception as exc:  # arquivo corrompido ou formato não suportado
        raise AIError("Não consegui ler essa imagem. Envie JPG, PNG ou WebP.") from exc
    img.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE))
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return out.getvalue()


def _image_part(data: bytes) -> dict[str, Any]:
    b64 = base64.b64encode(data).decode("ascii")
    return {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}}


async def chat(req: ChatRequest) -> str:
    """Uma chamada de chat. Devolve o texto da resposta (ou lança AIError)."""
    if not is_configured():
        raise AINotConfiguredError("IA não configurada neste servidor.")
    s = get_settings()
    model = s.ai_vision_model if req.images else s.ai_model
    content: str | list[dict[str, Any]]
    if req.images:
        content = [{"type": "text", "text": req.user}, *(_image_part(i) for i in req.images)]
    else:
        content = req.user
    body: dict[str, Any] = {
        "model": model,
        "messages": [
            {"role": "system", "content": req.system},
            {"role": "user", "content": content},
        ],
        "temperature": req.temperature,
        "max_tokens": req.max_tokens,
    }
    if req.json_mode:
        body["response_format"] = {"type": "json_object"}
    try:
        async with httpx.AsyncClient(timeout=s.ai_timeout_seconds) as client:
            r = await client.post(
                f"{s.ai_base_url.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {s.ai_api_key}"},
                json=body,
            )
    except httpx.TimeoutException as exc:
        raise AIError("O provedor de IA demorou demais para responder. Tente de novo.") from exc
    except httpx.HTTPError as exc:
        raise AIError(
            f"Não foi possível falar com o provedor de IA ({exc.__class__.__name__})."
        ) from exc
    if r.status_code >= 400:
        raise AIError(_describe_http_error(r))
    try:
        data = r.json()
        text = data["choices"][0]["message"]["content"]
    except (ValueError, KeyError, IndexError, TypeError) as exc:
        raise AIError("Resposta inesperada do provedor de IA.") from exc
    if not isinstance(text, str) or not text.strip():
        raise AIError("O provedor de IA devolveu uma resposta vazia.")
    return text.strip()


def _describe_http_error(r: httpx.Response) -> str:
    detail = ""
    try:
        err = r.json().get("error")
        detail = str(err.get("message") or "") if isinstance(err, dict) else str(err or "")
    except ValueError:
        detail = r.text[:200]
    if r.status_code in (401, 403):
        return "Chave da IA recusada pelo provedor. Confira AI_API_KEY no .env."
    if r.status_code == 404:
        return "Modelo não encontrado no provedor. Confira AI_MODEL / AI_VISION_MODEL."
    if r.status_code == 429:
        return "Limite do provedor de IA atingido (cota gratuita). Espere um pouco e tente de novo."
    return f"Provedor de IA respondeu {r.status_code}: {detail[:160]}"


def parse_json(text: str) -> Any:
    """Extrai JSON mesmo quando o modelo embrulha em ```json … ``` ou escreve algo antes."""
    cleaned = text.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", cleaned, re.DOTALL)
    if fence:
        cleaned = fence.group(1).strip()
    try:
        return json.loads(cleaned)
    except ValueError:
        start = min((i for i in (cleaned.find("{"), cleaned.find("[")) if i >= 0), default=-1)
        if start < 0:
            raise AIError("A IA não devolveu um JSON válido.") from None
        end = max(cleaned.rfind("}"), cleaned.rfind("]"))
        try:
            return json.loads(cleaned[start : end + 1])
        except ValueError as exc:
            raise AIError("A IA não devolveu um JSON válido.") from exc
