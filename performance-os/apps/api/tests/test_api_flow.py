"""End-to-end API tests covering the first-working-release flow + edge cases."""
from __future__ import annotations

import io


def _png_bytes() -> bytes:
    # Minimal valid-ish bytes; the mock vision provider only hashes them.
    return b"\x89PNG\r\n\x1a\n" + b"0" * 128


def _onboard(auth_client):
    r = auth_client.post("/api/profile/onboarding", json={
        "name": "Alex", "date_of_birth": "1983-04-12", "sex": "male",
        "height_cm": 185, "weight_kg": 86, "goal_weight_kg": 84, "body_fat_pct": 14,
        "training_experience": "advanced", "weekly_training_days": 6,
        "wake_time": "05:00", "bedtime": "21:30", "units": "imperial",
        "goals": [{"objective": "longevity", "priority": 1},
                  {"objective": "recomposition", "priority": 2}],
        "supplements": ["Creatine"], "medications": ["private-med"],
        "consent_accepted": True,
    })
    assert r.status_code == 200, r.text
    assert r.json()["onboarded"] is True


def test_auth_requires_token(client):
    assert client.get("/api/dashboard/today").status_code == 401


def test_full_flow(auth_client):
    _onboard(auth_client)

    # Connect + sync mock health and calendar
    for provider in ("apple_health", "google_calendar"):
        assert auth_client.post(f"/api/integrations/{provider}/connect").status_code == 200
    hs = auth_client.post("/api/integrations/apple_health/sync", json={"days": 14}).json()
    assert hs["records_imported"] > 0
    cal = auth_client.post("/api/integrations/google_calendar/import", json={"days": 7}).json()
    assert cal["events_imported"] > 0 and cal["workouts_created"] > 0

    # Readiness computes with real synced data
    rd = auth_client.get("/api/readiness?on=2026-07-20").json()
    assert rd["score"] is not None
    assert rd["band"] in ("green", "yellow", "red")

    # Meal photo → analyze → save → totals update
    files = {"file": ("meal.png", io.BytesIO(_png_bytes()), "image/png")}
    analysis = auth_client.post("/api/meals/analyze", files=files, data={"meal_type": "lunch"}).json()
    assert analysis["is_estimate"] is True and analysis["items"]
    image_id = next(a.split(":")[1] for a in analysis["assumptions"] if a.startswith("image_id:"))
    save = auth_client.post("/api/meals", json={
        "name": analysis["meal_name"], "meal_type": "lunch", "source": "ai_photo",
        "image_id": image_id, "overall_confidence": analysis["overall_confidence"],
        "items": analysis["items"],
    })
    assert save.status_code == 201
    assert save.json()["totals_today"]["calories"] > 0

    # Manual workout create
    w = auth_client.post("/api/workouts", json={
        "type": "strength", "title": "Bench day", "duration_min": 60, "perceived_effort": 8,
        "sets": [{"exercise_name": "Bench Press", "set_number": 1, "reps": 5, "load_kg": 100}],
    })
    assert w.status_code == 201

    # Morning routine + complete
    routine = auth_client.get("/api/routine/today?on=2026-07-20").json()
    assert routine["total_duration_min"] == 10
    assert auth_client.post(f"/api/routine/{routine['id']}/complete").json()["completed"]

    # Recovery
    assert auth_client.post("/api/recovery/sauna", json={"duration_min": 20}).status_code == 201
    assert auth_client.post("/api/recovery/cold-plunge", json={"duration_min": 3}).status_code == 201

    # Journal
    assert auth_client.post("/api/journal", json={"mood": 4, "energy": 4, "stress": 2}).status_code == 200

    # Dashboard aggregates everything
    d = auth_client.get("/api/dashboard/today?on=2026-07-20").json()
    assert d["nutrition"]["consumed"]["calories"] > 0
    assert d["morning_routine"]["completed"] is True
    assert "disclaimer" in d

    # Trends
    series = auth_client.get("/api/trends/series?metric=hrv&days=30").json()
    assert len(series["points"]) > 0
    report = auth_client.get("/api/trends/weekly-report").json()
    assert "priorities_next_week" in report


def test_medications_excluded_from_profile_payload(auth_client):
    _onboard(auth_client)
    prof = auth_client.get("/api/profile").json()
    assert "medications" not in prof  # sensitive data not in general profile response


def test_health_sync_requires_connect(auth_client):
    _onboard(auth_client)
    # Not connected yet -> 400
    assert auth_client.post("/api/integrations/apple_health/sync", json={"days": 7}).status_code == 400


def test_workout_dedup_healthkit_and_calendar(auth_client):
    _onboard(auth_client)
    auth_client.post("/api/integrations/google_calendar/connect")
    auth_client.post("/api/integrations/google_calendar/import", json={"days": 3})
    # A HealthKit-sourced workout at the same time/type as a calendar one should dedup.
    wk = auth_client.get("/api/workouts").json()["workouts"]
    assert wk, "calendar import should have created workouts"
    sample = wk[0]
    dup = auth_client.post("/api/workouts", json={
        "type": sample["type"], "title": "HK import",
        "started_at": sample["started_at"], "source": "healthkit",
    })
    assert dup.json()["deduped"] is True


def test_revoked_integration_blocks_sync(auth_client):
    _onboard(auth_client)
    auth_client.post("/api/integrations/apple_health/connect")
    auth_client.post("/api/integrations/apple_health/revoke")
    r = auth_client.post("/api/integrations/apple_health/sync", json={"days": 7})
    assert r.status_code == 400


def test_invalid_lab_unit_rejected(auth_client):
    _onboard(auth_client)
    r = auth_client.post("/api/labs", json={
        "test_name": "ApoB", "value": 80, "unit": "   ",
    })
    assert r.status_code == 422


def test_lab_flag_derived_from_reference_range_only(auth_client):
    _onboard(auth_client)
    r = auth_client.post("/api/labs", json={
        "test_name": "LDL", "value": 130, "unit": "mg/dL",
        "reference_low": 0, "reference_high": 100,
    }).json()
    assert r["flag"] == "high"


def test_readiness_unknown_without_data(auth_client):
    _onboard(auth_client)
    # No health data synced -> should be honest about insufficient data.
    rd = auth_client.get("/api/readiness?on=2020-01-01").json()
    assert rd["score"] is None
    assert rd["band"] == "unknown"


def test_account_export_and_delete(auth_client):
    _onboard(auth_client)
    export = auth_client.get("/api/account/export").json()
    assert "profile" in export and "medications" in export
    assert auth_client.delete("/api/account").json()["deleted"] is True
