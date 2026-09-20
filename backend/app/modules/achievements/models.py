from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, TimestampMixin, UUIDPrimaryKeyMixin


class AchievementUnlock(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Só a marca do momento: *quando* o selo caiu e se o usuário já viu o aviso.

    O progresso não fica aqui — ele é recalculado do histórico a cada leitura.
    """

    __tablename__ = "achievement_unlocks"
    __table_args__ = (UniqueConstraint("user_id", "key", name="uq_achievement_unlocks_user_key"),)

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    key: Mapped[str] = mapped_column(String(40), nullable=False)
    unlocked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
