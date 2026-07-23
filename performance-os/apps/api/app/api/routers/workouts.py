from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.api.deps import db, get_current_user
from app.core.timeutil import now_utc
from app.engines.dedup import dedup_key, is_duplicate
from app.models import Run, User, Workout, WorkoutSet

router = APIRouter(prefix="/workouts", tags=["workouts"])


class SetIn(BaseModel):
    exercise_name: str
    set_number: int = 1
    reps: int | None = None
    load_kg: float | None = None
    rpe: float | None = None
    rest_sec: int | None = None
    tempo: str | None = None
    is_pr: bool = False
    notes: str | None = None


class RunIn(BaseModel):
    distance_km: float | None = None
    duration_min: float | None = None
    avg_pace_min_km: float | None = None
    avg_hr: int | None = None
    elevation_m: float | None = None
    cadence: int | None = None
    zone2_min: float | None = None
    perceived_effort: int | None = None


class WorkoutIn(BaseModel):
    type: str = "strength"
    title: str | None = None
    started_at: dt.datetime | None = None
    duration_min: int | None = None
    perceived_effort: int | None = None
    notes: str | None = None
    source: str = "manual"
    external_id: str | None = None
    sets: list[SetIn] = []
    run: RunIn | None = None


def _find_duplicate(session: Session, user_id: str, wtype: str,
                    started: dt.datetime) -> Workout | None:
    rows = session.exec(select(Workout).where(Workout.user_id == user_id)).all()
    for w in rows:
        if w.deleted_at is None and is_duplicate(w.started_at, w.type, started, wtype):
            return w
    return None


@router.post("", status_code=status.HTTP_201_CREATED)
def create_workout(body: WorkoutIn, user: User = Depends(get_current_user),
                   session: Session = Depends(db)) -> dict:
    started = body.started_at or now_utc()
    dup = _find_duplicate(session, user.id, body.type, started)
    deduped = False
    if dup and body.source != "manual":
        # A sync source describing an already-known session: skip creating a duplicate.
        deduped = True
        workout = dup
    else:
        workout = Workout(
            user_id=user.id, type=body.type, title=body.title, started_at=started,
            duration_min=body.duration_min, perceived_effort=body.perceived_effort,
            notes=body.notes, source=body.source, external_id=body.external_id,
            dedup_key=dedup_key(user.id, started, body.type),
        )
        session.add(workout)
        session.commit()
        session.refresh(workout)
        for s in body.sets:
            session.add(WorkoutSet(workout_id=workout.id, **s.model_dump()))
        if body.run:
            session.add(Run(user_id=user.id, workout_id=workout.id, started_at=started,
                            source=body.source, **body.run.model_dump()))
        session.commit()
    return {"id": workout.id, "deduped": deduped}


@router.get("")
def list_workouts(limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
                  user: User = Depends(get_current_user), session: Session = Depends(db)) -> dict:
    rows = session.exec(
        select(Workout).where(Workout.user_id == user.id, Workout.deleted_at.is_(None))
        .order_by(Workout.started_at.desc()).limit(limit).offset(offset)
    ).all()
    ids = [w.id for w in rows]
    sets_by, run_by = {i: [] for i in ids}, {}
    if ids:
        for s in session.exec(select(WorkoutSet).where(WorkoutSet.workout_id.in_(ids))).all():
            sets_by.setdefault(s.workout_id, []).append(s)
        for r in session.exec(select(Run).where(Run.workout_id.in_(ids))).all():
            run_by[r.workout_id] = r
    out = []
    for w in rows:
        run = run_by.get(w.id)
        out.append({
            "id": w.id, "type": w.type, "title": w.title,
            "started_at": w.started_at.isoformat(), "duration_min": w.duration_min,
            "perceived_effort": w.perceived_effort, "source": w.source,
            "confirmed": w.confirmed,
            "sets": [{"exercise": s.exercise_name, "set": s.set_number, "reps": s.reps,
                      "load_kg": s.load_kg, "rpe": s.rpe, "is_pr": s.is_pr}
                     for s in sets_by.get(w.id, [])],
            "run": ({"distance_km": run.distance_km, "duration_min": run.duration_min,
                     "avg_hr": run.avg_hr, "zone2_min": run.zone2_min} if run else None),
        })
    return {"workouts": out, "limit": limit, "offset": offset, "count": len(out)}


@router.post("/{workout_id}/confirm")
def confirm_workout(workout_id: str, user: User = Depends(get_current_user),
                    session: Session = Depends(db)) -> dict:
    w = session.get(Workout, workout_id)
    if not w or w.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workout not found")
    w.confirmed = True
    session.add(w)
    session.commit()
    return {"ok": True}


@router.delete("/{workout_id}")
def delete_workout(workout_id: str, user: User = Depends(get_current_user),
                   session: Session = Depends(db)) -> dict:
    w = session.get(Workout, workout_id)
    if not w or w.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workout not found")
    w.deleted_at = now_utc()
    session.add(w)
    session.commit()
    return {"ok": True}


@router.get("/weekly-summary")
def weekly_summary(user: User = Depends(get_current_user),
                   session: Session = Depends(db)) -> dict:
    end = dt.date.today()
    start = end - dt.timedelta(days=7)
    workouts = [w for w in session.exec(select(Workout).where(Workout.user_id == user.id)).all()
                if w.deleted_at is None and start <= w.started_at.date() <= end]
    runs = [r for r in session.exec(select(Run).where(Run.user_id == user.id)).all()
            if start <= r.started_at.date() <= end]
    prs = session.exec(select(WorkoutSet).where(WorkoutSet.is_pr)).all()
    strength_volume = 0.0
    for w in workouts:
        for s in session.exec(select(WorkoutSet).where(WorkoutSet.workout_id == w.id)).all():
            strength_volume += (s.reps or 0) * (s.load_kg or 0)
    return {
        "training_days": len({w.started_at.date() for w in workouts}),
        "strength_volume_kg": round(strength_volume),
        "running_km": round(sum(r.distance_km or 0 for r in runs), 1),
        "zone2_min": round(sum(r.zone2_min or 0 for r in runs)),
        "sessions": len(workouts),
        "personal_records": len([p for p in prs
                                 if any(p.workout_id == w.id for w in workouts)]),
    }
