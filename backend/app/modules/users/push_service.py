"""Assinaturas Web Push do usuário (um registro por navegador/dispositivo)."""

from typing import Any
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dates import now_utc
from app.modules.users.models import PushSubscription
from app.modules.users.schemas import PushSubscriptionIn


async def list_for_user(db: AsyncSession, user_id: UUID) -> list[PushSubscription]:
    return list(
        await db.scalars(
            select(PushSubscription)
            .where(PushSubscription.user_id == user_id)
            .order_by(PushSubscription.created_at)
        )
    )


def subscription_info(sub: PushSubscription) -> dict[str, Any]:
    """Formato que o pywebpush espera (o mesmo do `PushSubscription.toJSON()` do navegador)."""
    return {"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}}


async def upsert(
    db: AsyncSession, user_id: UUID, data: PushSubscriptionIn, user_agent: str | None
) -> PushSubscription:
    """Cria ou atualiza pela `endpoint`. Se o mesmo navegador logar com outra conta, a
    assinatura passa para o novo usuário (o antigo deixa de receber ali)."""
    sub = await db.scalar(
        select(PushSubscription).where(PushSubscription.endpoint == data.endpoint)
    )
    if sub is None:
        sub = PushSubscription(
            user_id=user_id,
            endpoint=data.endpoint,
            p256dh=data.keys.p256dh,
            auth=data.keys.auth,
            user_agent=user_agent,
            created_at=now_utc(),
        )
        db.add(sub)
    else:
        sub.user_id = user_id
        sub.p256dh = data.keys.p256dh
        sub.auth = data.keys.auth
        sub.user_agent = user_agent
    await db.flush()
    return sub


async def remove(db: AsyncSession, user_id: UUID, endpoint: str) -> None:
    await db.execute(
        delete(PushSubscription).where(
            PushSubscription.user_id == user_id, PushSubscription.endpoint == endpoint
        )
    )
    await db.flush()
