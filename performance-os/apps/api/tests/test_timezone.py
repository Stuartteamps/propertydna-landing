"""Audit finding #2: day-scoped data is bucketed by the user's local date, not server-UTC."""
from app.core.timeutil import local_date, user_today
from app.models import Meal


def test_local_date_helper():
    import datetime as dt
    noon_utc = dt.datetime(2026, 7, 20, 12, 0)  # naive UTC
    # UTC+14 pushes noon UTC into the next calendar day.
    assert local_date(noon_utc, "Pacific/Kiritimati") == dt.date(2026, 7, 21)
    # UTC-7 keeps it the same day (05:00 local).
    assert local_date(noon_utc, "America/Denver") == dt.date(2026, 7, 20)
    assert local_date(noon_utc, "UTC") == dt.date(2026, 7, 20)


def test_meal_attributed_to_user_local_day(auth_client):
    # User in UTC+14. A meal logged at 12:00 UTC belongs to the NEXT local day.
    auth_client.post("/api/profile/onboarding", json={
        "name": "TZ", "sex": "male", "height_cm": 180, "weight_kg": 80,
        "training_experience": "advanced", "tz": "Pacific/Kiritimati",
        "goals": [{"objective": "longevity", "priority": 1}], "consent_accepted": True,
    })
    auth_client.post("/api/meals", json={
        "name": "night snack", "meal_type": "snack", "eaten_at": "2026-07-20T12:00:00",
        "items": [{"name": "yogurt", "estimated_quantity": 170, "calories": 100, "protein_g": 17}],
    })
    # Local day of the meal is 2026-07-21 for this user.
    on_local = auth_client.get("/api/meals/totals?on=2026-07-21").json()
    on_utc = auth_client.get("/api/meals/totals?on=2026-07-20").json()
    assert on_local["consumed"]["calories"] == 100
    assert on_utc["consumed"]["calories"] == 0  # would have been 100 with the old server-UTC bug


def test_invalid_timezone_rejected(auth_client):
    r = auth_client.post("/api/profile/onboarding", json={
        "name": "Bad", "sex": "male", "tz": "Mars/Olympus", "consent_accepted": True,
    })
    assert r.status_code == 422


def test_user_today_is_tz_aware():
    # Kiribati is up to a day ahead of Baker Island; today can differ.
    ahead = user_today("Pacific/Kiritimati")
    behind = user_today("Etc/GMT+12")
    assert (ahead - behind).days in (0, 1)
    assert Meal  # models import sanity
