from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.api.deps import audit, db, get_current_user
from app.core.config import settings
from app.core.timeutil import as_naive_utc, now_utc
from app.engines.calendar_match import match_event, workout_type_for_calendar
from app.engines.dedup import dedup_key, is_duplicate
from app.models import (
    CalendarEvent,
    HealthSample,
    Integration,
    SleepSession,
    SyncJob,
    User,
    Workout,
)
from app.services.mock_integrations import (
    mock_calendar_events,
    mock_health_samples,
    mock_sleep_sessions,
)

router = APIRouter(prefix="/integrations", tags=["integrations"])


def _integration(session: Session, user_id: str, provider: str) -> Integration:
    i = session.exec(
        select(Integration).where(
            Integration.user_id == user_id, Integration.provider == provider,
        )
    ).first()
    if not i:
        i = Integration(user_id=user_id, provider=provider)
        session.add(i)
        session.commit()
        session.refresh(i)
    return i


@router.get("/status")
def status_all(user: User = Depends(get_current_user), session: Session = Depends(db)) -> dict:
    out = {}
    for provider in ("apple_health", "google_calendar"):
        i = _integration(session, user.id, provider)
        out[provider] = {
            "status": i.status, "connected": i.connected,
            "last_sync_at": i.last_sync_at.isoformat() if i.last_sync_at else None,
            "last_error": i.last_error,
        }
    return out


@router.post("/{provider}/connect")
def connect(provider: str, user: User = Depends(get_current_user),
            session: Session = Depends(db)) -> dict:
    if provider not in ("apple_health", "google_calendar"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown provider")
    i = _integration(session, user.id, provider)
    i.connected = True
    i.status = "connected"
    i.last_error = None
    session.add(i)
    session.commit()
    audit(session, "integration_connect", user_id=user.id, resource=provider)
    return {"ok": True, "provider": provider, "status": i.status}


@router.post("/{provider}/revoke")
def revoke(provider: str, user: User = Depends(get_current_user),
           session: Session = Depends(db)) -> dict:
    i = _integration(session, user.id, provider)
    i.connected = False
    i.status = "revoked"
    session.add(i)
    session.commit()
    audit(session, "integration_revoke", user_id=user.id, resource=provider)
    return {"ok": True, "provider": provider, "status": i.status}


class SyncIn(BaseModel):
    days: int = 14
    # Optional real device payloads (when HEALTH_PROVIDER=healthkit the app posts these).
    samples: list[dict] | None = None
    sleep: list[dict] | None = None


@router.post("/apple_health/sync")
def sync_health(body: SyncIn, user: User = Depends(get_current_user),
                session: Session = Depends(db)) -> dict:
    i = _integration(session, user.id, "apple_health")
    if not i.connected:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Connect Apple Health first")
    job = SyncJob(user_id=user.id, provider="apple_health", status="running",
                  started_at=now_utc())
    session.add(job)
    session.commit()

    if settings.HEALTH_PROVIDER == "mock" or not (body.samples or body.sleep):
        samples = mock_health_samples(user.id, days=body.days)
        sleeps = mock_sleep_sessions(user.id, days=body.days)
    else:
        samples, sleeps = body.samples or [], body.sleep or []

    imported = _import_samples(session, user.id, samples)
    imported += _import_sleep(session, user.id, sleeps)

    job.status = "success"
    job.finished_at = now_utc()
    job.records_imported = imported
    i.last_sync_at = job.finished_at
    i.status = "connected"
    session.add(job)
    session.add(i)
    session.commit()
    audit(session, "health_sync", user_id=user.id, meta={"records": imported})
    return {"ok": True, "records_imported": imported,
            "last_sync_at": i.last_sync_at.isoformat()}


def _import_samples(session: Session, user_id: str, samples: list[dict]) -> int:
    existing = {s.external_id for s in
                session.exec(select(HealthSample).where(HealthSample.user_id == user_id)).all()
                if s.external_id}
    n = 0
    for s in samples:
        ext = s.get("external_id")
        if ext and ext in existing:      # deduplication
            continue
        recorded = s["recorded_at"]
        if isinstance(recorded, str):
            recorded = as_naive_utc(dt.datetime.fromisoformat(recorded))
        session.add(HealthSample(
            user_id=user_id, metric=s["metric"], value=float(s["value"]),
            unit=s.get("unit"), recorded_at=recorded, source=s.get("source", "healthkit"),
            source_name=s.get("source_name"), external_id=ext,
        ))
        n += 1
    session.commit()
    return n


def _import_sleep(session: Session, user_id: str, sleeps: list[dict]) -> int:
    existing = {s.date for s in
                session.exec(select(SleepSession).where(SleepSession.user_id == user_id)).all()}
    n = 0
    for s in sleeps:
        d = s["date"]
        if isinstance(d, str):
            d = dt.date.fromisoformat(d)
        if d in existing:
            continue
        session.add(SleepSession(
            user_id=user_id, date=d, duration_min=float(s["duration_min"]),
            quality=s.get("quality"), deep_min=s.get("deep_min"),
            rem_min=s.get("rem_min"), awake_min=s.get("awake_min"),
            source=s.get("source", "healthkit"),
        ))
        n += 1
    session.commit()
    return n


class CalendarImportIn(BaseModel):
    days: int = 7
    events: list[dict] | None = None       # real Google payload when CALENDAR_PROVIDER=google
    auto_create_workouts: bool = True


@router.post("/google_calendar/import")
def import_calendar(body: CalendarImportIn, user: User = Depends(get_current_user),
                    session: Session = Depends(db)) -> dict:
    i = _integration(session, user.id, "google_calendar")
    if not i.connected:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Connect Google Calendar first")

    if settings.CALENDAR_PROVIDER == "mock" or not body.events:
        events = mock_calendar_events(user.id, days=body.days)
    else:
        events = body.events

    existing_ext = {e.external_id for e in
                    session.exec(
                        select(CalendarEvent).where(CalendarEvent.user_id == user.id)
                    ).all() if e.external_id}

    imported, created_workouts, deduped = 0, 0, 0
    detected = []
    for e in events:
        ext = e.get("external_id")
        if ext and ext in existing_ext:
            continue
        start = as_naive_utc(e["start_at"]) if isinstance(e["start_at"], dt.datetime) else e["start_at"]
        end = e.get("end_at")
        if isinstance(start, str):
            start = as_naive_utc(dt.datetime.fromisoformat(start))
        if isinstance(end, str):
            end = as_naive_utc(dt.datetime.fromisoformat(end))
        m = match_event(e["title"], e.get("description"))
        ce = CalendarEvent(
            user_id=user.id, external_id=ext, title=e["title"],
            description=e.get("description"), calendar_name=e.get("calendar_name"),
            start_at=start, end_at=end, matched_type=m.matched_type,
        )
        session.add(ce)
        imported += 1
        detected.append({"title": e["title"], "matched_type": m.matched_type,
                         "keyword": m.matched_keyword})

        if body.auto_create_workouts and m.matched_type:
            wtype = workout_type_for_calendar(m.matched_type)
            dup = _existing_workout(session, user.id, wtype, start)
            if dup:
                deduped += 1
                ce.imported_workout_id = dup.id
            else:
                duration = int((end - start).total_seconds() / 60) if end else 60
                w = Workout(
                    user_id=user.id, type=wtype, title=e["title"], started_at=start,
                    duration_min=duration, source="google_calendar", external_id=ext,
                    dedup_key=dedup_key(user.id, start, wtype), confirmed=False,
                )
                session.add(w)
                session.commit()
                session.refresh(w)
                ce.imported_workout_id = w.id
                created_workouts += 1
        session.add(ce)
    i.last_sync_at = now_utc()
    i.status = "connected"
    session.add(i)
    session.commit()
    audit(session, "calendar_import", user_id=user.id,
          meta={"imported": imported, "workouts": created_workouts, "deduped": deduped})
    return {"ok": True, "events_imported": imported, "workouts_created": created_workouts,
            "workouts_deduped": deduped, "detected": detected}


def _existing_workout(session: Session, user_id: str, wtype: str,
                      start: dt.datetime) -> Workout | None:
    for w in session.exec(select(Workout).where(Workout.user_id == user_id)).all():
        if w.deleted_at is None and w.source != "google_calendar" and \
           is_duplicate(w.started_at, w.type, start, wtype):
            return w
    return None
