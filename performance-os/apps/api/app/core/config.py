"""Application settings & feature flags. All secrets come from env vars."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]  # apps/api

# Sentinel dev key: usable in local dev only; production boot aborts if this is still set.
DEV_SECRET_SENTINEL = "dev-insecure-change-me-please-override-in-production-32b+"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(BASE_DIR / ".env", BASE_DIR.parents[1] / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Core ---
    ENV: str = "local"                 # local | staging | production
    DEBUG: bool = True
    # Dev-only fallback. Production MUST override via env or boot aborts (see validate_or_die).
    SECRET_KEY: str = DEV_SECRET_SENTINEL
    ACCESS_TOKEN_TTL_MINUTES: int = 60 * 24 * 7  # 7 days for demo convenience

    # --- CORS ---  comma-separated allowed origins; '*' only permitted when ENV=local
    CORS_ORIGINS: str = ""

    # --- Database ---  (SQLite for zero-credential demo; swap to Postgres/Supabase)
    DATABASE_URL: str = f"sqlite:///{BASE_DIR / 'performance_os.db'}"

    # --- Feature flags: mock vs real integrations ---
    AI_PROVIDER: str = "mock"          # mock | openai | anthropic
    HEALTH_PROVIDER: str = "mock"      # mock | healthkit (device bridge)
    CALENDAR_PROVIDER: str = "mock"    # mock | google
    AUTH_PROVIDER: str = "local"       # local | supabase

    # --- Optional real credentials (never required for demo) ---
    AI_PROVIDER_API_KEY: str | None = None
    AI_MODEL: str | None = None          # override; sensible per-vendor default otherwise
    AI_TIMEOUT_SECONDS: float = 45.0
    SUPABASE_URL: str | None = None
    SUPABASE_ANON_KEY: str | None = None
    SUPABASE_SERVICE_ROLE_KEY: str | None = None
    GOOGLE_CLIENT_ID: str | None = None
    GOOGLE_CLIENT_SECRET: str | None = None
    GOOGLE_REDIRECT_URI: str | None = None

    # --- Storage ---
    UPLOAD_DIR: str = str(BASE_DIR / "uploads")

    # --- Safety guardrails (see engines/nutrition.py) ---
    MIN_CALORIE_FLOOR_MALE: int = 1500
    MIN_CALORIE_FLOOR_FEMALE: int = 1200
    MAX_DAILY_DEFICIT: int = 750     # never recommend a deficit larger than this
    MAX_WEEKLY_TARGET_CHANGE: int = 150  # gradual weekly calorie adjustments only

    # --- Rate limiting (simple in-memory token bucket; pluggable store for multi-worker) ---
    RATE_LIMIT_PER_MINUTE: int = 120
    AI_RATE_LIMIT_PER_MINUTE: int = 15      # stricter budget for expensive AI/vision routes

    # --- Uploads ---
    MAX_UPLOAD_BYTES: int = 10 * 1024 * 1024  # 10 MB per image

    @property
    def is_production(self) -> bool:
        return self.ENV in ("staging", "production")

    @property
    def cors_origins(self) -> list[str]:
        if self.CORS_ORIGINS.strip():
            return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]
        # No explicit origins: permissive only in local dev, fail-closed otherwise.
        return ["*"] if not self.is_production else []

    def validate_or_die(self) -> None:
        """Fail-closed checks run at startup. Prevents shipping insecure defaults to prod."""
        if self.is_production:
            if self.SECRET_KEY == DEV_SECRET_SENTINEL or len(self.SECRET_KEY) < 32:
                raise RuntimeError(
                    "SECRET_KEY must be set to a strong (>=32 char) value in production. "
                    "Generate one: `openssl rand -hex 32` and set it (e.g. `fly secrets set "
                    "SECRET_KEY=...`). Refusing to start with the development key."
                )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
