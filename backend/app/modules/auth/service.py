from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError, UnauthorizedError
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    password_needs_rehash,
    refresh_expiry,
    verify_password,
)
from app.modules.auth.models import Session
from app.modules.users import service as users_service
from app.modules.users.models import User


@dataclass(frozen=True)
class IssuedTokens:
    access_token: str
    refresh_token: str  # valor cru; vai só para o cookie
    session: Session
    user: User


async def _open_session(
    db: AsyncSession, user: User, *, user_agent: str | None, ip: str | None
) -> IssuedTokens:
    raw = generate_refresh_token()
    session = Session(
        user_id=user.id,
        token_hash=hash_refresh_token(raw),
        user_agent=(user_agent or "")[:500] or None,
        ip=ip,
        expires_at=refresh_expiry(),
        created_at=datetime.now(UTC),
        last_used_at=datetime.now(UTC),
    )
    db.add(session)
    await db.flush()
    return IssuedTokens(
        access_token=create_access_token(user.id, session.id),
        refresh_token=raw,
        session=session,
        user=user,
    )


async def register(
    db: AsyncSession,
    *,
    email: str,
    password: str,
    name: str,
    user_agent: str | None,
    ip: str | None,
) -> IssuedTokens:
    if await users_service.get_by_email(db, email) is not None:
        raise ConflictError("Já existe uma conta com esse e-mail.")
    user = await users_service.create(db, email=email, password=password, name=name)
    return await _open_session(db, user, user_agent=user_agent, ip=ip)


async def login(
    db: AsyncSession, *, email: str, password: str, user_agent: str | None, ip: str | None
) -> IssuedTokens:
    user = await users_service.get_by_email(db, email)
    # Mesma mensagem para e-mail inexistente e senha errada: não revela contas.
    if user is None or not user.is_active or not verify_password(password, user.password_hash):
        raise UnauthorizedError("E-mail ou senha incorretos.")
    if password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)
    return await _open_session(db, user, user_agent=user_agent, ip=ip)


async def refresh(
    db: AsyncSession, *, raw_refresh_token: str, user_agent: str | None, ip: str | None
) -> IssuedTokens:
    """Rotação: o refresh usado é revogado e um novo é emitido na mesma hora."""
    now = datetime.now(UTC)
    session = await db.scalar(
        select(Session).where(Session.token_hash == hash_refresh_token(raw_refresh_token))
    )
    if session is None or session.revoked_at is not None or session.expires_at <= now:
        raise UnauthorizedError("Sessão expirada. Entre de novo.")

    user = await users_service.get_by_id(db, session.user_id)
    if user is None or not user.is_active:
        raise UnauthorizedError("Conta indisponível.")

    session.revoked_at = now
    await db.flush()
    return await _open_session(db, user, user_agent=user_agent, ip=ip)


async def logout(db: AsyncSession, *, raw_refresh_token: str | None) -> None:
    if not raw_refresh_token:
        return
    await db.execute(
        update(Session)
        .where(Session.token_hash == hash_refresh_token(raw_refresh_token))
        .where(Session.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )


async def resolve_active_user(db: AsyncSession, *, user_id: UUID, session_id: UUID) -> User | None:
    """Usado a cada request autenticado: garante que a sessão do token ainda vale."""
    now = datetime.now(UTC)
    session = await db.get(Session, session_id)
    if (
        session is None
        or session.user_id != user_id
        or session.revoked_at is not None
        or session.expires_at <= now
    ):
        return None
    user = await users_service.get_by_id(db, user_id)
    if user is None or not user.is_active:
        return None
    return user


async def list_sessions(db: AsyncSession, user_id: UUID) -> list[Session]:
    now = datetime.now(UTC)
    result = await db.scalars(
        select(Session)
        .where(Session.user_id == user_id)
        .where(Session.revoked_at.is_(None))
        .where(Session.expires_at > now)
        .order_by(Session.created_at.desc())
    )
    return list(result)


async def revoke_session(db: AsyncSession, user_id: UUID, session_id: UUID) -> None:
    session = await db.get(Session, session_id)
    # Filtrar por user_id é o que impede revogar sessão de outra pessoa.
    if session is None or session.user_id != user_id or session.revoked_at is not None:
        raise NotFoundError("Sessão não encontrada.")
    session.revoked_at = datetime.now(UTC)
    await db.flush()
