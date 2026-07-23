from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from app.api.deps import db, get_current_user
from app.models import DeviceToken, NotificationLog, NotificationPreference, User
from app.services.notifications import evaluate_and_enqueue

router = APIRouter(prefix="/notifications", tags=["notifications"])


class PrefIn(BaseModel):
    morning_summary: bool | None = None
    workout_reminder: bool | None = None
    meal_reminder: bool | None = None
    protein_deficit: bool | None = None
    hydration_deficit: bool | None = None
    bedtime: bool | None = None
    journal_reminder: bool | None = None
    recovery_warning: bool | None = None
    weekly_report: bool | None = None
    lab_followup: bool | None = None
    quiet_hours_start: str | None = None
    quiet_hours_end: str | None = None


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


@router.get("")
def get_prefs(user: User = Depends(get_current_user), session: Session = Depends(db)) -> dict:
    return _prefs(session, user.id).model_dump()


@router.patch("")
def update_prefs(body: PrefIn, user: User = Depends(get_current_user),
                 session: Session = Depends(db)) -> dict:
    p = _prefs(session, user.id)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(p, k, v)
    session.add(p)
    session.commit()
    return {"ok": True}


class DeviceIn(BaseModel):
    token: str
    platform: str = "ios"


@router.post("/register-device", status_code=201)
def register_device(body: DeviceIn, user: User = Depends(get_current_user),
                    session: Session = Depends(db)) -> dict:
    existing = session.exec(
        select(DeviceToken).where(DeviceToken.user_id == user.id, DeviceToken.token == body.token)
    ).first()
    if not existing:
        session.add(DeviceToken(user_id=user.id, token=body.token, platform=body.platform))
        session.commit()
    return {"ok": True}


@router.delete("/register-device")
def unregister_device(token: str, user: User = Depends(get_current_user),
                      session: Session = Depends(db)) -> dict:
    for d in session.exec(
        select(DeviceToken).where(DeviceToken.user_id == user.id, DeviceToken.token == token)
    ).all():
        session.delete(d)
    session.commit()
    return {"ok": True}


@router.post("/run")
def run_evaluation(user: User = Depends(get_current_user), session: Session = Depends(db)) -> dict:
    """Evaluate all rules now and enqueue any due notifications (mock delivery)."""
    return {"enqueued": evaluate_and_enqueue(session, user)}


@router.get("/log")
def notification_log(limit: int = 50, user: User = Depends(get_current_user),
                     session: Session = Depends(db)) -> dict:
    rows = session.exec(
        select(NotificationLog).where(NotificationLog.user_id == user.id)
        .order_by(NotificationLog.scheduled_for.desc()).limit(limit)
    ).all()
    return {"log": [{"kind": r.kind, "status": r.status,
                     "scheduled_for": r.scheduled_for.isoformat(),
                     "sent_at": r.sent_at.isoformat() if r.sent_at else None,
                     "payload": r.payload} for r in rows]}
