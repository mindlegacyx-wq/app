from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class TrashItemOut(BaseModel):
    kind: str
    label: str
    id: UUID
    title: str
    subtitle: str | None
    deleted_at: datetime
    expires_at: datetime


class TrashOut(BaseModel):
    retention_days: int
    items: list[TrashItemOut]


class RestoreIn(BaseModel):
    kind: str
    id: UUID


class RestoreOut(BaseModel):
    kind: str
    id: UUID
    restored: bool
