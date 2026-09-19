import enum
from datetime import date, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.modules.schedule.models import Subject


class ExamKind(enum.StrEnum):
    exam = "exam"  # prova
    assignment = "assignment"  # trabalho


class ExamStatus(enum.StrEnum):
    open = "open"  # ainda vai acontecer (ou passou sem o usuário fechar)
    done = "done"  # feita/entregue: para de gerar sessões de estudo


class Exam(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    """Prova ou trabalho com data. Gera uma sessão de estudo por dia nos `lead_days` anteriores."""

    __tablename__ = "exams"
    __table_args__ = (Index("ix_exams_user_id_date", "user_id", "date"),)

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    subject_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(80), nullable=False)
    kind: Mapped[ExamKind] = mapped_column(
        Enum(ExamKind, name="exam_kind", native_enum=False, length=12), nullable=False
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    lead_days: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=7)
    minutes_per_day: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=30)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ExamStatus] = mapped_column(
        Enum(ExamStatus, name="exam_status", native_enum=False, length=10),
        nullable=False,
        default=ExamStatus.open,
    )
    done_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    subject: Mapped[Subject | None] = relationship(lazy="joined")
    topics: Mapped[list["ExamTopic"]] = relationship(
        back_populates="exam",
        cascade="all, delete-orphan",
        order_by="ExamTopic.sort_order",
        lazy="selectin",
    )


class ExamTopic(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Conteúdo a estudar para a prova (checklist). Na Fase 12 recebe os materiais gerados."""

    __tablename__ = "exam_topics"

    exam_id: Mapped[UUID] = mapped_column(
        ForeignKey("exams.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    is_done: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    exam: Mapped[Exam] = relationship(back_populates="topics")


class StudySessionStatus(enum.StrEnum):
    in_progress = "in_progress"
    completed = "completed"
    skipped = "skipped"


class StudySession(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Registro de uma sessão de estudo de uma prova num dia.

    A sessão "planejada" nasce da definição da prova (janela de `lead_days`); esta linha só
    existe quando o usuário mexe nela (começou, concluiu, pulou) — como os logs de rotina.
    """

    __tablename__ = "study_sessions"
    __table_args__ = (
        UniqueConstraint("exam_id", "date", name="uq_study_sessions_exam_id_date"),
        Index("ix_study_sessions_user_id_date", "user_id", "date"),
    )

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    exam_id: Mapped[UUID] = mapped_column(
        ForeignKey("exams.id", ondelete="CASCADE"), nullable=False
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[StudySessionStatus] = mapped_column(
        Enum(StudySessionStatus, name="study_session_status", native_enum=False, length=12),
        nullable=False,
        default=StudySessionStatus.in_progress,
    )
    planned_minutes: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    focused_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    exam: Mapped[Exam] = relationship(lazy="joined")


# --- Estudos com IA (Fase 12) -------------------------------------------------------------


class MaterialSource(enum.StrEnum):
    photo = "photo"  # transcrito de fotos (as fotos não são guardadas)
    text = "text"  # colado/digitado


class StudyMaterial(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Texto-base de uma prova: exercícios transcritos das fotos ou colados pelo usuário."""

    __tablename__ = "study_materials"

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    exam_id: Mapped[UUID] = mapped_column(
        ForeignKey("exams.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str | None] = mapped_column(String(80), nullable=True)
    source: Mapped[MaterialSource] = mapped_column(
        Enum(MaterialSource, name="material_source", native_enum=False, length=8),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)


class ArtifactKind(enum.StrEnum):
    theory = "theory"  # teoria focada nos exercícios (markdown)
    solutions = "solutions"  # resoluções passo a passo (markdown)
    mindmap = "mindmap"  # mapa mental (json: árvore)
    quiz = "quiz"  # quiz de múltipla escolha (json)


class ArtifactStatus(enum.StrEnum):
    queued = "queued"
    running = "running"
    done = "done"
    failed = "failed"


class StudyArtifact(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Um material gerado pela IA para a prova. Um por tipo; regenerar substitui."""

    __tablename__ = "study_artifacts"
    __table_args__ = (UniqueConstraint("exam_id", "kind", name="uq_study_artifacts_exam_id_kind"),)

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    exam_id: Mapped[UUID] = mapped_column(
        ForeignKey("exams.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[ArtifactKind] = mapped_column(
        Enum(ArtifactKind, name="artifact_kind", native_enum=False, length=10), nullable=False
    )
    status: Mapped[ArtifactStatus] = mapped_column(
        Enum(ArtifactStatus, name="artifact_status", native_enum=False, length=8),
        nullable=False,
        default=ArtifactStatus.queued,
    )
    content_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    error: Mapped[str | None] = mapped_column(String(300), nullable=True)
    model: Mapped[str | None] = mapped_column(String(80), nullable=True)
    # Hash dos materiais usados: se mudar, o material está desatualizado.
    input_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
