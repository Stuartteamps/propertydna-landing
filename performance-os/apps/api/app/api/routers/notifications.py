from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from app.api.deps import db, get_current_user
from app.models import NotificationPreference, User

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
