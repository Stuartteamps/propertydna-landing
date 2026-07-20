"""Account privacy controls: data export, image deletion, full account deletion."""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.api.deps import audit, db, get_current_user
from app.core.timeutil import now_utc
from app.models import (
    FoodImage,
    JournalEntry,
    LabResult,
    Meal,
    Medication,
    Profile,
    ReadinessScore,
    Run,
    SleepSession,
    Supplement,
    User,
    Workout,
)

router = APIRouter(prefix="/account", tags=["account"])


@router.get("/export")
def export_data(user: User = Depends(get_current_user), session: Session = Depends(db)) -> dict:
    """Full data export for the authenticated user (GDPR-style portability)."""
    def dump(model):
        return [r.model_dump(mode="json") for r in
                session.exec(select(model).where(model.user_id == user.id)).all()]

    audit(session, "data_export", user_id=user.id)
    return {
        "exported_at": now_utc().isoformat(),
        "user": {"id": user.id, "email": user.email},
        "profile": dump(Profile),
        "meals": dump(Meal),
        "workouts": dump(Workout),
        "runs": dump(Run),
        "sleep": dump(SleepSession),
        "readiness": dump(ReadinessScore),
        "journal": dump(JournalEntry),
        "labs": dump(LabResult),
        "supplements": dump(Supplement),
        "medications": dump(Medication),  # included in the user's own export only
    }


@router.delete("/images/{image_id}")
def delete_image(image_id: str, user: User = Depends(get_current_user),
                 session: Session = Depends(db)) -> dict:
    img = session.get(FoodImage, image_id)
    if img and img.user_id == user.id:
        try:
            Path(img.path).unlink(missing_ok=True)
        except OSError:
            pass
        img.deleted_at = now_utc()
        session.add(img)
        session.commit()
        audit(session, "image_delete", user_id=user.id, resource=image_id)
    return {"ok": True}


@router.delete("")
def delete_account(user: User = Depends(get_current_user),
                   session: Session = Depends(db)) -> dict:
    """Hard-delete the user's rows and their uploaded images."""
    for img in session.exec(select(FoodImage).where(FoodImage.user_id == user.id)).all():
        Path(img.path).unlink(missing_ok=True)
    models = [Profile, Meal, Workout, Run, SleepSession, ReadinessScore, JournalEntry,
              LabResult, Supplement, Medication, FoodImage]
    for model in models:
        for row in session.exec(select(model).where(model.user_id == user.id)).all():
            session.delete(row)
    user.deleted_at = now_utc()
    user.is_active = False
    session.add(user)
    session.commit()
    audit(session, "delete_account", user_id=user.id)
    return {"ok": True, "deleted": True}
