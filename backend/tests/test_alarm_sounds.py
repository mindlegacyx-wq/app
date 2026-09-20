"""Fase 19: áudio próprio do alarme e insistência com o app fechado."""

from datetime import time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dates import local_to_utc, now_utc
from app.modules.alarms import service as alarms_service
from app.modules.alarms.models import MAX_SOUNDS_PER_USER
from app.modules.users.models import User
from tests.conftest import bearer
from tests.test_alarms import SUB, sent  # noqa: F401  (fixture do push falso)
from tests.test_routines import TZ, onboard, today

MP3 = b"ID3\x03\x00\x00\x00" + b"\x00" * 2048


def upload(
    name: str = "musica.mp3", data: bytes = MP3, ctype: str = "audio/mpeg"
) -> dict[str, Any]:
    return {"files": {"file": (name, data, ctype)}}


async def test_upload_list_download_and_delete(client: AsyncClient) -> None:
    h = bearer(await onboard(client))

    r = await client.post("/api/v1/alarms/sounds", headers=h, **upload())
    assert r.status_code == 201, r.text
    sound = r.json()
    assert sound["name"] == "musica" and sound["size_bytes"] == len(MP3)
    assert sound["content_type"] == "audio/mpeg"

    assert [s["id"] for s in (await client.get("/api/v1/alarms/sounds", headers=h)).json()] == [
        sound["id"]
    ]

    r = await client.get(f"/api/v1/alarms/sounds/{sound['id']}/file", headers=h)
    assert r.status_code == 200
    assert r.content == MP3
    assert r.headers["content-type"].startswith("audio/mpeg")
    assert "immutable" in r.headers["cache-control"]

    assert (
        await client.delete(f"/api/v1/alarms/sounds/{sound['id']}", headers=h)
    ).status_code == 204
    assert (await client.get("/api/v1/alarms/sounds", headers=h)).json() == []


async def test_rejects_bad_format_and_too_many(client: AsyncClient) -> None:
    h = bearer(await onboard(client))

    r = await client.post(
        "/api/v1/alarms/sounds", headers=h, **upload("foto.png", b"\x89PNG", "image/png")
    )
    assert r.status_code == 400 and "áudio" in r.json()["error"]["message"].lower()

    for i in range(MAX_SOUNDS_PER_USER):
        assert (
            await client.post("/api/v1/alarms/sounds", headers=h, **upload(f"som{i}.mp3"))
        ).status_code == 201
    r = await client.post("/api/v1/alarms/sounds", headers=h, **upload("mais.mp3"))
    assert r.status_code == 409


async def test_sound_belongs_to_its_owner(client: AsyncClient) -> None:
    h = bearer(await onboard(client))
    sound = (await client.post("/api/v1/alarms/sounds", headers=h, **upload())).json()

    other = bearer(await onboard(client, email="outro-som@exemplo.com"))
    assert (
        await client.get(f"/api/v1/alarms/sounds/{sound['id']}/file", headers=other)
    ).status_code == 404
    alarm = (await client.get("/api/v1/alarms", headers=other)).json()["alarms"][0]
    r = await client.patch(
        f"/api/v1/alarms/{alarm['id']}", json={"sound_file_id": sound["id"]}, headers=other
    )
    assert r.status_code == 404


async def test_alarm_uses_the_sound_and_goes_back_when_it_is_deleted(client: AsyncClient) -> None:
    h = bearer(await onboard(client))
    sound = (await client.post("/api/v1/alarms/sounds", headers=h, **upload())).json()
    alarm = (await client.get("/api/v1/alarms", headers=h)).json()["alarms"][0]

    r = await client.patch(
        f"/api/v1/alarms/{alarm['id']}", json={"sound_file_id": sound["id"]}, headers=h
    )
    assert r.status_code == 200 and r.json()["sound_file_id"] == sound["id"]

    await client.delete(f"/api/v1/alarms/sounds/{sound['id']}", headers=h)
    again = (await client.get(f"/api/v1/alarms/{alarm['id']}", headers=h)).json()
    assert again["sound_file_id"] is None  # volta para o som pronto, sem alarme mudo

    # e dá para voltar ao som pronto de propósito
    sound2 = (await client.post("/api/v1/alarms/sounds", headers=h, **upload())).json()
    await client.patch(
        f"/api/v1/alarms/{alarm['id']}", json={"sound_file_id": sound2["id"]}, headers=h
    )
    r = await client.patch(
        f"/api/v1/alarms/{alarm['id']}", json={"clear_sound_file": True}, headers=h
    )
    assert r.json()["sound_file_id"] is None


async def _arm_alarm(client: AsyncClient, h: dict[str, str], **patch: Any) -> tuple[str, Any]:
    """Coloca o alarme no minuto atual e devolve (id, instante do toque)."""
    alarm = (await client.get("/api/v1/alarms", headers=h)).json()["alarms"][0]
    now_local = now_utc().astimezone(ZoneInfo(TZ))
    body = {"time": now_local.strftime("%H:%M"), **patch}
    await client.patch(f"/api/v1/alarms/{alarm['id']}", json=body, headers=h)
    ring_at = local_to_utc(today(), time(now_local.hour, now_local.minute), TZ) + timedelta(
        seconds=30
    )
    return alarm["id"], ring_at


async def _user(db: AsyncSession, client: AsyncClient, h: dict[str, str]) -> User:
    me = (await client.get("/api/v1/users/me", headers=h)).json()
    return await db.scalar(select(User).where(User.id == me["id"]))  # type: ignore[arg-type,return-value]


async def test_insists_every_minute_until_confirmed(
    client: AsyncClient,
    db_session: AsyncSession,
    sent: list[dict[str, Any]],  # noqa: F811
) -> None:
    h = bearer(await onboard(client))
    await client.post("/api/v1/users/me/push/subscriptions", json=SUB, headers=h)
    _, ring_at = await _arm_alarm(client, h)
    user = await _user(db_session, client, h)

    assert await alarms_service.dispatch_for_user(db_session, user, ring_at) == 1
    for minute in (1, 2, 3):
        assert (
            await alarms_service.dispatch_for_user(
                db_session, user, ring_at + timedelta(minutes=minute)
            )
            == 1
        )
    assert len(sent) == 4  # o toque + três insistências

    # Confirmado: para de insistir.
    await client.post("/api/v1/wake/confirm", json={"date": today().isoformat()}, headers=h)
    assert (
        await alarms_service.dispatch_for_user(db_session, user, ring_at + timedelta(minutes=4))
        == 0
    )
    assert len(sent) == 4


async def test_insistence_respects_the_interval_and_can_be_turned_off(
    client: AsyncClient,
    db_session: AsyncSession,
    sent: list[dict[str, Any]],  # noqa: F811
) -> None:
    h = bearer(await onboard(client))
    await client.post("/api/v1/users/me/push/subscriptions", json=SUB, headers=h)
    _, ring_at = await _arm_alarm(client, h)
    user = await _user(db_session, client, h)

    assert await alarms_service.dispatch_for_user(db_session, user, ring_at) == 1
    # 20 segundos depois ainda é cedo (intervalo padrão: 60 s).
    assert (
        await alarms_service.dispatch_for_user(db_session, user, ring_at + timedelta(seconds=20))
        == 0
    )
    assert len(sent) == 1

    await client.post("/api/v1/wake/confirm", json={"date": today().isoformat()}, headers=h)

    # Com insist desligado, toca uma vez e pronto.
    h2 = bearer(await onboard(client, email="sem-insistencia@exemplo.com"))
    await client.post("/api/v1/users/me/push/subscriptions", json=SUB, headers=h2)
    _, ring2 = await _arm_alarm(client, h2, insist=False)
    user2 = await _user(db_session, client, h2)
    before = len(sent)
    assert await alarms_service.dispatch_for_user(db_session, user2, ring2) == 1
    assert (
        await alarms_service.dispatch_for_user(db_session, user2, ring2 + timedelta(minutes=2)) == 0
    )
    assert len(sent) == before + 1


async def test_insistence_stops_at_the_missed_limit(
    client: AsyncClient,
    db_session: AsyncSession,
    sent: list[dict[str, Any]],  # noqa: F811
) -> None:
    h = bearer(await onboard(client))
    await client.post("/api/v1/users/me/push/subscriptions", json=SUB, headers=h)
    _, ring_at = await _arm_alarm(client, h)
    user = await _user(db_session, client, h)

    await alarms_service.dispatch_for_user(db_session, user, ring_at)
    before = len(sent)
    assert (
        await alarms_service.dispatch_for_user(db_session, user, ring_at + timedelta(minutes=61))
        == 0
    )
    assert len(sent) == before
    day = (await client.get("/api/v1/wake/day", headers=h)).json()
    assert day["status"] == "missed"


async def test_payload_carries_the_chosen_sound(
    client: AsyncClient,
    db_session: AsyncSession,
    sent: list[dict[str, Any]],  # noqa: F811
) -> None:
    h = bearer(await onboard(client))
    await client.post("/api/v1/users/me/push/subscriptions", json=SUB, headers=h)
    sound = (await client.post("/api/v1/alarms/sounds", headers=h, **upload())).json()
    alarm_id, ring_at = await _arm_alarm(client, h)
    await client.patch(f"/api/v1/alarms/{alarm_id}", json={"sound_file_id": sound["id"]}, headers=h)
    user = await _user(db_session, client, h)

    await alarms_service.dispatch_for_user(db_session, user, ring_at)
    assert sent[0]["sound_file_id"] == sound["id"]


@pytest.mark.parametrize("ctype", ["audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav"])
async def test_accepts_the_usual_formats(client: AsyncClient, ctype: str) -> None:
    h = bearer(await onboard(client))
    r = await client.post("/api/v1/alarms/sounds", headers=h, **upload("som.bin", MP3, ctype))
    assert r.status_code == 201, r.text
