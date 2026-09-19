"""Provas e trabalhos com sessões de estudo automáticas.

Regras:
- Uma prova/trabalho tem data, `lead_days` ("começar a cobrar X dias antes") e
  `minutes_per_day`. Em cada dia da janela `[date - lead_days, date - 1]` ela pede **uma**
  sessão de estudo — que entra no percentual do dia como qualquer item planejado.
- A sessão planejada nasce da definição (como um item de rotina); a linha em `study_sessions`
  só existe quando o usuário começa, conclui ou pula. Mudar a data da prova muda os dias
  cobrados dali em diante; dias já fechados ficam como estavam (`daily_scores` é congelado).
- A janela só começa no dia do cadastro: uma prova criada 2 dias antes com `lead_days = 7`
  cobra 2 sessões, não 7.
- O horário é só uma **sugestão**: a sessão é encaixada no maior buraco da agenda do dia
  (`schedule.free_windows`), preferindo o que ainda está pela frente quando o dia é hoje.
- Uma prova `done` (feita/entregue) para de cobrar. Pular conta como planejada e não feita
  (mesma regra do treino).
"""

from dataclasses import dataclass
from datetime import date, time, timedelta
from uuid import UUID

from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dates import ensure_recordable_day, local_now, now_utc, user_today
from app.core.errors import ConflictError, NotFoundError
from app.core.softdelete import TrashKind
from app.modules.schedule import service as schedule_service
from app.modules.schedule.service import Window
from app.modules.studies.models import (
    Exam,
    ExamKind,
    ExamStatus,
    ExamTopic,
    StudySession,
    StudySessionStatus,
)
from app.modules.studies.schemas import (
    ExamDetailOut,
    ExamIn,
    ExamOut,
    ExamUpdate,
    SessionUpdate,
    StudyDayOut,
    StudySessionOut,
    TopicIn,
    TopicOut,
    TopicUpdate,
)
from app.modules.users.models import User

MAX_SESSIONS_PER_DAY = 6  # acima disso o dia vira irreal; a UI avisa

# --- Provas ------------------------------------------------------------------------------


def _alive_exams(user_id: UUID):
    return (
        select(Exam)
        .where(Exam.user_id == user_id, Exam.deleted_at.is_(None))
        .order_by(Exam.date, Exam.created_at)
    )


async def list_exams(db: AsyncSession, user_id: UUID) -> list[Exam]:
    return list((await db.scalars(_alive_exams(user_id))).unique())


async def get_exam(db: AsyncSession, user_id: UUID, exam_id: UUID) -> Exam:
    e = (await db.scalars(_alive_exams(user_id).where(Exam.id == exam_id))).unique().first()
    if e is None:
        raise NotFoundError("Prova ou trabalho não encontrado.")
    return e


async def _validate_subject(db: AsyncSession, user_id: UUID, subject_id: UUID | None) -> None:
    if subject_id is not None:
        await schedule_service.get_subject(db, user_id, subject_id)


async def create_exam(db: AsyncSession, user_id: UUID, data: ExamIn) -> Exam:
    await _validate_subject(db, user_id, data.subject_id)
    e = Exam(
        user_id=user_id,
        subject_id=data.subject_id,
        title=data.title,
        kind=data.kind,
        date=data.date,
        lead_days=data.lead_days,
        minutes_per_day=data.minutes_per_day,
        notes=data.notes,
        status=ExamStatus.open,
    )
    for i, title in enumerate(t.strip() for t in data.topics if t.strip()):
        e.topics.append(ExamTopic(title=title[:120], sort_order=i))
    db.add(e)
    await db.flush()
    return await get_exam(db, user_id, e.id)


async def update_exam(db: AsyncSession, user_id: UUID, exam_id: UUID, data: ExamUpdate) -> Exam:
    e = await get_exam(db, user_id, exam_id)
    fields = data.model_dump(exclude_unset=True, exclude={"clear_subject", "clear_notes"})
    if "subject_id" in fields and fields["subject_id"] != e.subject_id:
        await _validate_subject(db, user_id, fields["subject_id"])
    for k, v in fields.items():
        if v is not None:
            setattr(e, k, v)
    if data.clear_subject:
        e.subject_id = None
    if data.clear_notes:
        e.notes = None
    if data.status is not None:
        e.done_at = now_utc() if data.status == ExamStatus.done else None
    await db.flush()
    db.expire(e, ["subject"])
    return await get_exam(db, user_id, e.id)


async def delete_exam(db: AsyncSession, user_id: UUID, exam_id: UUID) -> None:
    e = await get_exam(db, user_id, exam_id)
    e.deleted_at = now_utc()
    await db.flush()


# --- Conteúdos ---------------------------------------------------------------------------


async def add_topic(db: AsyncSession, user_id: UUID, exam_id: UUID, data: TopicIn) -> ExamTopic:
    e = await get_exam(db, user_id, exam_id)
    if len(e.topics) >= 50:
        raise ConflictError("Limite de 50 conteúdos por prova.")
    t = ExamTopic(title=data.title, sort_order=len(e.topics))
    e.topics.append(t)  # via relação, para a coleção carregada ficar coerente
    await db.flush()
    return t


async def _get_topic(db: AsyncSession, user_id: UUID, exam_id: UUID, topic_id: UUID) -> ExamTopic:
    e = await get_exam(db, user_id, exam_id)
    t = next((x for x in e.topics if x.id == topic_id), None)
    if t is None:
        raise NotFoundError("Conteúdo não encontrado.")
    return t


async def update_topic(
    db: AsyncSession, user_id: UUID, exam_id: UUID, topic_id: UUID, data: TopicUpdate
) -> ExamTopic:
    t = await _get_topic(db, user_id, exam_id, topic_id)
    for k, v in data.model_dump(exclude_unset=True).items():
        if v is not None:
            setattr(t, k, v)
    await db.flush()
    return t


async def delete_topic(db: AsyncSession, user_id: UUID, exam_id: UUID, topic_id: UUID) -> None:
    t = await _get_topic(db, user_id, exam_id, topic_id)
    t.exam.topics.remove(t)  # delete-orphan apaga a linha
    await db.flush()


# --- Janela de estudo --------------------------------------------------------------------


def _created_day(e: Exam, timezone: str) -> date:
    return user_today(timezone, e.created_at)


def study_window(e: Exam, timezone: str) -> tuple[date, date]:
    """Primeiro e último dia em que a prova cobra estudo (último = véspera)."""
    start = max(e.date - timedelta(days=e.lead_days), _created_day(e, timezone))
    return start, e.date - timedelta(days=1)


def asks_study_on(e: Exam, on: date, timezone: str) -> bool:
    if e.status != ExamStatus.open:
        return False
    start, end = study_window(e, timezone)
    return start <= on <= end


# --- Sessões -----------------------------------------------------------------------------


async def _rows_for_day(db: AsyncSession, user_id: UUID, on: date) -> dict[UUID, StudySession]:
    rows = await db.scalars(
        select(StudySession).where(StudySession.user_id == user_id, StudySession.date == on)
    )
    return {r.exam_id: r for r in rows.unique()}


async def _rows_for_exam(db: AsyncSession, exam_id: UUID) -> dict[date, StudySession]:
    rows = await db.scalars(
        select(StudySession).where(StudySession.exam_id == exam_id).order_by(StudySession.date)
    )
    return {r.date: r for r in rows.unique()}


@dataclass
class Slot:
    start: time
    end: time


def suggest_slots(
    windows: list[Window], demands: list[tuple[UUID, int]], after: time | None
) -> dict[UUID, Slot]:
    """Encaixa cada sessão (em ordem de urgência) no maior buraco disponível.

    `after` = hora atual quando o dia é hoje: buracos já passados só entram se não sobrar nada.
    Cada encaixe consome o buraco; se nenhum buraco cabe a sessão inteira, usa o maior mesmo
    assim (a sugestão fica curta e a UI mostra os minutos planejados).
    """
    free = [Window(w.start, w.end) for w in windows]
    if after is not None:
        ahead = [w for w in free if w.end > after]
        if ahead:
            free = [Window(max(w.start, after), w.end) if w.start < after else w for w in ahead]
    out: dict[UUID, Slot] = {}
    for exam_id, minutes in demands:
        if not free:
            break
        fits = [w for w in free if w.minutes >= minutes]
        w = max(fits or free, key=lambda x: x.minutes)
        end = _add_minutes(w.start, min(minutes, w.minutes))
        out[exam_id] = Slot(w.start, end)
        # Consome o começo do buraco; o resto fica para a próxima sessão.
        rest = Window(end, w.end)
        free.remove(w)
        if rest.minutes >= 10:
            free.append(rest)
    return out


def _add_minutes(t: time, minutes: int) -> time:
    total = min(t.hour * 60 + t.minute + minutes, 23 * 60 + 59)
    return time(total // 60, total % 60)


def _session_out(
    e: Exam,
    on: date,
    row: StudySession | None,
    slot: Slot | None,
) -> StudySessionOut:
    subject = e.subject if e.subject is not None and e.subject.deleted_at is None else None
    return StudySessionOut(
        id=row.id if row else None,
        exam_id=e.id,
        exam_title=e.title,
        exam_kind=e.kind,
        exam_date=e.date,
        subject_name=subject.name if subject else None,
        subject_color=subject.color if subject else None,
        date=on,
        status=row.status if row else None,
        planned_minutes=row.planned_minutes if row else e.minutes_per_day,
        focused_seconds=row.focused_seconds if row else 0,
        started_at=row.started_at if row else None,
        completed_at=row.completed_at if row else None,
        suggested_start=slot.start if slot else None,
        suggested_end=slot.end if slot else None,
        topics_total=len(e.topics),
        topics_done=sum(1 for t in e.topics if t.is_done),
    )


async def day_overview(db: AsyncSession, user_id: UUID, timezone: str, on: date) -> StudyDayOut:
    """Sessões do dia: as cobradas pela janela + as extras que o usuário começou/concluiu."""
    exams = await list_exams(db, user_id)
    rows = await _rows_for_day(db, user_id, on)
    due = [e for e in exams if asks_study_on(e, on, timezone)]
    extras = [
        e
        for e in exams
        if e.id in rows
        and e not in due
        and rows[e.id].status in (StudySessionStatus.in_progress, StudySessionStatus.completed)
    ]
    planned_exams = [*due, *extras]

    slots: dict[UUID, Slot] = {}
    pending = [
        (e.id, rows[e.id].planned_minutes if e.id in rows else e.minutes_per_day)
        for e in planned_exams
        if not (e.id in rows and rows[e.id].status == StudySessionStatus.completed)
    ]
    if pending:
        agenda = await schedule_service.day(db, user_id, on)
        after = local_now(timezone).time() if on == user_today(timezone) else None
        windows = [Window(w.start, w.end) for w in agenda.free]
        slots = suggest_slots(windows, pending, after)

    sessions = [_session_out(e, on, rows.get(e.id), slots.get(e.id)) for e in planned_exams]
    return StudyDayOut(
        date=on,
        sessions=sessions,
        planned=len(sessions),
        completed=sum(1 for s in sessions if s.status == StudySessionStatus.completed),
        total_minutes=sum(s.planned_minutes for s in sessions),
    )


async def get_session(db: AsyncSession, user_id: UUID, session_id: UUID) -> StudySession:
    s = await db.get(StudySession, session_id)
    if s is None or s.user_id != user_id or s.exam.deleted_at is not None:
        raise NotFoundError("Sessão de estudo não encontrada.")
    return s


async def session_for(
    db: AsyncSession, user_id: UUID, timezone: str, exam_id: UUID, on: date
) -> StudySessionOut:
    """Uma sessão (real ou planejada) de uma prova num dia, com a sugestão de horário."""
    overview = await day_overview(db, user_id, timezone, on)
    found = next((s for s in overview.sessions if s.exam_id == exam_id), None)
    if found is not None:
        return found
    e = await get_exam(db, user_id, exam_id)
    return _session_out(e, on, None, None)


async def start_session(db: AsyncSession, user: User, exam_id: UUID, on: date) -> StudySession:
    """Começa (ou retoma) a sessão do dia. Idempotente; concluída continua concluída."""
    ensure_recordable_day(on, user.timezone)
    e = await get_exam(db, user.id, exam_id)
    if e.status != ExamStatus.open:
        raise ConflictError("Essa prova já foi marcada como feita.")
    row = (await _rows_for_day(db, user.id, on)).get(e.id)
    if row is None:
        row = StudySession(
            user_id=user.id,
            exam_id=e.id,
            date=on,
            status=StudySessionStatus.in_progress,
            planned_minutes=e.minutes_per_day,
            started_at=now_utc(),
        )
        db.add(row)
    elif row.status != StudySessionStatus.completed:
        row.status = StudySessionStatus.in_progress
        row.started_at = row.started_at or now_utc()
    await db.flush()
    return await get_session(db, user.id, row.id)


async def update_session(
    db: AsyncSession, user: User, session_id: UUID, data: SessionUpdate
) -> StudySession:
    s = await get_session(db, user.id, session_id)
    ensure_recordable_day(s.date, user.timezone)
    if data.focused_seconds is not None:
        s.focused_seconds = max(s.focused_seconds, data.focused_seconds)
    if data.status is not None:
        s.status = data.status
        if data.status == StudySessionStatus.completed:
            s.completed_at = s.completed_at or now_utc()
        else:
            s.completed_at = None
        if data.status == StudySessionStatus.in_progress:
            s.started_at = s.started_at or now_utc()
    await db.flush()
    return s


# --- Saídas com derivados ----------------------------------------------------------------


def _window_days(e: Exam, timezone: str) -> list[date]:
    start, end = study_window(e, timezone)
    if end < start:
        return []
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]


async def exam_out(db: AsyncSession, e: Exam, timezone: str) -> ExamOut:
    rows = await _rows_for_exam(db, e.id)
    days = _window_days(e, timezone)
    subject = e.subject if e.subject is not None and e.subject.deleted_at is None else None
    today = user_today(timezone)
    return ExamOut(
        id=e.id,
        title=e.title,
        kind=e.kind,
        subject_id=subject.id if subject else None,
        subject_name=subject.name if subject else None,
        subject_color=subject.color if subject else None,
        date=e.date,
        lead_days=e.lead_days,
        minutes_per_day=e.minutes_per_day,
        notes=e.notes,
        status=e.status,
        done_at=e.done_at,
        days_until=(e.date - today).days,
        study_from=study_window(e, timezone)[0],
        sessions_total=len(days),
        sessions_done=sum(1 for r in rows.values() if r.status == StudySessionStatus.completed),
        topics_total=len(e.topics),
        topics_done=sum(1 for t in e.topics if t.is_done),
        topics=[TopicOut.model_validate(t) for t in e.topics],
    )


async def exam_detail(db: AsyncSession, e: Exam, timezone: str) -> ExamDetailOut:
    base = await exam_out(db, e, timezone)
    rows = await _rows_for_exam(db, e.id)
    days = _window_days(e, timezone)
    # Sessões extras (fora da janela) também aparecem, para o histórico ser honesto.
    all_days = sorted({*days, *rows.keys()})
    sessions = [_session_out(e, d, rows.get(d), None) for d in all_days]
    return ExamDetailOut(**base.model_dump(), sessions=sessions)


# --- Lixeira -----------------------------------------------------------------------------

KIND_LABEL = {ExamKind.exam: "Prova", ExamKind.assignment: "Trabalho"}


def _exam_has_sessions(model: type[Exam]):
    return exists().where(StudySession.exam_id == model.id)


TRASH_KINDS = [
    TrashKind(
        kind="exam",
        label="Provas e trabalhos",
        model=Exam,
        title=lambda e: e.title,
        subtitle=lambda e: f"{KIND_LABEL[e.kind]} · {e.date.strftime('%d/%m/%Y')}",
        history=_exam_has_sessions,
    ),
]
