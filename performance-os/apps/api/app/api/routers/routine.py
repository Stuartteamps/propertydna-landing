from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.api.deps import db, get_current_user
from app.api.routers.readiness import compute_and_store
from app.core.timeutil import now_utc
from app.models import MorningRoutine, RoutineExercise, User
from app.services.daily import generate_routine_for

router = APIRouter(prefix="/routine", tags=["routine"])


def _progression_week(session: Session, user_id: str, on: dt.date) -> int:
    """Weeks since first routine, 1-indexed, cycling 1..4 (week 4 = deload)."""
    first = session.exec(
        select(MorningRoutine).where(MorningRoutine.user_id == user_id)
        .order_by(MorningRoutine.date)
    ).first()
    if not first:
        return 1
    weeks = (on - first.date).days // 7
    return (weeks % 4) + 1


@router.get("/today")
def today_routine(on: dt.date | None = None, user: User = Depends(get_current_user),
                  session: Session = Depends(db)) -> dict:
    from app.core.timeutil import user_today
    from app.services.daily import get_profile_tz
    tz = get_profile_tz(session, user.id)
    on = on or user_today(tz)
    existing = session.exec(
        select(MorningRoutine).where(
            MorningRoutine.user_id == user.id, MorningRoutine.date == on,
        )
    ).first()
    if existing:
        return _serialize(session, existing)

    readiness = compute_and_store(session, user.id, on)
    week = _progression_week(session, user.id, on)
    result = generate_routine_for(session, user.id, on, readiness.band, week, tz)

    routine = MorningRoutine(
        user_id=user.id, date=on, progression_week=result.progression_week,
        intensity_target=result.intensity_target,
        total_duration_min=result.total_duration_min,
        blocks={"is_deload": result.is_deload,
                "blocks": [b.block for b in result.blocks]},
    )
    session.add(routine)
    session.commit()
    session.refresh(routine)
    for order, b in enumerate(result.blocks):
        session.add(RoutineExercise(
            routine_id=routine.id, block=b.block, name=b.name,
            prescription=b.prescription, substitution=b.substitution, order=order,
        ))
    session.commit()
    return _serialize(session, routine)


def _serialize(session: Session, routine: MorningRoutine) -> dict:
    exs = session.exec(
        select(RoutineExercise).where(RoutineExercise.routine_id == routine.id)
        .order_by(RoutineExercise.order)
    ).all()
    return {
        "id": routine.id, "date": routine.date.isoformat(),
        "progression_week": routine.progression_week,
        "is_deload": routine.blocks.get("is_deload", False),
        "intensity_target": routine.intensity_target,
        "total_duration_min": routine.total_duration_min,
        "completed": routine.completed,
        "exercises": [{"block": e.block, "name": e.name, "prescription": e.prescription,
                       "substitution": e.substitution} for e in exs],
    }


@router.post("/{routine_id}/complete")
def complete(routine_id: str, user: User = Depends(get_current_user),
             session: Session = Depends(db)) -> dict:
    r = session.get(MorningRoutine, routine_id)
    if not r or r.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Routine not found")
    r.completed = True
    r.completed_at = now_utc()
    session.add(r)
    session.commit()
    return {"ok": True, "completed": True}
