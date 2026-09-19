from httpx import AsyncClient

from app.core.config import get_settings
from tests.conftest import bearer, register

COOKIE = get_settings().refresh_cookie_name


async def test_health_has_version_header(client: AsyncClient) -> None:
    r = await client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.headers["x-app-version"]
    assert r.json()["status"] == "ok"


async def test_register_returns_token_and_sets_refresh_cookie(client: AsyncClient) -> None:
    data = await register(client)
    assert data["access_token"]
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "ana@exemplo.com"
    assert data["user"]["settings"]["discipline_target"] == 80
    assert data["user"]["settings"]["onboarding_completed_at"] is None
    assert COOKIE in client.cookies


async def test_register_duplicate_email_is_conflict(client: AsyncClient) -> None:
    await register(client)
    r = await client.post(
        "/api/v1/auth/register",
        json={"email": "ANA@exemplo.com", "password": "outra-senha-123", "name": "Ana 2"},
    )
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "conflict"


async def test_register_validates_password_length(client: AsyncClient) -> None:
    r = await client.post(
        "/api/v1/auth/register", json={"email": "x@exemplo.com", "password": "curta", "name": "X"}
    )
    assert r.status_code == 422
    body = r.json()["error"]
    assert body["code"] == "validation_error"
    assert any(f["field"] == "password" for f in body["details"]["fields"])


async def test_login_ok_and_wrong_password_same_message(client: AsyncClient) -> None:
    await register(client)
    ok = await client.post(
        "/api/v1/auth/login", json={"email": "ana@exemplo.com", "password": "senha-forte-123"}
    )
    assert ok.status_code == 200
    assert ok.json()["access_token"]

    wrong = await client.post(
        "/api/v1/auth/login", json={"email": "ana@exemplo.com", "password": "errada-123"}
    )
    missing = await client.post(
        "/api/v1/auth/login", json={"email": "ninguem@exemplo.com", "password": "errada-123"}
    )
    assert wrong.status_code == missing.status_code == 401
    assert wrong.json()["error"]["message"] == missing.json()["error"]["message"]


async def test_me_requires_token(client: AsyncClient) -> None:
    r = await client.get("/api/v1/users/me")
    assert r.status_code == 401
    r = await client.get("/api/v1/users/me", headers=bearer("token-invalido"))
    assert r.status_code == 401


async def test_refresh_rotates_token_and_old_one_stops_working(client: AsyncClient) -> None:
    await register(client)
    old_cookie = client.cookies[COOKIE]

    r = await client.post("/api/v1/auth/refresh")
    assert r.status_code == 200
    new_cookie = client.cookies[COOKIE]
    assert new_cookie != old_cookie

    # Reutilizar o refresh antigo tem que falhar (rotação).
    client.cookies.clear()
    client.cookies.set(COOKIE, old_cookie)
    r = await client.post("/api/v1/auth/refresh")
    assert r.status_code == 401


async def test_logout_revokes_session_and_access_token_dies(client: AsyncClient) -> None:
    data = await register(client)
    token = data["access_token"]
    assert (await client.get("/api/v1/users/me", headers=bearer(token))).status_code == 200

    r = await client.post("/api/v1/auth/logout")
    assert r.status_code == 204

    # O access token ainda não expirou, mas a sessão foi revogada: precisa cair.
    r = await client.get("/api/v1/users/me", headers=bearer(token))
    assert r.status_code == 401


async def test_sessions_list_and_revoke(client: AsyncClient) -> None:
    data = await register(client)
    token = data["access_token"]
    await client.post(
        "/api/v1/auth/login", json={"email": "ana@exemplo.com", "password": "senha-forte-123"}
    )

    r = await client.get("/api/v1/auth/sessions", headers=bearer(token))
    assert r.status_code == 200
    sessions = r.json()
    assert len(sessions) == 2
    current = [s for s in sessions if s["is_current"]]
    other = [s for s in sessions if not s["is_current"]]
    assert len(current) == 1 and len(other) == 1

    r = await client.delete(f"/api/v1/auth/sessions/{other[0]['id']}", headers=bearer(token))
    assert r.status_code == 204
    r = await client.get("/api/v1/auth/sessions", headers=bearer(token))
    assert len(r.json()) == 1


async def test_user_cannot_revoke_another_users_session(client: AsyncClient) -> None:
    """Isolamento multiusuário: A não enxerga nem revoga sessão de B."""
    a = await register(client, email="a@exemplo.com")
    client.cookies.clear()
    b = await register(client, email="b@exemplo.com")

    b_sessions = (
        await client.get("/api/v1/auth/sessions", headers=bearer(b["access_token"]))
    ).json()
    a_sessions = (
        await client.get("/api/v1/auth/sessions", headers=bearer(a["access_token"]))
    ).json()
    assert {s["id"] for s in a_sessions}.isdisjoint({s["id"] for s in b_sessions})

    r = await client.delete(
        f"/api/v1/auth/sessions/{b_sessions[0]['id']}", headers=bearer(a["access_token"])
    )
    assert r.status_code == 404

    # A sessão de B continua válida.
    r = await client.get("/api/v1/users/me", headers=bearer(b["access_token"]))
    assert r.status_code == 200


async def test_auth_rate_limit(client: AsyncClient) -> None:
    from app.core.ratelimit import auth_limiter

    auth_limiter.limit = 3
    try:
        for _ in range(3):
            await client.post(
                "/api/v1/auth/login", json={"email": "x@exemplo.com", "password": "qualquer-1"}
            )
        r = await client.post(
            "/api/v1/auth/login", json={"email": "x@exemplo.com", "password": "qualquer-1"}
        )
        assert r.status_code == 429
        assert r.json()["error"]["code"] == "rate_limited"
    finally:
        auth_limiter.limit = 1000
        auth_limiter.reset()
