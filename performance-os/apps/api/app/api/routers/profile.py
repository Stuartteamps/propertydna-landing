from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlmodel import Session, select

from app.api.deps import audit, db, get_current_user
from app.core.branding import DISCLAIMER
from app.core.timeutil import is_valid_tz, now_utc
from app.models import Goal, Medication, Profile, Supplement, User

router = APIRouter(prefix="/profile", tags=["profile"])


class GoalIn(BaseModel):
    objective: str
    priority: int = 1


class OnboardingIn(BaseModel):
    name: str | None = None
    date_of_birth: dt.date | None = None
    sex: str | None = None
    height_cm: float | None = None
    weight_kg: float | None = None
    goal_weight_kg: float | None = None
    body_fat_pct: float | None = None
    training_experience: str | None = None
    weekly_training_days: int | None = None
    dietary_preferences: list[str] = []
    allergies: list[str] = []
    injuries: list[str] = []
    medical_restrictions: list[str] = []
    equipment: list[str] = []
    wake_time: str | None = None
    bedtime: str | None = None
    units: str = "imperial"
    tz: str = "UTC"                       # IANA timezone (validated below)
    supplements: list[str] = []
    medications: list[str] = []          # sensitive; stored in dedicated table
    goals: list[GoalIn] = []
    consent_accepted: bool = False

    @field_validator("tz")
    @classmethod
    def _valid_tz(cls, v: str) -> str:
        if v and not is_valid_tz(v):
            raise ValueError(f"Unknown timezone '{v}' (expected an IANA name like 'America/Denver')")
        return v or "UTC"


def _get_or_create_profile(session: Session, user_id: str) -> Profile:
    p = session.exec(select(Profile).where(Profile.user_id == user_id)).first()
    if not p:
        p = Profile(user_id=user_id)
        session.add(p)
        session.commit()
        session.refresh(p)
    return p


@router.post("/onboarding")
def submit_onboarding(body: OnboardingIn, user: User = Depends(get_current_user),
                      session: Session = Depends(db)) -> dict:
    p = _get_or_create_profile(session, user.id)
    data = body.model_dump(exclude={"supplements", "medications", "goals", "consent_accepted"})
    for k, v in data.items():
        setattr(p, k, v)
    if body.consent_accepted:
        p.consent_accepted_at = now_utc()
    p.updated_at = now_utc()
    session.add(p)

    # Goals
    for g in session.exec(select(Goal).where(Goal.user_id == user.id)).all():
        session.delete(g)
    for g in body.goals:
        session.add(Goal(user_id=user.id, objective=g.objective, priority=g.priority))

    # Supplements / medications (medications are sensitive)
    for name in body.supplements:
        session.add(Supplement(user_id=user.id, name=name))
    for name in body.medications:
        session.add(Medication(user_id=user.id, name=name, sensitive=True))

    user.onboarded = True
    session.add(user)
    session.commit()
    audit(session, "onboarding_complete", user_id=user.id)
    return {"ok": True, "onboarded": True, "disclaimer": DISCLAIMER}


@router.get("")
def get_profile(user: User = Depends(get_current_user), session: Session = Depends(db)) -> dict:
    p = _get_or_create_profile(session, user.id)
    goals = session.exec(
        select(Goal).where(Goal.user_id == user.id, Goal.active).order_by(Goal.priority)
    ).all()
    supps = session.exec(select(Supplement).where(Supplement.user_id == user.id)).all()
    return {
        "profile": p.model_dump(),
        "goals": [{"objective": g.objective, "priority": g.priority} for g in goals],
        "supplements": [{"name": s.name, "dose": s.dose} for s in supps],
        # medications intentionally omitted from the general profile payload (sensitive)
    }


class ProfileUpdateIn(BaseModel):
    weight_kg: float | None = None
    goal_weight_kg: float | None = None
    body_fat_pct: float | None = None
    wake_time: str | None = None
    bedtime: str | None = None
    units: str | None = None
    tz: str | None = None

    @field_validator("tz")
    @classmethod
    def _valid_tz(cls, v: str | None) -> str | None:
        if v and not is_valid_tz(v):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Unknown timezone '{v}'")
        return v


@router.patch("")
def update_profile(body: ProfileUpdateIn, user: User = Depends(get_current_user),
                   session: Session = Depends(db)) -> dict:
    p = _get_or_create_profile(session, user.id)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(p, k, v)
    p.updated_at = now_utc()
    session.add(p)
    session.commit()
    return {"ok": True}
