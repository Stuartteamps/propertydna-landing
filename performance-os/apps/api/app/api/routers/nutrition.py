"""Weekly nutrition adjustment (audit finding #7).

Reviews the last 7 days and persists a bounded calorie delta into the current NutritionTarget's
`adjustment_kcal`. The dashboard adds this delta to the freshly-computed baseline, so the nudge
survives subsequent /dashboard/today recomputes instead of being clobbered.
"""
from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.api.deps import db, get_current_user
from app.core.timeutil import now_utc
from app.engines.nutrition import WeeklyAdjustInput, weekly_adjustment
from app.models import NutritionTarget, Profile, ReadinessScore, User, Workout
from app.services.daily import compute_nutrition_targets, consumed_totals

router = APIRouter(prefix="/nutrition", tags=["nutrition"])


def _weekly_inputs(session: Session, user_id: str, on: dt.date) -> tuple[int, WeeklyAdjustInput]:
    from app.services.daily import primary_goal
    profile = session.exec(select(Profile).where(Profile.user_id == user_id)).first()
    goal = primary_goal(session, user_id)

    baseline = compute_nutrition_targets(session, user_id, on)

    days = [on - dt.timedelta(days=i) for i in range(7)]
    cal_days, protein_hits, logged_days = [], 0, 0
    for d in days:
        t = consumed_totals(session, user_id, d)
        if t["calories"]:
            logged_days += 1
            cal_days.append(t["calories"])
            if t["protein_g"] >= baseline.protein_g * 0.9:
                protein_hits += 1
    seven_day_avg = sum(cal_days) / len(cal_days) if cal_days else baseline.calories
    protein_adherence = (protein_hits / logged_days * 100) if logged_days else 0.0

    week_start = on - dt.timedelta(days=7)
    workouts = [w for w in session.exec(select(Workout).where(Workout.user_id == user_id)).all()
                if w.deleted_at is None and week_start <= w.started_at.date() <= on]
    planned = (profile.weekly_training_days if profile and profile.weekly_training_days else 5)
    workout_adherence = min(100.0, len({w.started_at.date() for w in workouts}) / planned * 100)

    readi = [r.score for r in
             session.exec(select(ReadinessScore).where(ReadinessScore.user_id == user_id)).all()
             if r.score is not None and week_start <= r.date <= on]
    avg_readiness = sum(readi) / len(readi) if readi else None

    # Weight trend from the two most recent weight samples (if any); else flat.
    weight_trend = 0.0
    return baseline.calories, WeeklyAdjustInput(
        goal=goal, seven_day_avg_calories=seven_day_avg, weight_trend_kg_per_week=weight_trend,
        protein_adherence_pct=protein_adherence, workout_adherence_pct=workout_adherence,
        avg_readiness=avg_readiness,
    )


@router.post("/weekly-adjustment")
def run_weekly_adjustment(on: dt.date | None = None, user: User = Depends(get_current_user),
                          session: Session = Depends(db)) -> dict:
    on = on or now_utc().date()
    baseline_cal, w = _weekly_inputs(session, user.id, on)
    new_cal, reasons = weekly_adjustment(baseline_cal, w)
    delta = new_cal - baseline_cal

    target = session.exec(
        select(NutritionTarget).where(
            NutritionTarget.user_id == user.id, NutritionTarget.date == on,
        )
    ).first()
    if not target:
        # Create today's target row so the adjustment has somewhere to live.
        b = compute_nutrition_targets(session, user.id, on)
        target = NutritionTarget(
            user_id=user.id, date=on, calories=b.calories, protein_g=b.protein_g,
            carbs_g=b.carbs_g, fat_g=b.fat_g, fiber_g=b.fiber_g, hydration_ml=b.hydration_ml,
            bmr=b.bmr, tdee=b.tdee, rationale=b.rationale,
        )
    target.adjustment_kcal = delta
    target.adjustment_reasons = " ".join(reasons)
    target.updated_at = now_utc()
    session.add(target)
    session.commit()
    return {
        "date": on.isoformat(),
        "baseline_calories": baseline_cal,
        "adjustment_kcal": delta,
        "adjusted_calories": baseline_cal + delta,
        "reasons": reasons,
        "inputs": {
            "seven_day_avg_calories": round(w.seven_day_avg_calories),
            "protein_adherence_pct": round(w.protein_adherence_pct),
            "workout_adherence_pct": round(w.workout_adherence_pct),
            "avg_readiness": round(w.avg_readiness) if w.avg_readiness is not None else None,
        },
    }
