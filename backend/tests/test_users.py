from httpx import AsyncClient

from tests.conftest import bearer, register


async def test_update_profile_and_settings(client: AsyncClient) -> None:
    token = (await register(client))["access_token"]

    r = await client.patch(
        "/api/v1/users/me",
        json={"name": "Ana Paula", "timezone": "Europe/Madrid"},
        headers=bearer(token),
    )
    assert r.status_code == 200
    assert r.json()["name"] == "Ana Paula"
    assert r.json()["timezone"] == "Europe/Madrid"

    r = await client.patch(
        "/api/v1/users/me/settings",
        json={"discipline_target": 90, "wake_time": "05:30:00", "notifications_enabled": False},
        headers=bearer(token),
    )
    assert r.status_code == 200
    s = r.json()["settings"]
    assert s["discipline_target"] == 90
    assert s["wake_time"] == "05:30:00"
    assert s["notifications_enabled"] is False


async def test_invalid_timezone_and_target_are_rejected(client: AsyncClient) -> None:
    token = (await register(client))["access_token"]
    r = await client.patch(
        "/api/v1/users/me", json={"timezone": "Marte/Olympus"}, headers=bearer(token)
    )
    assert r.status_code == 422
    r = await client.patch(
        "/api/v1/users/me/settings", json={"discipline_target": 20}, headers=bearer(token)
    )
    assert r.status_code == 422


async def test_onboarding_completes_setup(client: AsyncClient) -> None:
    token = (await register(client))["access_token"]
    r = await client.post(
        "/api/v1/users/me/onboarding",
        json={
            "name": "Ana",
            "timezone": "America/Sao_Paulo",
            "wake_time": "06:00",
            "discipline_target": 85,
        },
        headers=bearer(token),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["settings"]["onboarding_completed_at"] is not None
    assert body["settings"]["wake_time"] == "06:00:00"
    assert body["settings"]["discipline_target"] == 85

    # /me reflete o estado salvo.
    me = (await client.get("/api/v1/users/me", headers=bearer(token))).json()
    assert me["settings"]["onboarding_completed_at"] == body["settings"]["onboarding_completed_at"]
