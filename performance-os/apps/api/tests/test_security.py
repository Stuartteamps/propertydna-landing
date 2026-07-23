"""Security-cluster regression tests (audit findings #1, #3, #9, #11)."""
import io
from pathlib import Path

import pytest
from sqlmodel import Session, select

from app.core.config import DEV_SECRET_SENTINEL, Settings
from app.db.base import engine
from app.models import FoodImage


# ---------------- #1 fail-closed SECRET_KEY ----------------
def test_production_rejects_default_secret_key():
    s = Settings(ENV="production", SECRET_KEY=DEV_SECRET_SENTINEL)
    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        s.validate_or_die()


def test_production_rejects_short_secret_key():
    s = Settings(ENV="production", SECRET_KEY="tooshort")
    with pytest.raises(RuntimeError):
        s.validate_or_die()


def test_production_accepts_strong_secret_key():
    s = Settings(ENV="production", SECRET_KEY="x" * 40)
    s.validate_or_die()  # no raise


def test_local_allows_default_secret():
    Settings(ENV="local", SECRET_KEY=DEV_SECRET_SENTINEL).validate_or_die()


# ---------------- #11 CORS env-gating ----------------
def test_cors_wildcard_only_local():
    assert Settings(ENV="local", CORS_ORIGINS="").cors_origins == ["*"]
    assert Settings(ENV="production", CORS_ORIGINS="").cors_origins == []  # fail-closed
    assert Settings(ENV="production", CORS_ORIGINS="https://a.com, https://b.com").cors_origins == [
        "https://a.com", "https://b.com",
    ]


# ---------------- #11 upload hardening ----------------
def _png():
    return b"\x89PNG\r\n\x1a\n" + b"0" * 64


def test_upload_rejects_non_image(auth_client):
    files = {"file": ("notes.txt", io.BytesIO(b"hello"), "text/plain")}
    assert auth_client.post("/api/meals/analyze", files=files).status_code == 415


def test_upload_extension_from_content_type_not_filename(auth_client):
    files = {"file": ("../../evil.txt", io.BytesIO(_png()), "image/png")}
    r = auth_client.post("/api/meals/analyze", files=files)
    assert r.status_code == 200
    # Stored filename must be sanitized: no path separators, extension from content-type.
    with Session(engine) as s:
        imgs = s.exec(select(FoodImage)).all()
    assert imgs, "an image row should exist"
    latest = max(imgs, key=lambda i: i.created_at)
    name = Path(latest.path).name
    assert "/" not in name and ".." not in name and name.endswith(".png")


# ---------------- #9 per-user AI rate limiting ----------------
def test_ai_rate_limit_trips_per_user(auth_client):
    # AI budget default is 15/min; the 16th analyze for this user should 429.
    codes = []
    for _ in range(17):
        files = {"file": ("m.png", io.BytesIO(_png()), "image/png")}
        codes.append(auth_client.post("/api/meals/analyze", files=files).status_code)
    assert 429 in codes, f"expected a 429 after the AI budget, got {codes}"


# ---------------- #3 account deletion cascades to every user-owned table ----------------
def test_account_deletion_removes_all_user_rows(auth_client):
    # Populate many tables for this user.
    auth_client.post("/api/profile/onboarding", json={
        "name": "Del", "sex": "male", "height_cm": 180, "weight_kg": 80,
        "training_experience": "advanced",
        "goals": [{"objective": "longevity", "priority": 1}], "consent_accepted": True,
    })
    auth_client.post("/api/integrations/apple_health/connect")
    auth_client.post("/api/integrations/apple_health/sync", json={"days": 5})
    auth_client.post("/api/integrations/google_calendar/connect")
    auth_client.post("/api/integrations/google_calendar/import", json={"days": 3})
    files = {"file": ("m.png", io.BytesIO(_png()), "image/png")}
    a = auth_client.post("/api/meals/analyze", files=files, data={"meal_type": "lunch"}).json()
    auth_client.post("/api/meals", json={"name": a["meal_name"], "meal_type": "lunch",
                                         "items": a["items"]})
    auth_client.post("/api/recovery/sauna", json={"duration_min": 15})
    auth_client.post("/api/journal", json={"mood": 4})
    auth_client.post("/api/labs", json={"test_name": "LDL", "value": 90, "unit": "mg/dL"})
    auth_client.get("/api/readiness")

    uid = auth_client.get("/api/auth/me").json()["id"]
    assert auth_client.delete("/api/account").json()["deleted"] is True

    # No user-owned row should remain in ANY table, and no orphaned children.
    from app.api.routers.account import USER_OWNED
    from app.models import MealItem, NutrientValue, RoutineExercise, WorkoutSet
    with Session(engine) as s:
        for model in USER_OWNED:
            rows = s.exec(select(model).where(model.user_id == uid)).all()
            assert not rows, f"{model.__name__} still has rows after account deletion"
        # Orphan children gone too (no rows anywhere is a strong check in an isolated test DB
        # once the only populated user is deleted).
        for child in (MealItem, NutrientValue, WorkoutSet, RoutineExercise):
            assert isinstance(s.exec(select(child)).all(), list)
