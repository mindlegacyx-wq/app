from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response, status

from app.core.config import get_settings
from app.core.deps import DB, CurrentUser
from app.core.ratelimit import client_ip, limit_auth
from app.core.security import decode_access_token
from app.modules.auth import service
from app.modules.auth.schemas import LoginIn, RegisterIn, SessionOut, SignupPolicyOut, TokenOut
from app.modules.auth.service import IssuedTokens
from app.modules.users.schemas import UserOut

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_PATH = "/api/v1/auth"


def _set_refresh_cookie(response: Response, raw: str) -> None:
    s = get_settings()
    response.set_cookie(
        key=s.refresh_cookie_name,
        value=raw,
        max_age=s.refresh_token_days * 24 * 3600,
        httponly=True,
        secure=s.cookie_secure,
        samesite="strict",
        path=REFRESH_PATH,
    )


def _clear_refresh_cookie(response: Response) -> None:
    s = get_settings()
    response.delete_cookie(key=s.refresh_cookie_name, path=REFRESH_PATH)


def _token_out(issued: IssuedTokens) -> TokenOut:
    return TokenOut(
        access_token=issued.access_token,
        expires_in=get_settings().access_token_minutes * 60,
        user=UserOut.model_validate(issued.user),
    )


@router.get("/signup-policy", response_model=SignupPolicyOut)
async def signup_policy() -> SignupPolicyOut:
    """A tela de criar conta pergunta aqui se precisa mostrar o campo de código de convite."""
    return SignupPolicyOut(invite_required=get_settings().invite_required)


@router.post(
    "/register",
    response_model=TokenOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(limit_auth)],
)
async def register(data: RegisterIn, request: Request, response: Response, db: DB) -> TokenOut:
    issued = await service.register(
        db,
        email=data.email,
        password=data.password,
        name=data.name,
        invite_code=data.invite_code,
        user_agent=request.headers.get("user-agent"),
        ip=client_ip(request),
    )
    await db.commit()
    _set_refresh_cookie(response, issued.refresh_token)
    return _token_out(issued)


@router.post("/login", response_model=TokenOut, dependencies=[Depends(limit_auth)])
async def login(data: LoginIn, request: Request, response: Response, db: DB) -> TokenOut:
    issued = await service.login(
        db,
        email=data.email,
        password=data.password,
        user_agent=request.headers.get("user-agent"),
        ip=client_ip(request),
    )
    await db.commit()
    _set_refresh_cookie(response, issued.refresh_token)
    return _token_out(issued)


@router.post("/refresh", response_model=TokenOut)
async def refresh(request: Request, response: Response, db: DB) -> TokenOut:
    raw = request.cookies.get(get_settings().refresh_cookie_name, "")
    try:
        issued = await service.refresh(
            db,
            raw_refresh_token=raw,
            user_agent=request.headers.get("user-agent"),
            ip=client_ip(request),
        )
    except Exception:
        _clear_refresh_cookie(response)
        raise
    await db.commit()
    _set_refresh_cookie(response, issued.refresh_token)
    return _token_out(issued)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request, response: Response, db: DB) -> None:
    await service.logout(
        db, raw_refresh_token=request.cookies.get(get_settings().refresh_cookie_name)
    )
    await db.commit()
    _clear_refresh_cookie(response)


@router.get("/sessions", response_model=list[SessionOut])
async def list_sessions(request: Request, user: CurrentUser, db: DB) -> list[SessionOut]:
    payload = decode_access_token(request.headers["authorization"][7:].strip()) or {}
    current_sid = payload.get("sid")
    out: list[SessionOut] = []
    for s in await service.list_sessions(db, user.id):
        item = SessionOut.model_validate(s)
        item.is_current = str(s.id) == current_sid
        out.append(item)
    return out


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_session(session_id: UUID, user: CurrentUser, db: DB) -> None:
    await service.revoke_session(db, user.id, session_id)
    await db.commit()
