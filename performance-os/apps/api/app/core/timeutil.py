"""Consistent naive-UTC datetimes.

SQLite drops tzinfo on write, so mixing tz-aware and naive datetimes causes subtraction/compare
errors. We standardize the whole domain on naive UTC and coerce any inbound aware datetimes.
"""
from __future__ import annotations

import datetime as dt
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def now_utc() -> dt.datetime:
    return dt.datetime.now(dt.UTC).replace(tzinfo=None)


def as_naive_utc(d: dt.datetime) -> dt.datetime:
    if d.tzinfo is not None:
        d = d.astimezone(dt.UTC).replace(tzinfo=None)
    return d


def _zone(tz: str) -> ZoneInfo:
    try:
        return ZoneInfo(tz or "UTC")
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("UTC")


def is_valid_tz(tz: str) -> bool:
    try:
        ZoneInfo(tz)
        return True
    except (ZoneInfoNotFoundError, ValueError):
        return False


def local_date(naive_utc: dt.datetime, tz: str = "UTC") -> dt.date:
    """The calendar date a naive-UTC instant falls on, in the user's timezone."""
    aware = naive_utc.replace(tzinfo=dt.UTC) if naive_utc.tzinfo is None else naive_utc
    return aware.astimezone(_zone(tz)).date()


def user_today(tz: str = "UTC") -> dt.date:
    """Today's date in the user's timezone (not the server's)."""
    return dt.datetime.now(_zone(tz)).date()
