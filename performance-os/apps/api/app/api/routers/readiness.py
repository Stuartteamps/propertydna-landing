from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.api.deps import db, get_current_user
from app.core.timeutil import now_utc
from app.engines.readiness import compute_readiness
from app.models import ReadinessScore, User
from app.services.daily import build_readiness_input

router = APIRouter(prefix="/readiness", tags=["readiness"])


def compute_and_store(session: Session, user_id: str, on: dt.date) -> ReadinessScore:
    from app.services.daily import get_profile_tz
    inp = build_readiness_input(session, user_id, on, tz=get_profile_tz(session, user_id))
    result = compute_readiness(inp)
    existing = session.exec(
        select(ReadinessScore).where(
            ReadinessScore.user_id == user_id, ReadinessScore.date == on,
        )
    ).first()
    row = existing or ReadinessScore(user_id=user_id, date=on)
    row.score = result.score
    row.band = result.band
    row.components = result.components
    row.weights = result.weights
    row.explanation = result.explanation
    row.data_completeness = result.data_completeness
    row.updated_at = now_utc()
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


@router.get("")
def get_readiness(on: dt.date | None = None, user: User = Depends(get_current_user),
                  session: Session = Depends(db)) -> dict:
    from app.core.timeutil import user_today
    from app.services.daily import get_profile_tz
    on = on or user_today(get_profile_tz(session, user.id))
    row = compute_and_store(session, user.id, on)
    return {
        "date": on.isoformat(), "score": row.score, "band": row.band,
        "components": row.components, "weights": row.weights,
        "explanation": row.explanation, "data_completeness": row.data_completeness,
        "disclaimer": "Readiness is a wellness signal, not a medical measurement.",
    }


@router.get("/history")
def history(days: int = 14, user: User = Depends(get_current_user),
            session: Session = Depends(db)) -> dict:
    end = dt.date.today()
    rows = session.exec(
        select(ReadinessScore).where(ReadinessScore.user_id == user.id)
        .order_by(ReadinessScore.date)
    ).all()
    start = end - dt.timedelta(days=days)
    return {"history": [{"date": r.date.isoformat(), "score": r.score, "band": r.band}
                        for r in rows if start <= r.date <= end]}
