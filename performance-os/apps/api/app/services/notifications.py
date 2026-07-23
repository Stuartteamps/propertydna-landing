"""Notification evaluation + enqueue (audit finding #6).

Deterministic rules decide which notifications are due, respecting per-user preference toggles,
quiet hours (in the user's timezone), and once-per-day-per-kind dedup. Delivery goes through a
pluggable sender (mock by default; swap for APNs/FCM later) and every attempt is logged.
"""
from __future__ import annotations

import datetime as dt
from typing import Protocol
from zoneinfo import ZoneInfo

from sqlmodel import Session, select

from app.core.timeutil import local_date, now_utc
from app.models import (
    DeviceToken,
    NotificationLog,
    NotificationPreference,
    NutritionTarget,
    User,
)
from app.services.daily import consumed_totals, get_profile_tz


# ---- delivery provider seam ----
class NotificationSender(Protocol):
    name: str

    def send(self, tokens: list[str], kind: str, payload: dict) -> bool: ...


class MockNotificationSender:
    name = "mock-push"

    def send(self, tokens: list[str], kind: str, payload: dict) -> bool:
        return True  # pretend-delivered; real APNs/FCM call goes here


_sender: NotificationSender = MockNotificationSender()


def _parse_hhmm(s: str) -> dt.time:
    try:
        h, m = s.split(":")
        return dt.time(int(h), int(m))
    except (ValueError, AttributeError):
        return dt.time(0, 0)


def quiet_hours_active(prefs: NotificationPreference, local_now: dt.datetime) -> bool:
    """True if the user's local time is inside the quiet-hours window (handles overnight wrap)."""
    start = _parse_hhmm(prefs.quiet_hours_start)
    end = _parse_hhmm(prefs.quiet_hours_end)
    t = local_now.time()
    if start <= end:
        return start <= t < end
    return t >= start or t < end          # window crosses midnight (e.g. 21:30 → 05:00)


def _already_logged_today(session: Session, user_id: str, kind: str, on: dt.date,
                          tz: str) -> bool:
    rows = session.exec(
        select(NotificationLog).where(
            NotificationLog.user_id == user_id, NotificationLog.kind == kind,
        )
    ).all()
    return any(local_date(r.scheduled_for, tz) == on for r in rows)


def _prefs(session: Session, user_id: str) -> NotificationPreference:
    p = session.exec(
        select(NotificationPreference).where(NotificationPreference.user_id == user_id)
    ).first()
    if not p:
        p = NotificationPreference(user_id=user_id)
        session.add(p)
        session.commit()
        session.refresh(p)
    return p


def evaluate_and_enqueue(session: Session, user: User, now: dt.datetime | None = None,
                         only: str | None = None) -> list[dict]:
    """Check each enabled preference; log + (mock) send those that are due and not quiet-houred.
    `only` restricts to a single kind (used for opportunistic checks from write paths)."""
    now = now or now_utc()
    tz = get_profile_tz(session, user.id)
    aware = now.replace(tzinfo=dt.UTC) if now.tzinfo is None else now
    try:
        local_now = aware.astimezone(ZoneInfo(tz))
    except Exception:  # noqa: BLE001
        local_now = aware.astimezone(ZoneInfo("UTC"))
    today = local_now.date()
    prefs = _prefs(session, user.id)
    tokens = [d.token for d in
              session.exec(select(DeviceToken).where(DeviceToken.user_id == user.id)).all()]

    candidates: list[tuple[str, bool, dict]] = []

    # protein deficit: late in the day and still well short of target
    if prefs.protein_deficit and only in (None, "protein_deficit"):
        target = session.exec(
            select(NutritionTarget).where(
                NutritionTarget.user_id == user.id, NutritionTarget.date == today,
            )
        ).first()
        if target:
            consumed = consumed_totals(session, user.id, today, tz)
            remaining = target.protein_g - consumed["protein_g"]
            if remaining > 40 and local_now.hour >= 18:   # evening + still well short
                candidates.append(("protein_deficit", True,
                                   {"protein_remaining_g": int(remaining)}))

    if prefs.bedtime and only in (None, "bedtime"):
        # within 30 min before bedtime
        bedtime = _parse_hhmm("21:30")
        bt_dt = local_now.replace(hour=bedtime.hour, minute=bedtime.minute, second=0, microsecond=0)
        if 0 <= (bt_dt - local_now).total_seconds() <= 1800:
            candidates.append(("bedtime", True, {"message": "Wind down for sleep."}))

    if prefs.journal_reminder and only in (None, "journal_reminder"):
        if local_now.hour >= 20:
            candidates.append(("journal_reminder", True, {"message": "30-second check-in?"}))

    enqueued: list[dict] = []
    quiet = quiet_hours_active(prefs, local_now)
    for kind, enabled, payload in candidates:
        if not enabled:
            continue
        if _already_logged_today(session, user.id, kind, today, tz):
            continue
        status = "suppressed_quiet_hours" if quiet else "pending"
        log = NotificationLog(user_id=user.id, kind=kind, scheduled_for=now,
                              status=status, payload=payload)
        if not quiet:
            if _sender.send(tokens, kind, payload):
                log.status = "sent"
                log.sent_at = now_utc()
        session.add(log)
        session.commit()
        enqueued.append({"kind": kind, "status": log.status, "payload": payload})
    return enqueued
