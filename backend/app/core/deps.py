"""Dependencies compartilhadas: sessão de banco e usuário autenticado.

Toda rota privada recebe `current_user`. Os services recebem `user_id` como primeiro
argumento e filtram por ele: é assim que o isolamento multiusuário é garantido.
"""

from typing import Annotated
from uuid import UUID

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.errors import UnauthorizedError
from app.core.security import decode_access_token
from app.modules.auth import service as auth_service
from app.modules.users.models import User

DB = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user(request: Request, db: DB) -> User:
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        raise UnauthorizedError("Não autenticado.")
    payload = decode_access_token(header[7:].strip())
    if payload is None:
        raise UnauthorizedError("Sessão expirada. Entre de novo.")

    user = await auth_service.resolve_active_user(
        db, user_id=UUID(payload["sub"]), session_id=UUID(payload["sid"])
    )
    if user is None:
        raise UnauthorizedError("Sessão inválida. Entre de novo.")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
