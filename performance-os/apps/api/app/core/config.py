"""Application settings & feature flags. All secrets come from env vars."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]  # apps/api


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(BASE_DIR / ".env", BASE_DIR.parents[1] / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Core ---
    ENV: str = "local"
    DEBUG: bool = True
    SECRET_KEY: str = "dev-insecure-change-me-please-override-in-production-32b+"  # override in prod
    ACCESS_TOKEN_TTL_MINUTES: int = 60 * 24 * 7  # 7 days for demo convenience

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

    # --- Rate limiting (simple in-memory token bucket) ---
    RATE_LIMIT_PER_MINUTE: int = 120


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
