"""Estado do jogador (Fase 13): nível, patente e XP.

Nada é guardado aqui: o XP vem dos dias (`progress`), então não existe saldo que possa
divergir do percentual de disciplina. Este módulo só traduz XP em nível.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.player.schemas import PlayerOut
from app.modules.player.xp import MAX_LEVEL, level_for
from app.modules.progress import service as progress_service
from app.modules.users.models import User


async def state(db: AsyncSession, user: User) -> PlayerOut:
    totals = await progress_service.xp_totals(db, user)
    info = level_for(totals.total)
    return PlayerOut(
        level=info.level,
        title=info.title,
        total_xp=totals.total,
        into_level=info.into_level,
        level_span=info.span,
        to_next=info.to_next,
        xp_today=totals.today,
        max_level=info.level >= MAX_LEVEL,
    )
