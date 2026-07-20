"""Consistent naive-UTC datetimes.

SQLite drops tzinfo on write, so mixing tz-aware and naive datetimes causes subtraction/compare
errors. We standardize the whole domain on naive UTC and coerce any inbound aware datetimes.
"""
from __future__ import annotations

import datetime as dt


def now_utc() -> dt.datetime:
    return dt.datetime.now(dt.UTC).replace(tzinfo=None)


def as_naive_utc(d: dt.datetime) -> dt.datetime:
    if d.tzinfo is not None:
        d = d.astimezone(dt.UTC).replace(tzinfo=None)
    return d
