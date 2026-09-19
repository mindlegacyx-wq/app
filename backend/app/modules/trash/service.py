"""Lixeira (tela 26): orquestra os `TrashKind` declarados por cada módulo.

Este módulo não conhece regra de negócio nenhuma: lista, restaura e apaga em definitivo com
a infraestrutura de `app.core.softdelete`, usando as descrições que os módulos donos expõem.
"""

from datetime import timedelta
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core import softdelete
from app.core.dates import now_utc
from app.modules.alarms import service as alarms_service
from app.modules.goals import service as goals_service
from app.modules.routines import service as routines_service
from app.modules.schedule import service as schedule_service
from app.modules.tasks import service as tasks_service
from app.modules.trash.schemas import RestoreOut, TrashItemOut, TrashOut
from app.modules.workouts import service as workouts_service

KINDS = [
    *routines_service.TRASH_KINDS,
    *tasks_service.TRASH_KINDS,
    *goals_service.TRASH_KINDS,
    *workouts_service.TRASH_KINDS,
    *alarms_service.TRASH_KINDS,
    *schedule_service.TRASH_KINDS,
]


async def list_trash(db: AsyncSession, user_id: UUID) -> TrashOut:
    entries = await softdelete.list_entries(db, KINDS, user_id)
    return TrashOut(
        retention_days=softdelete.RETENTION_DAYS,
        items=[TrashItemOut(**e.__dict__) for e in entries],
    )


async def restore(db: AsyncSession, user_id: UUID, kind: str, row_id: UUID) -> RestoreOut:
    await softdelete.restore(db, KINDS, user_id, kind, row_id)
    return RestoreOut(kind=kind, id=row_id, restored=True)


async def purge_expired(db: AsyncSession) -> int:
    """Job diário: apaga em definitivo o que passou do prazo e não tem histórico ligado."""
    cutoff = now_utc() - timedelta(days=softdelete.RETENTION_DAYS)
    return await softdelete.purge(db, KINDS, cutoff)
