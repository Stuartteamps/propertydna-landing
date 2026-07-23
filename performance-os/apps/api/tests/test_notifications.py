"""Audit finding #6: notification device registration, quiet hours, enqueue + dedup."""
import datetime as dt

from app.models import NotificationPreference, User
from app.services.notifications import evaluate_and_enqueue, quiet_hours_active


def test_quiet_hours_overnight_window():
    p = NotificationPreference(user_id="x", quiet_hours_start="21:30", quiet_hours_end="05:00")
    assert quiet_hours_active(p, dt.datetime(2026, 7, 20, 22, 0))   # inside
    assert quiet_hours_active(p, dt.datetime(2026, 7, 20, 3, 0))    # inside (after midnight)
    assert not quiet_hours_active(p, dt.datetime(2026, 7, 20, 12, 0))  # midday, awake


def test_quiet_hours_same_day_window():
    p = NotificationPreference(user_id="x", quiet_hours_start="13:00", quiet_hours_end="14:00")
    assert quiet_hours_active(p, dt.datetime(2026, 7, 20, 13, 30))
    assert not quiet_hours_active(p, dt.datetime(2026, 7, 20, 15, 0))


def test_register_and_unregister_device(auth_client):
    assert auth_client.post("/api/notifications/register-device",
                            json={"token": "tok-abc", "platform": "ios"}).status_code == 201
    # idempotent
    auth_client.post("/api/notifications/register-device", json={"token": "tok-abc"})
    assert auth_client.request("DELETE", "/api/notifications/register-device",
                               params={"token": "tok-abc"}).status_code == 200


def test_protein_deficit_enqueues_and_dedupes(auth_client, client):
    from sqlmodel import Session

    from app.db.base import engine
    auth_client.post("/api/profile/onboarding", json={
        "name": "N", "sex": "male", "height_cm": 185, "weight_kg": 86,
        "training_experience": "advanced", "tz": "UTC",
        "goals": [{"objective": "muscle_gain", "priority": 1}], "consent_accepted": True,
    })
    uid = auth_client.get("/api/auth/me").json()["id"]
    # Establish today's target with a high protein goal, consumed nothing.
    auth_client.get("/api/dashboard/today")

    from app.core.timeutil import now_utc
    with Session(engine) as s:
        user = s.get(User, uid)
        # Evaluate today at 20:00 UTC (evening, outside quiet hours) — matches the target date.
        evening = now_utc().replace(hour=20, minute=0, second=0, microsecond=0)
        first = evaluate_and_enqueue(s, user, now=evening)
        kinds = {e["kind"] for e in first}
        assert "protein_deficit" in kinds
        assert any(e["status"] == "sent" for e in first if e["kind"] == "protein_deficit")
        # Dedup: a second evaluation the same local day does not re-enqueue protein_deficit.
        second = evaluate_and_enqueue(s, user, now=evening + dt.timedelta(hours=1))
        assert "protein_deficit" not in {e["kind"] for e in second}


def test_quiet_hours_suppresses(auth_client):
    from sqlmodel import Session

    from app.db.base import engine
    auth_client.post("/api/profile/onboarding", json={
        "name": "Q", "sex": "male", "height_cm": 185, "weight_kg": 86,
        "training_experience": "advanced", "tz": "UTC",
        "goals": [{"objective": "muscle_gain", "priority": 1}], "consent_accepted": True,
    })
    uid = auth_client.get("/api/auth/me").json()["id"]
    auth_client.get("/api/dashboard/today")
    from app.core.timeutil import now_utc
    with Session(engine) as s:
        user = s.get(User, uid)
        # 23:00 is inside default quiet hours (21:30–05:00) → suppressed, not sent.
        night = now_utc().replace(hour=23, minute=0, second=0, microsecond=0)
        out = evaluate_and_enqueue(s, user, now=night)
        assert all(e["status"] == "suppressed_quiet_hours" for e in out) or out == []
