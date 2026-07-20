"""Server-side mock providers for Apple Health & Google Calendar.

These generate realistic, deterministic demo data so the sync/import flows work with zero
credentials. On device, the mobile app can supply real HealthKit/Google payloads to the same
endpoints; the flag HEALTH_PROVIDER / CALENDAR_PROVIDER selects mock vs real.
"""
from __future__ import annotations

import datetime as dt
import hashlib


def _seeded(*parts: str) -> int:
    return int.from_bytes(hashlib.sha256("|".join(parts).encode()).digest()[:4], "big")


def mock_health_samples(user_id: str, days: int = 14,
                        ref: dt.date | None = None) -> list[dict]:
    """Return per-day health samples: hrv, resting_hr, steps, active_energy, vo2max, resp_rate."""
    ref = ref or dt.date(2026, 7, 20)
    out: list[dict] = []
    for d in range(days):
        day = ref - dt.timedelta(days=days - 1 - d)
        s = _seeded(user_id, day.isoformat())
        hrv = 58 + (s % 24) - 12               # ~46-70 ms
        rhr = 50 + (s // 7 % 10) - 3           # ~47-56 bpm
        steps = 7000 + (s % 6000)
        active = 500 + (s % 700)
        vo2 = 50 + (s % 5)
        resp = 13 + (s % 4)
        at = dt.datetime.combine(day, dt.time(6, 30))
        for metric, value, unit in [
            ("hrv", float(hrv), "ms"),
            ("resting_hr", float(rhr), "bpm"),
            ("steps", float(steps), "count"),
            ("active_energy", float(active), "kcal"),
            ("vo2max", float(vo2), "ml/kg/min"),
            ("respiratory_rate", float(resp), "breaths/min"),
        ]:
            out.append({
                "metric": metric, "value": value, "unit": unit,
                "recorded_at": at, "source": "healthkit", "source_name": "Apple Watch",
                "external_id": f"hk-{metric}-{day.isoformat()}",
            })
    return out


def mock_sleep_sessions(user_id: str, days: int = 14,
                        ref: dt.date | None = None) -> list[dict]:
    ref = ref or dt.date(2026, 7, 20)
    out = []
    for d in range(days):
        day = ref - dt.timedelta(days=days - 1 - d)
        s = _seeded(user_id, "sleep", day.isoformat())
        duration = 400 + (s % 120)             # 400-520 min (~6.7-8.7h)
        quality = 60 + (s % 35)
        out.append({
            "date": day,
            "duration_min": float(duration),
            "quality": float(quality),
            "deep_min": float(duration * 0.18),
            "rem_min": float(duration * 0.22),
            "awake_min": float(s % 30),
            "source": "healthkit",
        })
    return out


def mock_calendar_events(user_id: str, days: int = 7,
                         ref: dt.date | None = None) -> list[dict]:
    """A believable week at Pharos Athletic Club."""
    ref = ref or dt.date(2026, 7, 20)
    plan = [
        ("Pharos Strength — Upper", "Push/pull, Pharos Athletic Club", 60, "Training"),
        ("Zone 2 Run 8k", "Easy aerobic run", 50, "Training"),
        ("Pharos Legs", "Lower body strength", 60, "Training"),
        ("Sauna + Cold Plunge", "20 min sauna, 3 min plunge", 30, "Recovery"),
        ("Mobility & Core", "Hips + thoracic", 30, "Training"),
        ("Pharos Conditioning", "Metcon class", 45, "Training"),
        ("Long Run 14k", "Endurance", 80, "Training"),
    ]
    out = []
    for d in range(days):
        day = ref - dt.timedelta(days=days - 1 - d)
        title, desc, dur, cal = plan[d % len(plan)]
        start = dt.datetime.combine(day, dt.time(6, 0))
        out.append({
            "external_id": f"gcal-{day.isoformat()}",
            "title": title,
            "description": desc,
            "calendar_name": cal,
            "start_at": start,
            "end_at": start + dt.timedelta(minutes=dur),
        })
    return out
