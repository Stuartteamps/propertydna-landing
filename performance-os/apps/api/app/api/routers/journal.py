from __future__ import annotations

import datetime as dt
from collections import Counter

from fastapi import APIRouter, Depends, File, Query, UploadFile
from pydantic import BaseModel
from sqlmodel import Session, select

from app.ai.factory import get_coaching_provider, get_transcription_provider
from app.api.deps import ai_rate_limit, db, get_current_user
from app.core.timeutil import now_utc
from app.models import JournalEntry, User

router = APIRouter(prefix="/journal", tags=["journal"])


class JournalIn(BaseModel):
    date: dt.date | None = None
    mood: int | None = None
    energy: int | None = None
    stress: int | None = None
    soreness: int | None = None
    gratitude: str | None = None
    daily_win: str | None = None
    daily_challenge: str | None = None
    notes: str | None = None


@router.post("")
def upsert(body: JournalIn, user: User = Depends(get_current_user),
           session: Session = Depends(db)) -> dict:
    on = body.date or dt.date.today()
    entry = session.exec(
        select(JournalEntry).where(
            JournalEntry.user_id == user.id, JournalEntry.date == on,
        )
    ).first()
    entry = entry or JournalEntry(user_id=user.id, date=on)
    for k, v in body.model_dump(exclude={"date"}, exclude_none=True).items():
        setattr(entry, k, v)
    entry.updated_at = now_utc()
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return {"id": entry.id, "date": entry.date.isoformat()}


@router.post("/voice")
async def voice_entry(file: UploadFile = File(...), user: User = Depends(get_current_user),
                      session: Session = Depends(db), _rl: None = Depends(ai_rate_limit)) -> dict:
    """Transcribe an audio note (mock transcription by default) into the day's journal notes."""
    audio = await file.read()
    text = get_transcription_provider().transcribe(audio)
    on = dt.date.today()
    entry = session.exec(
        select(JournalEntry).where(
            JournalEntry.user_id == user.id, JournalEntry.date == on,
        )
    ).first()
    entry = entry or JournalEntry(user_id=user.id, date=on)
    entry.notes = ((entry.notes + " ") if entry.notes else "") + text
    entry.voice_transcribed = True
    session.add(entry)
    session.commit()
    return {"ok": True, "transcript": text}


@router.get("")
def list_entries(days: int = Query(14, ge=1, le=365),
                 limit: int = Query(100, ge=1, le=366), offset: int = Query(0, ge=0),
                 user: User = Depends(get_current_user), session: Session = Depends(db)) -> dict:
    start = dt.date.today() - dt.timedelta(days=days)
    rows = session.exec(
        select(JournalEntry)
        .where(JournalEntry.user_id == user.id, JournalEntry.date >= start)  # filter in SQL
        .order_by(JournalEntry.date.desc()).limit(limit).offset(offset)
    ).all()
    return {"entries": [
        {"date": e.date.isoformat(), "mood": e.mood, "energy": e.energy, "stress": e.stress,
         "soreness": e.soreness, "gratitude": e.gratitude, "daily_win": e.daily_win,
         "daily_challenge": e.daily_challenge, "notes": e.notes}
        for e in rows
    ], "limit": limit, "offset": offset, "count": len(rows)}


@router.get("/weekly-summary")
def weekly_summary(user: User = Depends(get_current_user),
                   session: Session = Depends(db)) -> dict:
    end = dt.date.today()
    start = end - dt.timedelta(days=7)
    rows = [e for e in
            session.exec(select(JournalEntry).where(JournalEntry.user_id == user.id)).all()
            if start <= e.date <= end]

    def avg(vals):
        vals = [v for v in vals if v is not None]
        return round(sum(vals) / len(vals), 1) if vals else None

    wins = [e.daily_win for e in rows if e.daily_win]
    challenges = [e.daily_challenge for e in rows if e.daily_challenge]
    words = Counter()
    for e in rows:
        for text in (e.notes, e.daily_win, e.daily_challenge):
            if text:
                words.update(w.lower() for w in text.split() if len(w) > 4)
    context = {
        "avg_mood": avg([e.mood for e in rows]),
        "avg_energy": avg([e.energy for e in rows]),
        "avg_stress": avg([e.stress for e in rows]),
    }
    return {
        **context,
        "entries": len(rows),
        "wins": wins[:5],
        "concerns": challenges[:5],
        "common_themes": [w for w, _ in words.most_common(5)],
        "summary": get_coaching_provider().weekly_summary(context),
        "disclaimer": "Journaling summaries are reflective, not a mental-health diagnosis.",
    }
