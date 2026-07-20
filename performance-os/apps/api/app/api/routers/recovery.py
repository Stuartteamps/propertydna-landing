from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from app.api.deps import db, get_current_user
from app.core.timeutil import now_utc
from app.models import ColdPlungeSession, RecoverySession, SaunaSession, User

router = APIRouter(prefix="/recovery", tags=["recovery"])


class SaunaIn(BaseModel):
    temperature_c: float | None = None
    duration_min: int | None = None
    performed_at: dt.datetime | None = None
    session_type: str = "post_workout"
    subjective_response: str | None = None


class PlungeIn(BaseModel):
    temperature_c: float | None = None
    duration_min: float | None = None
    performed_at: dt.datetime | None = None
    session_type: str = "separate"
    subjective_response: str | None = None


class RecoveryIn(BaseModel):
    modality: str = "mobility"
    duration_min: int | None = None
    performed_at: dt.datetime | None = None
    notes: str | None = None


@router.post("/sauna", status_code=201)
def log_sauna(body: SaunaIn, user: User = Depends(get_current_user),
              session: Session = Depends(db)) -> dict:
    row = SaunaSession(user_id=user.id, **body.model_dump(exclude_none=True))
    if not row.performed_at:
        row.performed_at = now_utc()
    session.add(row)
    session.commit()
    return {"id": row.id}


@router.post("/cold-plunge", status_code=201)
def log_plunge(body: PlungeIn, user: User = Depends(get_current_user),
               session: Session = Depends(db)) -> dict:
    row = ColdPlungeSession(user_id=user.id, **body.model_dump(exclude_none=True))
    if not row.performed_at:
        row.performed_at = now_utc()
    session.add(row)
    session.commit()
    return {"id": row.id}


@router.post("/session", status_code=201)
def log_recovery(body: RecoveryIn, user: User = Depends(get_current_user),
                 session: Session = Depends(db)) -> dict:
    row = RecoverySession(user_id=user.id, **body.model_dump(exclude_none=True))
    if not row.performed_at:
        row.performed_at = now_utc()
    session.add(row)
    session.commit()
    return {"id": row.id}


@router.get("/recommendations")
def recommendations(user: User = Depends(get_current_user),
                    session: Session = Depends(db)) -> dict:
    """Heat/cold suggestions based on recent training. Explicitly not medical treatment."""
    end = dt.date.today()
    start = end - dt.timedelta(days=7)
    saunas = [s for s in session.exec(select(SaunaSession).where(
        SaunaSession.user_id == user.id)).all() if start <= s.performed_at.date() <= end]
    plunges = [p for p in session.exec(select(ColdPlungeSession).where(
        ColdPlungeSession.user_id == user.id)).all() if start <= p.performed_at.date() <= end]
    recs = []
    if len(saunas) < 3:
        recs.append("Sauna: 2–3 sessions this week (15–20 min) may support endurance & relaxation. "
                    "Hydrate well; keep separate from strength sessions you want to maximize.")
    else:
        recs.append("Good heat exposure this week — maintain and prioritize hydration.")
    recs.append("Cold plunge: keep it away from the 4–6h window after hypertrophy-focused "
                "lifting, when cold may blunt some adaptation. Great on easy or rest days.")
    return {
        "sauna_sessions_this_week": len(saunas),
        "cold_plunge_sessions_this_week": len(plunges),
        "recommendations": recs,
        "disclaimer": "Heat/cold exposure suggestions are for wellness, not medical treatment.",
    }
