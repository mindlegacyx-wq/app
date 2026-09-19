import datetime as dt
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.modules.studies.models import (
    ArtifactKind,
    ArtifactStatus,
    ExamKind,
    ExamStatus,
    MaterialSource,
    StudySessionStatus,
)

# --- Conteúdos ---------------------------------------------------------------------------


class TopicIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)


class TopicUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    is_done: bool | None = None


class TopicOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    exam_id: UUID
    title: str
    is_done: bool
    sort_order: int


# --- Provas e trabalhos ------------------------------------------------------------------


class ExamIn(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    kind: ExamKind = ExamKind.exam
    subject_id: UUID | None = None
    date: dt.date
    lead_days: int = Field(default=7, ge=1, le=60)
    minutes_per_day: int = Field(default=30, ge=10, le=240)
    notes: str | None = Field(default=None, max_length=2000)
    topics: list[str] = Field(default_factory=list, max_length=50)


class ExamUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=80)
    kind: ExamKind | None = None
    subject_id: UUID | None = None
    clear_subject: bool = False
    date: dt.date | None = None
    lead_days: int | None = Field(default=None, ge=1, le=60)
    minutes_per_day: int | None = Field(default=None, ge=10, le=240)
    notes: str | None = Field(default=None, max_length=2000)
    clear_notes: bool = False
    status: ExamStatus | None = None


class ExamOut(BaseModel):
    id: UUID
    title: str
    kind: ExamKind
    subject_id: UUID | None
    subject_name: str | None
    subject_color: str | None
    date: dt.date
    lead_days: int
    minutes_per_day: int
    notes: str | None
    status: ExamStatus
    done_at: dt.datetime | None
    # Derivados (relativos ao "hoje" do usuário)
    days_until: int  # negativo = já passou
    study_from: dt.date  # primeiro dia em que a prova cobra estudo
    sessions_total: int  # dias de estudo dentro da janela (a partir do cadastro)
    sessions_done: int
    topics_total: int
    topics_done: int
    topics: list[TopicOut]


# --- Sessões de estudo -------------------------------------------------------------------


class SessionStartIn(BaseModel):
    exam_id: UUID
    date: dt.date | None = None  # padrão: hoje


class SessionUpdate(BaseModel):
    status: StudySessionStatus | None = None
    focused_seconds: int | None = Field(default=None, ge=0, le=24 * 3600)


class StudySessionOut(BaseModel):
    id: UUID | None  # None = planejada, ainda sem registro
    exam_id: UUID
    exam_title: str
    exam_kind: ExamKind
    exam_date: dt.date
    subject_name: str | None
    subject_color: str | None
    date: dt.date
    status: StudySessionStatus | None  # None = pendente
    planned_minutes: int
    focused_seconds: int
    started_at: dt.datetime | None
    completed_at: dt.datetime | None
    suggested_start: dt.time | None  # encaixe sugerido nos buracos da agenda
    suggested_end: dt.time | None
    topics_total: int
    topics_done: int


class StudyDayOut(BaseModel):
    date: dt.date
    sessions: list[StudySessionOut]
    planned: int
    completed: int
    total_minutes: int  # soma dos minutos planejados do dia


class ExamDetailOut(ExamOut):
    sessions: list[StudySessionOut]  # janela inteira, do primeiro dia ao dia anterior à prova


# --- Estudos com IA (Fase 12) -------------------------------------------------------------


class AIStatusOut(BaseModel):
    configured: bool
    model: str | None
    vision_model: str | None


class TranscriptionOut(BaseModel):
    content: str  # markdown editável; nada foi salvo ainda
    images: int


class MaterialIn(BaseModel):
    title: str | None = Field(default=None, max_length=80)
    source: MaterialSource = MaterialSource.text
    content: str = Field(min_length=1, max_length=40_000)


class MaterialUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=80)
    clear_title: bool = False
    content: str | None = Field(default=None, min_length=1, max_length=40_000)


class MaterialOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    exam_id: UUID
    title: str | None
    source: MaterialSource
    content: str
    created_at: dt.datetime
    updated_at: dt.datetime


class ArtifactOut(BaseModel):
    kind: ArtifactKind
    status: ArtifactStatus
    content_md: str | None
    content_json: dict[str, Any] | None
    error: str | None
    model: str | None
    stale: bool  # os materiais mudaram depois da geração
    updated_at: dt.datetime | None


class GenerateIn(BaseModel):
    kinds: list[ArtifactKind] = Field(default_factory=lambda: list(ArtifactKind))


class ExamAIOut(BaseModel):
    configured: bool
    materials: list[MaterialOut]
    artifacts: list[ArtifactOut]  # sempre os 4 tipos, na ordem teoria · resoluções · mapa · quiz
    can_generate: bool  # configurado e com pelo menos um material
