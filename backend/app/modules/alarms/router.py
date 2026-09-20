from datetime import date, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, File, Form, Query, UploadFile, status
from fastapi.responses import Response

from app.core.dates import user_today
from app.core.deps import DB, CurrentUser
from app.core.errors import AppError
from app.modules.alarms import service
from app.modules.alarms.models import MAX_SOUND_BYTES
from app.modules.alarms.schemas import (
    AlarmIn,
    AlarmOut,
    AlarmsOut,
    AlarmUpdate,
    SoundOut,
    WakeConfirmIn,
    WakeDayOut,
    WakeHistoryOut,
    WakeRingIn,
)

MAX_HISTORY_DAYS = 366

# --- /wake: estado de acordar do dia -----------------------------------------------------

wake_router = APIRouter(prefix="/wake", tags=["wake"])


@wake_router.get("/day", response_model=WakeDayOut)
async def wake_day(
    user: CurrentUser,
    db: DB,
    on: Annotated[date | None, Query(alias="date")] = None,
) -> WakeDayOut:
    day = on or user_today(user.timezone)
    return await service.day_status(db, user.id, user.timezone, user.settings.wake_time, day)


@wake_router.post("/confirm", response_model=WakeDayOut)
async def confirm(data: WakeConfirmIn, user: CurrentUser, db: DB) -> WakeDayOut:
    out = await service.confirm(db, user.id, user.timezone, user.settings.wake_time, data.date)
    await db.commit()
    return out


@wake_router.post("/ring", response_model=WakeDayOut)
async def ring(data: WakeRingIn, user: CurrentUser, db: DB) -> WakeDayOut:
    """Disparo pedido pelo app aberto na hora do alarme (mesma regra do job, idempotente)."""
    out = await service.ring(db, user, data.alarm_id)
    await db.commit()
    return out


@wake_router.post("/snooze", response_model=WakeDayOut)
async def snooze(user: CurrentUser, db: DB) -> WakeDayOut:
    out = await service.snooze(db, user.id, user.timezone, user.settings.wake_time)
    await db.commit()
    return out


@wake_router.delete("/day", status_code=status.HTTP_204_NO_CONTENT)
async def undo(user: CurrentUser, db: DB, on: Annotated[date, Query(alias="date")]) -> None:
    await service.undo_manual(db, user.id, user.timezone, on)
    await db.commit()


@wake_router.get("/history", response_model=WakeHistoryOut)
async def wake_history(
    user: CurrentUser,
    db: DB,
    start: Annotated[date | None, Query()] = None,
    end: Annotated[date | None, Query()] = None,
) -> WakeHistoryOut:
    today = user_today(user.timezone)
    end = end or today
    start = start or end - timedelta(days=29)
    if start > end:
        raise AppError("A data inicial precisa vir antes da final.")
    if (end - start).days >= MAX_HISTORY_DAYS:
        raise AppError("Período máximo de um ano.")
    return await service.history(db, user.id, user.timezone, start, end)


# --- /alarms: cadastro -------------------------------------------------------------------

alarms_router = APIRouter(prefix="/alarms", tags=["alarms"])


@alarms_router.get("", response_model=AlarmsOut)
async def list_alarms(user: CurrentUser, db: DB) -> AlarmsOut:
    return await service.overview(db, user.id, user.timezone)


@alarms_router.post("", response_model=AlarmOut, status_code=status.HTTP_201_CREATED)
async def create_alarm(data: AlarmIn, user: CurrentUser, db: DB) -> AlarmOut:
    alarm = await service.create_alarm(db, user.id, data)
    await db.commit()
    return service.to_out(alarm, user.timezone)


# --- Áudio do usuário (antes de /{alarm_id}) ---------------------------------------------


@alarms_router.get("/sounds", response_model=list[SoundOut])
async def list_sounds(user: CurrentUser, db: DB) -> list[SoundOut]:
    return await service.list_sounds(db, user.id)


@alarms_router.post("/sounds", response_model=SoundOut, status_code=status.HTTP_201_CREATED)
async def upload_sound(
    user: CurrentUser,
    db: DB,
    file: Annotated[UploadFile, File()],
    name: Annotated[str | None, Form()] = None,
) -> SoundOut:
    # Lê com teto: arquivo grande demais para de ser lido em vez de estourar a memória.
    data = await file.read(MAX_SOUND_BYTES + 1)
    label = (name or file.filename or "Meu áudio").rsplit(".", 1)[0]
    row = await service.create_sound(db, user.id, label, file.content_type or "", data)
    await db.commit()
    return SoundOut.model_validate(row)


@alarms_router.get("/sounds/{sound_id}/file")
async def sound_file(sound_id: UUID, user: CurrentUser, db: DB) -> Response:
    row = await service.get_sound(db, user.id, sound_id)
    return Response(
        content=row.data,
        media_type=row.content_type,
        headers={
            # O arquivo nunca muda (troca = novo id): pode ficar guardado no aparelho.
            "Cache-Control": "private, max-age=31536000, immutable",
            "Content-Disposition": "inline",
        },
    )


@alarms_router.delete("/sounds/{sound_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sound(sound_id: UUID, user: CurrentUser, db: DB) -> None:
    await service.delete_sound(db, user.id, sound_id)
    await db.commit()


@alarms_router.get("/{alarm_id}", response_model=AlarmOut)
async def get_alarm(alarm_id: UUID, user: CurrentUser, db: DB) -> AlarmOut:
    return service.to_out(await service.get_alarm(db, user.id, alarm_id), user.timezone)


@alarms_router.patch("/{alarm_id}", response_model=AlarmOut)
async def update_alarm(alarm_id: UUID, data: AlarmUpdate, user: CurrentUser, db: DB) -> AlarmOut:
    alarm = await service.update_alarm(db, user.id, alarm_id, data)
    await db.commit()
    return service.to_out(alarm, user.timezone)


@alarms_router.delete("/{alarm_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alarm(alarm_id: UUID, user: CurrentUser, db: DB) -> None:
    await service.delete_alarm(db, user.id, alarm_id)
    await db.commit()
