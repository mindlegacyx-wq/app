"""Agenda semanal: matérias e blocos fixos (aulas, treino, estudo, outros).

Regras:
- Blocos são por dia da semana com início/fim; não podem se sobrepor no mesmo dia.
- Aulas **não entram no percentual** (não dependem de você); servem para o app saber onde
  estão os buracos do dia — as sessões de estudo (Fase 10) usam `free_windows`.
- Um bloco de treino pode apontar para um plano; é assim que o treino ganha horário por dia.
"""

from dataclasses import dataclass
from datetime import date, time
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dates import now_utc, weekday_index
from app.core.errors import ConflictError, NotFoundError
from app.core.softdelete import TrashKind
from app.modules.schedule.models import BlockKind, ScheduleBlock, Subject
from app.modules.schedule.schemas import (
    BlockIn,
    BlockOut,
    BlockUpdate,
    CopyDayOut,
    DayOut,
    SubjectIn,
    SubjectOut,
    SubjectUpdate,
    WeekDayOut,
    WeekOut,
    WindowOut,
)
from app.modules.workouts import service as workouts_service

DAY_START = time(6, 0)  # janela útil considerada para "tempo livre"
DAY_END = time(23, 0)
MIN_FREE_MINUTES = 20


# --- Matérias ----------------------------------------------------------------------------


def _alive_subjects(user_id: UUID):
    return (
        select(Subject)
        .where(Subject.user_id == user_id, Subject.deleted_at.is_(None))
        .order_by(Subject.sort_order, Subject.name)
    )


async def list_subjects(db: AsyncSession, user_id: UUID) -> list[Subject]:
    return list(await db.scalars(_alive_subjects(user_id)))


async def get_subject(db: AsyncSession, user_id: UUID, subject_id: UUID) -> Subject:
    s = await db.scalar(_alive_subjects(user_id).where(Subject.id == subject_id))
    if s is None:
        raise NotFoundError("Matéria não encontrada.")
    return s


async def create_subject(db: AsyncSession, user_id: UUID, data: SubjectIn) -> Subject:
    next_order = await db.scalar(
        select(func.coalesce(func.max(Subject.sort_order), -1) + 1).where(
            Subject.user_id == user_id
        )
    )
    s = Subject(user_id=user_id, sort_order=next_order or 0, **data.model_dump())
    db.add(s)
    await db.flush()
    return s


async def set_grade_settings(
    db: AsyncSession,
    user_id: UUID,
    subject_id: UUID,
    *,
    area_id: UUID | None = None,
    clear_area: bool = False,
    entry_mode: str | None = None,
) -> Subject:
    """Ajustes que pertencem às notas (área e modo de lançamento) numa matéria.

    Fica aqui porque quem mexe na tabela `subjects` é este módulo; o módulo de notas chama
    este serviço em vez de escrever direto.
    """
    s = await get_subject(db, user_id, subject_id)
    if clear_area:
        s.area_id = None
    elif area_id is not None:
        s.area_id = area_id
    if entry_mode in ("final", "items"):
        s.grade_entry_mode = entry_mode
    await db.flush()
    return s


async def assign_area(
    db: AsyncSession, user_id: UUID, area_id: UUID, subject_ids: list[UUID]
) -> list[Subject]:
    """Deixa a área com exatamente estas matérias.

    Quem estava na área e não veio na lista sai dela (fica sem área, com as notas intactas).
    O módulo de notas chama este serviço porque a tabela `subjects` é deste módulo.
    """
    todas = await list_subjects(db, user_id)
    por_id = {s.id: s for s in todas}
    faltando = [sid for sid in subject_ids if sid not in por_id]
    if faltando:
        raise NotFoundError("Matéria não encontrada.")
    escolhidas = set(subject_ids)
    for s in todas:
        if s.id in escolhidas:
            s.area_id = area_id
        elif s.area_id == area_id:
            s.area_id = None
    await db.flush()
    return todas


async def set_subject_order(db: AsyncSession, user_id: UUID, subject_ids: list[UUID]) -> None:
    """Renumera a ordem das matérias. A lista precisa trazer todas, sem repetir."""
    todas = await list_subjects(db, user_id)
    por_id = {s.id: s for s in todas}
    if len(set(subject_ids)) != len(subject_ids) or set(subject_ids) != set(por_id):
        raise ConflictError("A lista de matérias está desatualizada. Recarregue e tente de novo.")
    for posicao, sid in enumerate(subject_ids):
        por_id[sid].sort_order = posicao
    await db.flush()


async def update_subject(
    db: AsyncSession, user_id: UUID, subject_id: UUID, data: SubjectUpdate
) -> Subject:
    s = await get_subject(db, user_id, subject_id)
    fields = data.model_dump(exclude_unset=True, exclude={"clear_teacher"})
    for k, v in fields.items():
        setattr(s, k, v)
    if data.clear_teacher:
        s.teacher = None
    await db.flush()
    return s


async def delete_subject(db: AsyncSession, user_id: UUID, subject_id: UUID) -> None:
    s = await get_subject(db, user_id, subject_id)
    s.deleted_at = now_utc()
    await db.flush()


# --- Blocos: consultas -------------------------------------------------------------------


def _alive_blocks(user_id: UUID):
    return (
        select(ScheduleBlock)
        .where(ScheduleBlock.user_id == user_id, ScheduleBlock.deleted_at.is_(None))
        .order_by(ScheduleBlock.weekday, ScheduleBlock.start_time)
    )


async def list_blocks(db: AsyncSession, user_id: UUID) -> list[ScheduleBlock]:
    return list((await db.scalars(_alive_blocks(user_id))).unique())


async def get_block(db: AsyncSession, user_id: UUID, block_id: UUID) -> ScheduleBlock:
    b = (
        (await db.scalars(_alive_blocks(user_id).where(ScheduleBlock.id == block_id)))
        .unique()
        .one_or_none()
    )
    if b is None:
        raise NotFoundError("Bloco não encontrado.")
    return b


def _minutes(a: time, b: time) -> int:
    return (b.hour * 60 + b.minute) - (a.hour * 60 + a.minute)


def to_out(b: ScheduleBlock) -> BlockOut:
    subject = b.subject if b.subject is not None and b.subject.deleted_at is None else None
    return BlockOut(
        id=b.id,
        title=b.title,
        kind=b.kind,
        subject_id=subject.id if subject else None,
        subject_name=subject.name if subject else None,
        subject_color=subject.color if subject else None,
        workout_id=b.workout_id,
        weekday=b.weekday,
        start_time=b.start_time,
        end_time=b.end_time,
        duration_minutes=_minutes(b.start_time, b.end_time),
        location=b.location,
        is_active=b.is_active,
    )


async def week(db: AsyncSession, user_id: UUID) -> WeekOut:
    blocks = await list_blocks(db, user_id)
    days = []
    for wd in range(7):
        outs = [to_out(b) for b in blocks if b.weekday == wd]
        days.append(
            WeekDayOut(
                weekday=wd,
                blocks=outs,
                total_minutes=sum(o.duration_minutes for o in outs if o.is_active),
            )
        )
    subjects = [SubjectOut.model_validate(s) for s in await list_subjects(db, user_id)]
    return WeekOut(days=days, subjects=subjects)


@dataclass
class Window:
    start: time
    end: time

    @property
    def minutes(self) -> int:
        return _minutes(self.start, self.end)


def free_windows(
    blocks: list[BlockOut], day_start: time = DAY_START, day_end: time = DAY_END
) -> list[Window]:
    """Janelas livres entre blocos ativos do dia, dentro da janela útil."""
    cursor = day_start
    out: list[Window] = []
    for b in sorted((x for x in blocks if x.is_active), key=lambda x: x.start_time):
        if b.start_time > cursor:
            w = Window(cursor, min(b.start_time, day_end))
            if w.minutes >= MIN_FREE_MINUTES:
                out.append(w)
        if b.end_time > cursor:
            cursor = b.end_time
        if cursor >= day_end:
            break
    if cursor < day_end:
        w = Window(cursor, day_end)
        if w.minutes >= MIN_FREE_MINUTES:
            out.append(w)
    return out


async def day(db: AsyncSession, user_id: UUID, on: date) -> DayOut:
    wd = weekday_index(on)
    blocks = [to_out(b) for b in await list_blocks(db, user_id) if b.weekday == wd]
    return DayOut(
        date=on,
        weekday=wd,
        blocks=blocks,
        free=[WindowOut(start=w.start, end=w.end, minutes=w.minutes) for w in free_windows(blocks)],
    )


# --- Blocos: escrita ---------------------------------------------------------------------


async def _check_overlap(
    db: AsyncSession,
    user_id: UUID,
    weekday: int,
    start: time,
    end: time,
    ignore_id: UUID | None = None,
) -> None:
    stmt = _alive_blocks(user_id).where(
        ScheduleBlock.weekday == weekday,
        ScheduleBlock.is_active.is_(True),
        ScheduleBlock.start_time < end,
        ScheduleBlock.end_time > start,
    )
    if ignore_id is not None:
        stmt = stmt.where(ScheduleBlock.id != ignore_id)
    clash = (await db.scalars(stmt)).unique().first()
    if clash is not None:
        raise ConflictError(
            f'Conflita com "{clash.title}" ({clash.start_time:%H:%M}–{clash.end_time:%H:%M}).'
        )


async def _validate_refs(
    db: AsyncSession, user_id: UUID, subject_id: UUID | None, workout_id: UUID | None
) -> None:
    if subject_id is not None:
        await get_subject(db, user_id, subject_id)
    if workout_id is not None:
        await workouts_service.get_workout(db, user_id, workout_id)


async def create_blocks(db: AsyncSession, user_id: UUID, data: BlockIn) -> list[ScheduleBlock]:
    """Cria o mesmo bloco em cada dia pedido. Se algum dia conflitar, nada é criado."""
    await _validate_refs(db, user_id, data.subject_id, data.workout_id)
    for wd in data.weekdays:
        await _check_overlap(db, user_id, wd, data.start_time, data.end_time)
    created: list[ScheduleBlock] = []
    for wd in data.weekdays:
        b = ScheduleBlock(
            user_id=user_id,
            title=data.title,
            kind=data.kind,
            subject_id=data.subject_id,
            workout_id=data.workout_id,
            weekday=wd,
            start_time=data.start_time,
            end_time=data.end_time,
            location=data.location,
            is_active=True,
        )
        db.add(b)
        created.append(b)
    await db.flush()
    if data.kind == BlockKind.workout and data.workout_id is not None:
        await workouts_service.ensure_days(db, user_id, data.workout_id, data.weekdays)
    return [await get_block(db, user_id, b.id) for b in created]


async def update_block(
    db: AsyncSession, user_id: UUID, block_id: UUID, data: BlockUpdate
) -> ScheduleBlock:
    b = await get_block(db, user_id, block_id)
    fields = data.model_dump(
        exclude_unset=True, exclude={"clear_subject", "clear_workout", "clear_location"}
    )
    subject_id = fields.get("subject_id", b.subject_id)
    workout_id = fields.get("workout_id", b.workout_id)
    if data.clear_subject:
        subject_id = None
    if data.clear_workout:
        workout_id = None
    await _validate_refs(
        db,
        user_id,
        subject_id if subject_id != b.subject_id else None,
        workout_id if workout_id != b.workout_id else None,
    )
    weekday = fields.get("weekday", b.weekday)
    start = fields.get("start_time", b.start_time)
    end = fields.get("end_time", b.end_time)
    if end <= start:
        raise ConflictError("O fim precisa ser depois do início.")
    active = fields.get("is_active", b.is_active)
    if active:
        await _check_overlap(db, user_id, weekday, start, end, ignore_id=b.id)
    for k, v in fields.items():
        if k not in {"subject_id", "workout_id"}:
            setattr(b, k, v)
    b.subject_id = subject_id
    b.workout_id = workout_id
    if data.clear_location:
        b.location = None
    await db.flush()
    if b.kind == BlockKind.workout and b.workout_id is not None and b.is_active:
        await workouts_service.ensure_days(db, user_id, b.workout_id, [b.weekday])
    db.expire(b, ["subject"])
    return await get_block(db, user_id, b.id)


async def delete_block(db: AsyncSession, user_id: UUID, block_id: UUID) -> None:
    b = await get_block(db, user_id, block_id)
    b.deleted_at = now_utc()
    await db.flush()


async def copy_day(
    db: AsyncSession, user_id: UUID, from_weekday: int, to_weekdays: list[int]
) -> CopyDayOut:
    """Duplica os blocos de um dia para outros dias, pulando os que conflitam."""
    source = [b for b in await list_blocks(db, user_id) if b.weekday == from_weekday]
    created = skipped = 0
    for wd in to_weekdays:
        if wd == from_weekday:
            continue
        for b in source:
            try:
                await _check_overlap(db, user_id, wd, b.start_time, b.end_time)
            except ConflictError:
                skipped += 1
                continue
            db.add(
                ScheduleBlock(
                    user_id=user_id,
                    title=b.title,
                    kind=b.kind,
                    subject_id=b.subject_id,
                    workout_id=b.workout_id,
                    weekday=wd,
                    start_time=b.start_time,
                    end_time=b.end_time,
                    location=b.location,
                    is_active=b.is_active,
                )
            )
            await db.flush()
            created += 1
            if b.kind == BlockKind.workout and b.workout_id is not None and b.is_active:
                await workouts_service.ensure_days(db, user_id, b.workout_id, [wd])
    return CopyDayOut(created=created, skipped=skipped)


# --- Lixeira -----------------------------------------------------------------------------

KIND_LABEL = {"class": "Aula", "workout": "Treino", "study": "Estudo", "other": "Outro"}
WEEKDAY_LABEL = ("seg", "ter", "qua", "qui", "sex", "sáb", "dom")

TRASH_KINDS = [
    TrashKind(
        kind="subject",
        label="Matérias",
        model=Subject,
        title=lambda s: s.name,
    ),
    TrashKind(
        kind="schedule_block",
        label="Blocos da agenda",
        model=ScheduleBlock,
        title=lambda b: b.title,
        subtitle=lambda b: f"{WEEKDAY_LABEL[b.weekday]} {b.start_time:%H:%M}–{b.end_time:%H:%M}",
    ),
]
