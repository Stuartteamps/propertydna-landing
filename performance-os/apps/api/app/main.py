from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import (
    account,
    auth,
    dashboard,
    integrations,
    journal,
    labs,
    meals,
    notifications,
    profile,
    readiness,
    recovery,
    routine,
    trends,
    workouts,
)
from app.core.branding import APP_NAME, APP_TAGLINE, DISCLAIMER
from app.core.config import settings
from app.core.logging import configure_logging
from app.db.base import create_db_and_tables


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging("DEBUG" if settings.DEBUG else "INFO")
    settings.validate_or_die()  # fail-closed on insecure production config (e.g. default SECRET_KEY)
    create_db_and_tables()
    yield


app = FastAPI(
    title=f"{APP_NAME} API",
    description=f"{APP_TAGLINE}\n\n{DISCLAIMER}",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,  # '*' only in local; fail-closed in prod (set CORS_ORIGINS)
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

for r in (auth, profile, dashboard, meals, workouts, integrations, readiness, routine,
          journal, recovery, labs, trends, notifications, account):
    app.include_router(r.router, prefix="/api")


@app.get("/api/health", tags=["system"])
def health() -> dict:
    return {
        "status": "ok",
        "app": APP_NAME,
        "env": settings.ENV,
        "flags": {
            "ai_provider": settings.AI_PROVIDER,
            "health_provider": settings.HEALTH_PROVIDER,
            "calendar_provider": settings.CALENDAR_PROVIDER,
            "auth_provider": settings.AUTH_PROVIDER,
        },
    }


@app.get("/", tags=["system"])
def root() -> dict:
    return {"app": APP_NAME, "docs": "/docs", "health": "/api/health"}
