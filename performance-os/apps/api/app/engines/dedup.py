"""Workout deduplication across sources (Apple Health ↔ Google Calendar ↔ manual).

Two workouts are considered the same session if their start times are within a tolerance
window and their normalized types match. A stable `dedup_key` is derived so re-imports are
idempotent.
"""
from __future__ import annotations

import datetime as dt

DEFAULT_TOLERANCE_MIN = 90


def dedup_key(user_id: str, start: dt.datetime, wtype: str,
              bucket_min: int = DEFAULT_TOLERANCE_MIN) -> str:
    """Bucket start time so near-simultaneous imports collide on the same key."""
    naive = start.astimezone(dt.UTC).replace(tzinfo=None) if start.tzinfo else start
    epoch = int(naive.replace(tzinfo=dt.UTC).timestamp())
    bucket = epoch // (bucket_min * 60)
    return f"{user_id}:{wtype}:{bucket}"


def _naive(d: dt.datetime) -> dt.datetime:
    return d.astimezone(dt.UTC).replace(tzinfo=None) if d.tzinfo else d


def is_duplicate(a_start: dt.datetime, a_type: str,
                 b_start: dt.datetime, b_type: str,
                 tolerance_min: int = DEFAULT_TOLERANCE_MIN) -> bool:
    if a_type != b_type:
        return False
    delta = abs((_naive(a_start) - _naive(b_start)).total_seconds()) / 60.0
    return delta <= tolerance_min


def choose_primary(existing_source: str, new_source: str) -> str:
    """When two sources describe one session, prefer the richer source.
    HealthKit (sensor data) > Google Calendar (planned) > manual duplicate.
    Returns which source's record to keep as primary.
    """
    priority = {"healthkit": 3, "google_calendar": 2, "manual": 1}
    return existing_source if priority.get(existing_source, 0) >= priority.get(new_source, 0) \
        else new_source
