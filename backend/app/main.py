"""Ponto de entrada da API."""

from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app import APP_NAME, APP_VERSION
from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.modules.alarms.router import router as wake_router
from app.modules.auth.router import router as auth_router
from app.modules.progress.router import router as progress_router
from app.modules.routines.router import router as routines_router
from app.modules.tasks.router import router as tasks_router
from app.modules.users.router import router as users_router

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    scheduler = None
    if settings.scheduler_enabled:
        from app.core.scheduler import build_scheduler

        scheduler = build_scheduler()
        scheduler.start()
    try:
        yield
    finally:
        if scheduler is not None:
            scheduler.shutdown(wait=False)


app = FastAPI(
    title=f"{APP_NAME} API",
    version=APP_VERSION,
    docs_url="/api/docs" if not settings.is_prod else None,
    redoc_url=None,
    openapi_url="/api/openapi.json" if not settings.is_prod else None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-App-Version"],
)

register_error_handlers(app)


@app.middleware("http")
async def add_version_header(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    response = await call_next(request)
    response.headers["X-App-Version"] = APP_VERSION
    return response


@app.get("/api/v1/health", tags=["meta"])
async def health() -> dict[str, str]:
    return {"status": "ok", "name": APP_NAME, "version": APP_VERSION}


app.include_router(auth_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(routines_router, prefix="/api/v1")
app.include_router(wake_router, prefix="/api/v1")
app.include_router(tasks_router, prefix="/api/v1")
app.include_router(progress_router, prefix="/api/v1")
