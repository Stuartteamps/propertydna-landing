from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.ai.factory import get_coaching_provider
from app.api.deps import db, get_current_user
from app.api.routers.readiness import compute_and_store
from app.api.routers.routine import today_routine
from app.core.branding import DISCLAIMER
from app.core.timeutil import now_utc
from app.models import NutritionTarget, Profile, User
from app.services.daily import (
    compute_nutrition_targets,
    consumed_totals,
    latest_metric,
    metric_baseline,
    sleep_for,
    todays_workout,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _upsert_targets(session: Session, user_id: str, on: dt.date) -> NutritionTarget:
    result = compute_nutrition_targets(session, user_id, on)
    existing = session.exec(
        select(NutritionTarget).where(
            NutritionTarget.user_id == user_id, NutritionTarget.date == on,
        )
    ).first()
    row = existing or NutritionTarget(user_id=user_id, date=on, calories=0, protein_g=0,
                                      carbs_g=0, fat_g=0, fiber_g=0, hydration_ml=0,
                                      bmr=0, tdee=0)
    row.calories, row.protein_g, row.carbs_g = result.calories, result.protein_g, result.carbs_g
    row.fat_g, row.fiber_g, row.hydration_ml = result.fat_g, result.fiber_g, result.hydration_ml
    row.bmr, row.tdee, row.rationale = result.bmr, result.tdee, result.rationale
    row.updated_at = now_utc()
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


@router.get("/today")
def today(on: dt.date | None = None, user: User = Depends(get_current_user),
          session: Session = Depends(db)) -> dict:
    on = on or dt.date.today()
    profile = session.exec(select(Profile).where(Profile.user_id == user.id)).first()

    readiness = compute_and_store(session, user.id, on)
    targets = _upsert_targets(session, user.id, on)
    consumed = consumed_totals(session, user.id, on)
    remaining = {
        "calories": targets.calories - consumed["calories"],
        "protein_g": targets.protein_g - consumed["protein_g"],
        "carbs_g": targets.carbs_g - consumed["carbs_g"],
        "fat_g": targets.fat_g - consumed["fat_g"],
        "fiber_g": targets.fiber_g - consumed["fiber_g"],
    }

    workout = todays_workout(session, user.id, on)
    sleep = sleep_for(session, user.id, on)
    routine = today_routine(on=on, user=user, session=session)

    alerts = _alerts(readiness, remaining, consumed, targets)
    coach = get_coaching_provider().daily_summary({
        "readiness_band": readiness.band,
        "workout_title": (workout.title or workout.type) if workout else None,
        "protein_remaining_g": remaining["protein_g"],
    })

    return {
        "date": on.isoformat(),
        "greeting_name": profile.name if profile else None,
        "readiness": {"score": readiness.score, "band": readiness.band,
                      "explanation": readiness.explanation,
                      "data_completeness": readiness.data_completeness},
        "recovery": {
            "sleep_hours": round(sleep.duration_min / 60, 1) if sleep else None,
            "sleep_quality": sleep.quality if sleep else None,
            "hrv": latest_metric(session, user.id, "hrv", on),
            "hrv_baseline": (round(b, 1) if (b := metric_baseline(session, user.id, "hrv", on))
                             else None),
            "resting_hr": latest_metric(session, user.id, "resting_hr", on),
        },
        "nutrition": {
            "targets": {"calories": targets.calories, "protein_g": targets.protein_g,
                        "carbs_g": targets.carbs_g, "fat_g": targets.fat_g,
                        "fiber_g": targets.fiber_g, "hydration_ml": targets.hydration_ml},
            "consumed": consumed,
            "remaining": remaining,
        },
        "workout": ({"id": workout.id, "type": workout.type, "title": workout.title,
                     "duration_min": workout.duration_min, "confirmed": workout.confirmed}
                    if workout else None),
        "morning_routine": {"id": routine["id"], "intensity": routine["intensity_target"],
                            "duration_min": routine["total_duration_min"],
                            "completed": routine["completed"],
                            "is_deload": routine["is_deload"]},
        "recommendations": _modality_recs(readiness.band, workout),
        "coach_message": coach,
        "alerts": alerts,
        "disclaimer": DISCLAIMER,
    }


def _alerts(readiness, remaining, consumed, targets) -> list[dict]:
    out = []
    if readiness.band == "red":
        out.append({"level": "warning", "title": "Low readiness",
                    "message": "Recovery is down — favor easy movement and sleep today."})
    if readiness.score is None:
        out.append({"level": "info", "title": "Connect your data",
                    "message": "Sync Apple Health to unlock a reliable readiness score."})
    if consumed["calories"] and remaining["protein_g"] > 60:
        out.append({"level": "info", "title": "Protein behind",
                    "message": f"~{int(remaining['protein_g'])}g protein left to hit target."})
    return out


def _modality_recs(band: str, workout) -> dict:
    hard = bool(workout and workout.type in ("strength", "running"))
    return {
        "sauna": ("Optional 15–20 min post-session; hydrate." if band != "red"
                  else "Light 10–15 min if it feels restful."),
        "cold_plunge": ("Fine on easy/rest days; avoid right after hypertrophy lifting."
                        if hard else "Good option today (2–3 min)."),
        "running": ("Zone 2 if scheduled — keep it conversational." if band != "red"
                    else "Keep any running very easy or skip."),
        "mobility": "10 min hips + thoracic; pairs well with the morning routine.",
    }
