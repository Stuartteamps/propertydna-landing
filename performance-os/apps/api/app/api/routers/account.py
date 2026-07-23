"""Account privacy controls: data export, image deletion, full account deletion."""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.api.deps import ai_rate_limit, audit, db, get_current_user
from app.core.timeutil import now_utc
from app.models import (
    AIAnalysisRecord,
    CalendarEvent,
    ColdPlungeSession,
    FoodImage,
    Goal,
    HealthSample,
    Integration,
    JournalEntry,
    LabResult,
    Meal,
    MealItem,
    Medication,
    MorningRoutine,
    NotificationPreference,
    NutrientValue,
    NutritionTarget,
    Profile,
    ReadinessScore,
    RecoverySession,
    RoutineExercise,
    Run,
    SaunaSession,
    SleepSession,
    Supplement,
    SyncJob,
    User,
    Workout,
    WorkoutSet,
)

router = APIRouter(prefix="/account", tags=["account"])

# Every table that carries a user_id. Keep this list exhaustive — the deletion test asserts it.
USER_OWNED = [
    Profile, Goal, NutritionTarget, Meal, FoodImage, Workout, Run, HealthSample,
    SleepSession, ReadinessScore, CalendarEvent, MorningRoutine, RecoverySession,
    SaunaSession, ColdPlungeSession, JournalEntry, LabResult, Medication, Supplement,
    NotificationPreference, Integration, SyncJob, AIAnalysisRecord,
]


@router.get("/export")
def export_data(user: User = Depends(get_current_user), session: Session = Depends(db),
                _rl: None = Depends(ai_rate_limit)) -> dict:
    """Full data export for the authenticated user (GDPR-style portability)."""
    def dump(model):
        return [r.model_dump(mode="json") for r in
                session.exec(select(model).where(model.user_id == user.id)).all()]

    audit(session, "data_export", user_id=user.id)
    return {
        "exported_at": now_utc().isoformat(),
        "user": {"id": user.id, "email": user.email},
        "profile": dump(Profile),
        "goals": dump(Goal),
        "nutrition_targets": dump(NutritionTarget),
        "meals": dump(Meal),
        "workouts": dump(Workout),
        "runs": dump(Run),
        "health_samples": dump(HealthSample),
        "sleep": dump(SleepSession),
        "readiness": dump(ReadinessScore),
        "calendar_events": dump(CalendarEvent),
        "morning_routines": dump(MorningRoutine),
        "recovery": dump(RecoverySession),
        "sauna": dump(SaunaSession),
        "cold_plunge": dump(ColdPlungeSession),
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
    """Hard-delete every row the user owns (and child rows), plus uploaded image files."""
    # Remove image files from disk first.
    for img in session.exec(select(FoodImage).where(FoodImage.user_id == user.id)).all():
        Path(img.path).unlink(missing_ok=True)

    # Collect this user's parent ids so we can delete child rows that have no user_id.
    meal_ids = [m.id for m in session.exec(select(Meal).where(Meal.user_id == user.id)).all()]
    workout_ids = [w.id for w in session.exec(select(Workout).where(Workout.user_id == user.id)).all()]
    routine_ids = [
        r.id for r in session.exec(select(MorningRoutine).where(MorningRoutine.user_id == user.id)).all()
    ]
    if meal_ids:
        item_ids = [i.id for i in
                    session.exec(select(MealItem).where(MealItem.meal_id.in_(meal_ids))).all()]
        if item_ids:
            for nv in session.exec(
                select(NutrientValue).where(NutrientValue.meal_item_id.in_(item_ids))
            ).all():
                session.delete(nv)
        for mi in session.exec(select(MealItem).where(MealItem.meal_id.in_(meal_ids))).all():
            session.delete(mi)
    if workout_ids:
        for ws in session.exec(select(WorkoutSet).where(WorkoutSet.workout_id.in_(workout_ids))).all():
            session.delete(ws)
    if routine_ids:
        for re in session.exec(
            select(RoutineExercise).where(RoutineExercise.routine_id.in_(routine_ids))
        ).all():
            session.delete(re)

    # Delete every user-owned row.
    for model in USER_OWNED:
        for row in session.exec(select(model).where(model.user_id == user.id)).all():
            session.delete(row)

    # Soft-delete the auth user (retain the id for audit-log integrity).
    user.deleted_at = now_utc()
    user.is_active = False
    session.add(user)
    session.commit()
    audit(session, "delete_account", user_id=user.id)
    return {"ok": True, "deleted": True}
