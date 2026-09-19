from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import NotFoundError
from app.core.security import hash_password
from app.modules.routines import service as routines_service
from app.modules.users.models import User, UserSettings
from app.modules.users.schemas import OnboardingComplete, UserSettingsUpdate, UserUpdate


async def get_by_email(db: AsyncSession, email: str) -> User | None:
    return await db.scalar(select(User).where(User.email == email))


async def get_by_id(db: AsyncSession, user_id: UUID) -> User | None:
    return await db.get(User, user_id)


async def create(db: AsyncSession, *, email: str, password: str, name: str) -> User:
    s = get_settings()
    user = User(
        email=email,
        password_hash=hash_password(password),
        name=name,
        timezone=s.default_timezone,
        is_active=True,
    )
    user.settings = UserSettings(discipline_target=s.default_discipline_target)
    db.add(user)
    await db.flush()
    return user


async def update_profile(db: AsyncSession, user_id: UUID, data: UserUpdate) -> User:
    user = await get_by_id(db, user_id)
    if user is None:
        raise NotFoundError("Usuário não encontrado.")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    await db.flush()
    return user


async def update_settings(db: AsyncSession, user_id: UUID, data: UserSettingsUpdate) -> User:
    user = await get_by_id(db, user_id)
    if user is None:
        raise NotFoundError("Usuário não encontrado.")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(user.settings, field, value)
    await db.flush()
    return user


async def complete_onboarding(db: AsyncSession, user_id: UUID, data: OnboardingComplete) -> User:
    """Setup inicial. Guarda wake_time e cria as rotinas Manhã e Noite vazias.

    O alarme correspondente entra na Fase 6.
    """
    user = await get_by_id(db, user_id)
    if user is None:
        raise NotFoundError("Usuário não encontrado.")
    user.name = data.name
    user.timezone = data.timezone
    user.settings.wake_time = data.wake_time
    user.settings.discipline_target = data.discipline_target
    user.settings.onboarding_completed_at = datetime.now(UTC)
    await routines_service.ensure_default_routines(db, user.id, data.wake_time)
    await db.flush()
    return user
