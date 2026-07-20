"""Seed realistic demo data for the primary user (43yo former military/college-baseball athlete).

Idempotent: running twice reuses the demo user. Produces a fully-populated Today dashboard,
2 weeks of Health + sleep, a training week from Calendar, meals, journal, recovery, and labs.

Run:  python -m app.seed        (from apps/api, venv active)
"""
from __future__ import annotations

import datetime as dt

from sqlmodel import Session, select

from app.core.security import hash_password
from app.db.base import create_db_and_tables, engine
from app.engines.calendar_match import match_event, workout_type_for_calendar
from app.engines.dedup import dedup_key
from app.models import (
    CalendarEvent,
    ColdPlungeSession,
    Goal,
    HealthSample,
    Integration,
    JournalEntry,
    LabResult,
    Meal,
    MealItem,
    NotificationPreference,
    NutrientValue,
    Profile,
    SaunaSession,
    SleepSession,
    Supplement,
    User,
    Workout,
    WorkoutSet,
)
from app.services.mock_integrations import (
    mock_calendar_events,
    mock_health_samples,
    mock_sleep_sessions,
)

DEMO_EMAIL = "demo@performanceos.app"
DEMO_PASSWORD = "performance123"
REF = dt.date(2026, 7, 20)


def _today_dt(h: int, m: int = 0, day: dt.date = REF) -> dt.datetime:
    return dt.datetime.combine(day, dt.time(h, m))  # naive UTC (see app.core.timeutil)


def seed() -> str:
    create_db_and_tables()
    with Session(engine) as s:
        user = s.exec(select(User).where(User.email == DEMO_EMAIL)).first()
        if user:
            print(f"Demo user already exists: {DEMO_EMAIL}")
            return user.id
        user = User(email=DEMO_EMAIL, hashed_password=hash_password(DEMO_PASSWORD), onboarded=True)
        s.add(user)
        s.commit()
        s.refresh(user)
        uid = user.id

        s.add(Profile(
            user_id=uid, name="Alex", date_of_birth=dt.date(1983, 4, 12), sex="male",
            height_cm=185.4, weight_kg=86.2, goal_weight_kg=84.0, body_fat_pct=14.0,
            training_experience="advanced", weekly_training_days=6,
            dietary_preferences=["high_protein"], allergies=[], injuries=[],
            medical_restrictions=[], equipment=["dumbbells", "pull-up bar", "bands"],
            wake_time="05:00", bedtime="21:30", units="imperial",
            consent_accepted_at=_today_dt(5),
        ))
        for i, obj in enumerate(["longevity", "athletic_performance", "recomposition"]):
            s.add(Goal(user_id=uid, objective=obj, priority=i + 1))
        for name in ["Creatine 5g", "Vitamin D3 5000IU", "Omega-3", "Magnesium glycinate"]:
            s.add(Supplement(user_id=uid, name=name))
        s.add(NotificationPreference(user_id=uid))
        s.add(Integration(user_id=uid, provider="apple_health", connected=True,
                          status="connected", last_sync_at=_today_dt(5, 30)))
        s.add(Integration(user_id=uid, provider="google_calendar", connected=True,
                          status="connected", last_sync_at=_today_dt(5, 30)))
        s.commit()

        # Health + sleep (14 days)
        for sample in mock_health_samples(uid, days=14, ref=REF):
            s.add(HealthSample(user_id=uid, **sample))
        for sl in mock_sleep_sessions(uid, days=14, ref=REF):
            s.add(SleepSession(user_id=uid, **sl))
        s.commit()

        # Calendar week → workouts
        for e in mock_calendar_events(uid, days=7, ref=REF):
            m = match_event(e["title"], e.get("description"))
            wtype = workout_type_for_calendar(m.matched_type)
            start = e["start_at"]
            w = Workout(user_id=uid, type=wtype, title=e["title"], started_at=start,
                        duration_min=int((e["end_at"] - start).total_seconds() / 60),
                        perceived_effort=7 if wtype == "strength" else 5,
                        source="google_calendar", external_id=e["external_id"],
                        dedup_key=dedup_key(uid, start, wtype), confirmed=True)
            s.add(w)
            s.add(CalendarEvent(user_id=uid, external_id=e["external_id"], title=e["title"],
                                description=e.get("description"), calendar_name=e.get("calendar_name"),
                                start_at=start, end_at=e["end_at"], matched_type=m.matched_type))
            s.commit()
            s.refresh(w)
            if wtype == "strength":
                for ex, load in [("Back Squat", 140), ("Bench Press", 100), ("Pull-up", 0)]:
                    for setno in range(1, 4):
                        s.add(WorkoutSet(workout_id=w.id, exercise_name=ex, set_number=setno,
                                         reps=5 if load else 10, load_kg=load or None, rpe=8,
                                         is_pr=(ex == "Back Squat" and setno == 3)))
        s.commit()

        # A couple of meals today
        _meal(s, uid, "breakfast", "Eggs, oats & berries",
              [("scrambled eggs", 150, 222, 15, 2.4, 16.5, 0),
               ("oatmeal, cooked", 200, 142, 5, 24, 3, 3.4),
               ("blueberries", 80, 46, 0.6, 11, 0.2, 1.9)])
        _meal(s, uid, "lunch", "Chicken rice bowl",
              [("grilled chicken breast", 200, 330, 62, 0, 7.2, 0),
               ("white rice, cooked", 220, 286, 5.9, 62, 0.7, 0.9),
               ("mixed greens salad", 100, 20, 1.5, 3.5, 0.2, 2.1)])

        # Journal today
        s.add(JournalEntry(user_id=uid, date=REF, mood=4, energy=4, stress=2, soreness=2,
                           gratitude="Great sleep and family breakfast.",
                           daily_win="Squat PR at 3x5 @ 140kg", daily_challenge="Busy afternoon",
                           notes="Felt strong through the morning routine."))

        # Recovery
        s.add(SaunaSession(user_id=uid, temperature_c=82, duration_min=20,
                           performed_at=_today_dt(6, 30), session_type="post_workout",
                           subjective_response="relaxed"))
        s.add(ColdPlungeSession(user_id=uid, temperature_c=10, duration_min=3,
                                performed_at=_today_dt(6, 55), session_type="separate",
                                subjective_response="alert"))

        # Labs
        for panel, name, val, unit, lo, hi in [
            ("Lipid", "ApoB", 78, "mg/dL", 0, 90),
            ("Lipid", "LDL", 96, "mg/dL", 0, 100),
            ("Metabolic", "A1C", 5.2, "%", 4.0, 5.6),
            ("Hormones", "Testosterone", 640, "ng/dL", 300, 1000),
            ("Vitamins/Minerals", "Vitamin D", 48, "ng/mL", 30, 80),
            ("Inflammation", "hs-CRP", 0.6, "mg/L", 0, 1.0),
        ]:
            flag = "low" if val < lo else "high" if val > hi else "normal"
            s.add(LabResult(user_id=uid, panel=panel, test_name=name, value=val, unit=unit,
                            reference_low=lo, reference_high=hi, flag=flag,
                            collected_on=REF - dt.timedelta(days=10), laboratory="Quest"))
        s.commit()

    print(f"Seeded demo user: {DEMO_EMAIL} / {DEMO_PASSWORD}")
    return uid


def _meal(s: Session, uid: str, mtype: str, name: str, items: list[tuple]) -> None:
    meal = Meal(user_id=uid, name=name, meal_type=mtype, source="ai_photo",
                overall_confidence=0.8, eaten_at=_today_dt(8 if mtype == "breakfast" else 12),
                assumptions=["Portions estimated from photo."])
    s.add(meal)
    s.commit()
    s.refresh(meal)
    for iname, grams, cal, pro, carb, fat, fiber in items:
        mi = MealItem(meal_id=meal.id, name=iname, estimated_quantity=grams, unit="g",
                      confidence=0.8)
        s.add(mi)
        s.commit()
        s.refresh(mi)
        s.add(NutrientValue(meal_item_id=mi.id, calories=cal, protein_g=pro,
                            carbs_g=carb, fat_g=fat, fiber_g=fiber))
    s.commit()


if __name__ == "__main__":
    seed()
