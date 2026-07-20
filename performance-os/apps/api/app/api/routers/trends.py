from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.ai.factory import get_coaching_provider
from app.api.deps import db, get_current_user
from app.models import (
    ColdPlungeSession,
    HealthSample,
    ReadinessScore,
    Run,
    SaunaSession,
    SleepSession,
    User,
    Workout,
)
from app.services.daily import consumed_totals

router = APIRouter(prefix="/trends", tags=["trends"])


@router.get("/series")
def series(metric: str, days: int = 30, user: User = Depends(get_current_user),
           session: Session = Depends(db)) -> dict:
    """Time series for a chartable metric."""
    end = dt.date.today()
    start = end - dt.timedelta(days=days)
    points: list[dict] = []

    if metric in ("hrv", "resting_hr", "vo2max", "steps", "active_energy", "respiratory_rate"):
        rows = session.exec(select(HealthSample).where(
            HealthSample.user_id == user.id, HealthSample.metric == metric)).all()
        for r in rows:
            if start <= r.recorded_at.date() <= end:
                points.append({"date": r.recorded_at.date().isoformat(), "value": r.value})
    elif metric == "sleep":
        rows = session.exec(select(SleepSession).where(SleepSession.user_id == user.id)).all()
        for r in rows:
            if start <= r.date <= end:
                points.append({"date": r.date.isoformat(), "value": round(r.duration_min / 60, 2)})
    elif metric == "readiness":
        rows = session.exec(select(ReadinessScore).where(ReadinessScore.user_id == user.id)).all()
        for r in rows:
            if start <= r.date <= end and r.score is not None:
                points.append({"date": r.date.isoformat(), "value": r.score})
    elif metric in ("calories", "protein_g", "carbs_g", "fat_g", "fiber_g"):
        d = start
        while d <= end:
            totals = consumed_totals(session, user.id, d)
            if totals.get("calories"):
                points.append({"date": d.isoformat(), "value": totals.get(metric, 0)})
            d += dt.timedelta(days=1)
    elif metric == "running_km":
        rows = session.exec(select(Run).where(Run.user_id == user.id)).all()
        agg: dict[str, float] = {}
        for r in rows:
            if start <= r.started_at.date() <= end:
                agg[r.started_at.date().isoformat()] = agg.get(
                    r.started_at.date().isoformat(), 0) + (r.distance_km or 0)
        points = [{"date": k, "value": round(v, 1)} for k, v in sorted(agg.items())]

    points.sort(key=lambda p: p["date"])
    return {"metric": metric, "points": points}


@router.get("/weekly-report")
def weekly_report(user: User = Depends(get_current_user),
                  session: Session = Depends(db)) -> dict:
    end = dt.date.today()
    start = end - dt.timedelta(days=7)
    prev_start = start - dt.timedelta(days=7)

    def avg_metric(metric: str, s: dt.date, e: dt.date) -> float | None:
        rows = session.exec(select(HealthSample).where(
            HealthSample.user_id == user.id, HealthSample.metric == metric)).all()
        vals = [r.value for r in rows if s <= r.recorded_at.date() <= e]
        return round(sum(vals) / len(vals), 1) if vals else None

    def avg_sleep(s: dt.date, e: dt.date) -> float | None:
        rows = session.exec(select(SleepSession).where(SleepSession.user_id == user.id)).all()
        vals = [r.duration_min for r in rows if s <= r.date <= e]
        return round(sum(vals) / len(vals) / 60, 2) if vals else None

    workouts = [w for w in session.exec(select(Workout).where(Workout.user_id == user.id)).all()
                if w.deleted_at is None and start <= w.started_at.date() <= end]
    runs = [r for r in session.exec(select(Run).where(Run.user_id == user.id)).all()
            if start <= r.started_at.date() <= end]
    saunas = [s for s in session.exec(select(SaunaSession).where(
        SaunaSession.user_id == user.id)).all() if start <= s.performed_at.date() <= end]
    plunges = [p for p in session.exec(select(ColdPlungeSession).where(
        ColdPlungeSession.user_id == user.id)).all() if start <= p.performed_at.date() <= end]

    hrv_now, hrv_prev = avg_metric("hrv", start, end), avg_metric("hrv", prev_start, start)
    sleep_now, sleep_prev = avg_sleep(start, end), avg_sleep(prev_start, start)

    improved, declined = [], []
    if hrv_now and hrv_prev:
        (improved if hrv_now >= hrv_prev else declined).append(
            f"HRV {hrv_now}ms vs {hrv_prev}ms last week")
    if sleep_now and sleep_prev:
        (improved if sleep_now >= sleep_prev else declined).append(
            f"Sleep {sleep_now}h vs {sleep_prev}h last week")

    protein_days = 0
    d = start
    while d <= end:
        if consumed_totals(session, user.id, d).get("protein_g", 0) >= 150:
            protein_days += 1
        d += dt.timedelta(days=1)

    context = {"hrv": hrv_now, "sleep_h": sleep_now, "training_days":
               len({w.started_at.date() for w in workouts})}
    return {
        "range": {"start": start.isoformat(), "end": end.isoformat()},
        "improved": improved or ["Consistency held steady"],
        "declined": declined or [],
        "adherence": {
            "training_days": len({w.started_at.date() for w in workouts}),
            "protein_days_hit": protein_days,
        },
        "recovery": {"avg_hrv": hrv_now, "avg_sleep_h": sleep_now,
                     "sauna_sessions": len(saunas), "cold_plunge_sessions": len(plunges)},
        "training": {"sessions": len(workouts),
                     "running_km": round(sum(r.distance_km or 0 for r in runs), 1)},
        "nutrition_gaps": [] if protein_days >= 5 else ["Protein target missed on some days"],
        "priorities_next_week": _priorities(sleep_now, protein_days, len(workouts)),
        "summary": get_coaching_provider().weekly_summary(context),
    }


def _priorities(sleep_h: float | None, protein_days: int, sessions: int) -> list[str]:
    out = []
    if sleep_h is not None and sleep_h < 7.5:
        out.append("Move bedtime ~20 min earlier to lift readiness.")
    if protein_days < 5:
        out.append("Hit protein target at least 6/7 days.")
    if sessions < 3:
        out.append("Aim for 3+ quality training sessions.")
    return out or ["Maintain current momentum; consider a small progressive-overload bump."]
