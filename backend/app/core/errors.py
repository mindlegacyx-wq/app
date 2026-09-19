"""Erros de domínio e formato único de resposta de erro.

Formato: { "error": { "code": "...", "message": "...", "details": {...} } }
"""

from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AppError(Exception):
    status_code = status.HTTP_400_BAD_REQUEST
    code = "bad_request"

    def __init__(self, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT
    code = "conflict"


class UnauthorizedError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "unauthorized"


class ForbiddenError(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "forbidden"


class RateLimitedError(AppError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    code = "rate_limited"


def _payload(code: str, message: str, details: Any = None) -> dict[str, Any]:
    return {"error": {"code": code, "message": message, "details": details or {}}}


# Mensagens de validação em português. O que não estiver aqui cai na mensagem original.
_PT_MESSAGES: dict[str, str] = {
    "missing": "Campo obrigatório.",
    "string_too_short": "Use pelo menos {min_length} caracteres.",
    "string_too_long": "Use no máximo {max_length} caracteres.",
    "string_type": "Deve ser um texto.",
    "int_parsing": "Deve ser um número inteiro.",
    "int_type": "Deve ser um número inteiro.",
    "bool_parsing": "Deve ser verdadeiro ou falso.",
    "greater_than_equal": "Deve ser no mínimo {ge}.",
    "less_than_equal": "Deve ser no máximo {le}.",
    "time_parsing": "Horário inválido. Use o formato HH:MM.",
    "date_parsing": "Data inválida.",
    "datetime_parsing": "Data e hora inválidas.",
    "uuid_parsing": "Identificador inválido.",
    "enum": "Valor não permitido.",
    "json_invalid": "Corpo da requisição inválido.",
}


def _translate(err: dict[str, Any]) -> str:
    err_type = str(err.get("type", ""))
    ctx = err.get("ctx") or {}
    if err_type == "value_error":
        # Erros dos nossos validators já vêm em português; e-mail vem do email-validator.
        msg = str(err.get("msg", ""))
        if "email" in msg.lower():
            return "E-mail inválido."
        return msg.removeprefix("Value error, ")
    if err_type == "string_too_short" and ctx.get("min_length") == 1:
        return "Campo obrigatório."
    template = _PT_MESSAGES.get(err_type)
    if template is None:
        return str(err.get("msg", "Valor inválido."))
    try:
        return template.format(**ctx)
    except (KeyError, IndexError):
        return template


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code, content=_payload(exc.code, exc.message, exc.details)
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        fields = [
            {"field": ".".join(str(p) for p in e["loc"] if p != "body"), "message": _translate(e)}
            for e in exc.errors()
        ]
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_payload("validation_error", "Dados inválidos.", {"fields": fields}),
        )
