from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, status

from app.core.dates import user_today
from app.core.deps import DB, CurrentUser
from app.modules.studies import service
from app.modules.studies.models import ExamStatus
from app.modules.studies.schemas import (
    ExamDetailOut,
    ExamIn,
    ExamOut,
    ExamUpdate,
    SessionStartIn,
    SessionUpdate,
    StudyDayOut,
    StudySessionOut,
    TopicIn,
    TopicOut,
    TopicUpdate,
)

# --- /exams ------------------------------------------------------------------------------

exams_router = APIRouter(prefix="/exams", tags=["exams"])


@exams_router.get("", response_model=list[ExamOut])
async def list_exams(
    user: CurrentUser,
    db: DB,
    include_past: Annotated[bool, Query(description="Inclui passadas e feitas")] = False,
) -> list[ExamOut]:
    today = user_today(user.timezone)
    exams = await service.list_exams(db, user.id)
    if not include_past:
        exams = [e for e in exams if e.status == ExamStatus.open and e.date >= today]
    return [await service.exam_out(db, e, user.timezone) for e in exams]


@exams_router.post("", response_model=ExamDetailOut, status_code=status.HTTP_201_CREATED)
async def create_exam(data: ExamIn, user: CurrentUser, db: DB) -> ExamDetailOut:
    e = await service.create_exam(db, user.id, data)
    await db.commit()
    return await service.exam_detail(db, e, user.timezone)


@exams_router.get("/{exam_id}", response_model=ExamDetailOut)
async def get_exam(exam_id: UUID, user: CurrentUser, db: DB) -> ExamDetailOut:
    e = await service.get_exam(db, user.id, exam_id)
    return await service.exam_detail(db, e, user.timezone)


@exams_router.patch("/{exam_id}", response_model=ExamDetailOut)
async def update_exam(exam_id: UUID, data: ExamUpdate, user: CurrentUser, db: DB) -> ExamDetailOut:
    e = await service.update_exam(db, user.id, exam_id, data)
    await db.commit()
    return await service.exam_detail(db, e, user.timezone)


@exams_router.delete("/{exam_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_exam(exam_id: UUID, user: CurrentUser, db: DB) -> None:
    await service.delete_exam(db, user.id, exam_id)
    await db.commit()


@exams_router.post(
    "/{exam_id}/topics", response_model=TopicOut, status_code=status.HTTP_201_CREATED
)
async def add_topic(exam_id: UUID, data: TopicIn, user: CurrentUser, db: DB) -> TopicOut:
    t = await service.add_topic(db, user.id, exam_id, data)
    await db.commit()
    return TopicOut.model_validate(t)


@exams_router.patch("/{exam_id}/topics/{topic_id}", response_model=TopicOut)
async def update_topic(
    exam_id: UUID, topic_id: UUID, data: TopicUpdate, user: CurrentUser, db: DB
) -> TopicOut:
    t = await service.update_topic(db, user.id, exam_id, topic_id, data)
    await db.commit()
    return TopicOut.model_validate(t)


@exams_router.delete("/{exam_id}/topics/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_topic(exam_id: UUID, topic_id: UUID, user: CurrentUser, db: DB) -> None:
    await service.delete_topic(db, user.id, exam_id, topic_id)
    await db.commit()


# --- /study ------------------------------------------------------------------------------

study_router = APIRouter(prefix="/study", tags=["study"])


@study_router.get("/day", response_model=StudyDayOut)
async def study_day(
    user: CurrentUser,
    db: DB,
    on: Annotated[date | None, Query(alias="date")] = None,
) -> StudyDayOut:
    return await service.day_overview(db, user.id, user.timezone, on or user_today(user.timezone))


@study_router.get("/sessions/{exam_id}/{on}", response_model=StudySessionOut)
async def get_session(exam_id: UUID, on: date, user: CurrentUser, db: DB) -> StudySessionOut:
    return await service.session_for(db, user.id, user.timezone, exam_id, on)


@study_router.post("/sessions", response_model=StudySessionOut)
async def start_session(data: SessionStartIn, user: CurrentUser, db: DB) -> StudySessionOut:
    on = data.date or user_today(user.timezone)
    s = await service.start_session(db, user, data.exam_id, on)
    await db.commit()
    return await service.session_for(db, user.id, user.timezone, s.exam_id, s.date)


@study_router.patch("/sessions/{session_id}", response_model=StudySessionOut)
async def update_session(
    session_id: UUID, data: SessionUpdate, user: CurrentUser, db: DB
) -> StudySessionOut:
    s = await service.update_session(db, user, session_id, data)
    await db.commit()
    return await service.session_for(db, user.id, user.timezone, s.exam_id, s.date)
