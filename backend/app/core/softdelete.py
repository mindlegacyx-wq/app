"""Lixeira: infraestrutura genérica de soft delete.

Cada módulo descreve o que pode ir para a lixeira com um `TrashKind` (tabela, título,
subtítulo, pai, regra de restauração, história dependente). O módulo `trash` só orquestra:
lista, restaura e apaga em definitivo usando essas descrições — nunca conhece as regras de
negócio dos outros módulos.

Regras:
- Um item fica na lixeira por `RETENTION_DAYS`; depois o job apaga em definitivo.
- O que tem **histórico** ligado (sessões de treino, checks de rotina) **não é apagado**: fica
  oculto, fora da lixeira, para o passado continuar íntegro. Custa bytes, preserva o número.
- Filhos de um pai excluído não aparecem sozinhos (restaurar o pai devolve tudo).
"""

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, cast
from uuid import UUID

from sqlalchemy import ColumnElement, delete, select
from sqlalchemy.engine import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dates import now_utc
from app.core.errors import ConflictError, NotFoundError

RETENTION_DAYS = 30


@dataclass(frozen=True)
class TrashKind:
    kind: str  # chave estável usada pela API ("routine", "task"…)
    label: str  # rótulo no plural para agrupar na tela ("Rotinas")
    model: type[Any]
    title: Callable[[Any], str]
    subtitle: Callable[[Any], str | None] = lambda _row: None
    # (modelo do pai, nome da FK no filho). Só lista/restaura se o pai está vivo.
    parent: tuple[type[Any], str] | None = None
    # Validação extra antes de restaurar (ex.: só uma rotina da manhã). Lança ConflictError.
    before_restore: Callable[[AsyncSession, Any], Awaitable[None]] | None = None
    # EXISTS de histórico dependente; linhas com histórico nunca são apagadas em definitivo.
    history: Callable[[type[Any]], ColumnElement[bool]] | None = None


@dataclass
class TrashEntry:
    kind: str
    label: str
    id: UUID
    title: str
    subtitle: str | None
    deleted_at: datetime
    expires_at: datetime


def _alive_parent_filter(kind: TrashKind):
    assert kind.parent is not None
    parent_model, fk = kind.parent
    return (
        select(parent_model.id)
        .where(parent_model.id == getattr(kind.model, fk), parent_model.deleted_at.is_(None))
        .exists()
    )


async def list_entries(db: AsyncSession, kinds: list[TrashKind], user_id: UUID) -> list[TrashEntry]:
    since = now_utc() - timedelta(days=RETENTION_DAYS)
    out: list[TrashEntry] = []
    for kind in kinds:
        m = kind.model
        stmt = select(m).where(
            m.user_id == user_id, m.deleted_at.is_not(None), m.deleted_at >= since
        )
        if kind.parent is not None:
            stmt = stmt.where(_alive_parent_filter(kind))
        for row in await db.scalars(stmt.order_by(m.deleted_at.desc())):
            out.append(
                TrashEntry(
                    kind=kind.kind,
                    label=kind.label,
                    id=row.id,
                    title=kind.title(row),
                    subtitle=kind.subtitle(row),
                    deleted_at=row.deleted_at,
                    expires_at=row.deleted_at + timedelta(days=RETENTION_DAYS),
                )
            )
    out.sort(key=lambda e: e.deleted_at, reverse=True)
    return out


async def restore(
    db: AsyncSession, kinds: list[TrashKind], user_id: UUID, kind_key: str, row_id: UUID
) -> TrashKind:
    kind = next((k for k in kinds if k.kind == kind_key), None)
    if kind is None:
        raise NotFoundError("Tipo de item desconhecido.")
    m = kind.model
    row = await db.scalar(
        select(m).where(m.id == row_id, m.user_id == user_id, m.deleted_at.is_not(None))
    )
    if row is None:
        raise NotFoundError("Item não está na lixeira.")
    if kind.parent is not None:
        parent_model, fk = kind.parent
        parent = await db.get(parent_model, getattr(row, fk))
        if parent is None or parent.deleted_at is not None:
            raise ConflictError("Restaure primeiro o item principal ao qual este pertence.")
    if kind.before_restore is not None:
        await kind.before_restore(db, row)
    row.deleted_at = None
    await db.flush()
    return kind


async def purge(db: AsyncSession, kinds: list[TrashKind], cutoff: datetime) -> int:
    """Apaga em definitivo o que foi excluído antes de `cutoff` e não tem histórico ligado.

    Filhos vão junto pelos `ON DELETE CASCADE` das FKs.
    """
    total = 0
    for kind in kinds:
        m = kind.model
        stmt = delete(m).where(m.deleted_at.is_not(None), m.deleted_at < cutoff)
        if kind.history is not None:
            stmt = stmt.where(~kind.history(m))
        result = cast(CursorResult[Any], await db.execute(stmt))
        total += int(result.rowcount or 0)
    await db.flush()
    return total
