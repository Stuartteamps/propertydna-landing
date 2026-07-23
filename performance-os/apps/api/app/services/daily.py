"""Cross-cutting daily computations built from stored data. Reused by dashboard/readiness/
routine/nutrition endpoints so the logic lives in one place.
"""
from __future__ import annotations

import datetime as dt
import statistics

from sqlmodel import Session, select

from app.core.timeutil import local_date
from app.engines.morning_routine import RoutineInput, generate_routine
from app.engines.nutrition import NutritionInput, compute_targets
from app.engines.readiness import ReadinessInput
from app.models import (
    Goal,
    HealthSample,
    JournalEntry,
    Meal,
    MealItem,
    NutrientValue,
    Profile,
    SleepSession,
    Workout,
)


def _age(dob: dt.date | None, on: dt.date) -> int:
    if not dob:
        return 40
    return on.year - dob.year - ((on.month, on.day) < (dob.month, dob.day))


def get_profile_tz(session: Session, user_id: str) -> str:
    p = session.exec(select(Profile).where(Profile.user_id == user_id)).first()
    return (p.tz if p and p.tz else "UTC")


def latest_metric(session: Session, user_id: str, metric: str, on: dt.date) -> float | None:
    rows = session.exec(
        select(HealthSample)
        .where(HealthSample.user_id == user_id, HealthSample.metric == metric)
        .order_by(HealthSample.recorded_at.desc())
    ).all()
    for r in rows:
        if r.recorded_at.date() <= on:
            return r.value
    return None


def metric_baseline(session: Session, user_id: str, metric: str, on: dt.date,
                    window: int = 14) -> float | None:
    start = on - dt.timedelta(days=window)
    rows = session.exec(
        select(HealthSample).where(
            HealthSample.user_id == user_id, HealthSample.metric == metric,
        )
    ).all()
    vals = [r.value for r in rows if start <= r.recorded_at.date() <= on]
    return statistics.mean(vals) if len(vals) >= 3 else None


def sleep_for(session: Session, user_id: str, on: dt.date) -> SleepSession | None:
    return session.exec(
        select(SleepSession).where(
            SleepSession.user_id == user_id, SleepSession.date == on,
        )
    ).first()


def sleep_std(session: Session, user_id: str, on: dt.date, window: int = 7) -> float | None:
    start = on - dt.timedelta(days=window)
    rows = session.exec(select(SleepSession).where(SleepSession.user_id == user_id)).all()
    vals = [r.duration_min for r in rows if start <= r.date <= on]
    return statistics.pstdev(vals) if len(vals) >= 3 else None


def training_load(session: Session, user_id: str, on: dt.date, days: int,
                  tz: str = "UTC") -> float:
    start = on - dt.timedelta(days=days)
    rows = session.exec(select(Workout).where(Workout.user_id == user_id)).all()
    total = 0.0
    for w in rows:
        if start <= local_date(w.started_at, tz) <= on and w.deleted_at is None:
            total += (w.duration_min or 45) * (w.perceived_effort or 5)
    return total


def todays_workout(session: Session, user_id: str, on: dt.date, tz: str = "UTC") -> Workout | None:
    rows = session.exec(
        select(Workout).where(Workout.user_id == user_id).order_by(Workout.started_at)
    ).all()
    for w in rows:
        if local_date(w.started_at, tz) == on and w.deleted_at is None:
            return w
    return None


def primary_goal(session: Session, user_id: str) -> str:
    g = session.exec(
        select(Goal).where(Goal.user_id == user_id, Goal.active).order_by(Goal.priority)
    ).first()
    return g.objective if g else "general_health"


_TOTAL_FIELDS = [
    "calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "sugar_g", "sodium_mg",
    "potassium_mg", "calcium_mg", "iron_mg", "magnesium_mg", "vitamin_a_ug", "vitamin_c_mg",
    "vitamin_d_ug", "vitamin_b12_ug", "folate_ug", "cholesterol_mg",
]


def consumed_totals(session: Session, user_id: str, on: dt.date, tz: str = "UTC") -> dict:
    meals = session.exec(select(Meal).where(Meal.user_id == user_id)).all()
    meal_ids = [m.id for m in meals if local_date(m.eaten_at, tz) == on and m.deleted_at is None]
    totals = {f: 0.0 for f in _TOTAL_FIELDS}
    if not meal_ids:
        return {k: round(v) for k, v in totals.items()}
    items = session.exec(select(MealItem).where(MealItem.meal_id.in_(meal_ids))).all()
    item_ids = [i.id for i in items]
    if item_ids:
        nvs = session.exec(
            select(NutrientValue).where(NutrientValue.meal_item_id.in_(item_ids))
        ).all()
        for nv in nvs:
            for f in _TOTAL_FIELDS:
                totals[f] += getattr(nv, f)
    return {k: round(v) for k, v in totals.items()}


def build_readiness_input(session: Session, user_id: str, on: dt.date,
                          sleep_target: float = 480, tz: str = "UTC") -> ReadinessInput:
    sleep = sleep_for(session, user_id, on)
    j = session.exec(
        select(JournalEntry).where(
            JournalEntry.user_id == user_id, JournalEntry.date == on,
        )
    ).first()
    return ReadinessInput(
        sleep_minutes=sleep.duration_min if sleep else None,
        sleep_target_minutes=sleep_target,
        sleep_std_minutes=sleep_std(session, user_id, on),
        hrv_ms=latest_metric(session, user_id, "hrv", on),
        hrv_baseline_ms=metric_baseline(session, user_id, "hrv", on),
        resting_hr=latest_metric(session, user_id, "resting_hr", on),
        resting_hr_baseline=metric_baseline(session, user_id, "resting_hr", on),
        acute_load=training_load(session, user_id, on, 3, tz),
        chronic_load=training_load(session, user_id, on, 28, tz) / 28 * 3 if
        training_load(session, user_id, on, 28, tz) else None,
        soreness=j.soreness if j else None,
        mood=j.mood if j else None,
        energy=j.energy if j else None,
        illness=None,
    )


def compute_nutrition_targets(session: Session, user_id: str, on: dt.date, tz: str = "UTC"):
    profile = session.exec(select(Profile).where(Profile.user_id == user_id)).first()
    goal = primary_goal(session, user_id)
    workout = todays_workout(session, user_id, on, tz)
    active = latest_metric(session, user_id, "active_energy", on) or 0.0
    hard = bool(workout and (workout.perceived_effort or 0) >= 7)
    inp = NutritionInput(
        sex=(profile.sex if profile and profile.sex else "male"),
        age=_age(profile.date_of_birth if profile else None, on),
        height_cm=(profile.height_cm if profile and profile.height_cm else 185.0),
        weight_kg=(profile.weight_kg if profile and profile.weight_kg else 86.0),
        experience=(profile.training_experience if profile and profile.training_experience
                    else "advanced"),
        primary_goal=goal,
        training_load_kcal=active,
        has_hard_session_today=hard,
    )
    return compute_targets(inp)


def build_routine_input(session: Session, user_id: str, on: dt.date,
                        readiness_band: str, progression_week: int,
                        tz: str = "UTC") -> RoutineInput:
    profile = session.exec(select(Profile).where(Profile.user_id == user_id)).first()
    today = todays_workout(session, user_id, on, tz)
    yesterday = todays_workout(session, user_id, on - dt.timedelta(days=1), tz)
    j = session.exec(
        select(JournalEntry).where(
            JournalEntry.user_id == user_id, JournalEntry.date == on,
        )
    ).first()
    return RoutineInput(
        main_workout_today=(today.title or today.type) if today else None,
        main_workout_yesterday=(yesterday.title or yesterday.type) if yesterday else None,
        running_volume_week_km=0.0,
        readiness_band=readiness_band,
        soreness=j.soreness if j else None,
        injuries=(profile.injuries if profile else []) or [],
        equipment=(profile.equipment if profile else []) or [],
        progression_week=progression_week,
    )


def generate_routine_for(session: Session, user_id: str, on: dt.date,
                         readiness_band: str, progression_week: int, tz: str = "UTC"):
    return generate_routine(
        build_routine_input(session, user_id, on, readiness_band, progression_week, tz)
    )
