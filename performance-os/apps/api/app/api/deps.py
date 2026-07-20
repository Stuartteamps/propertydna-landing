"""Shared FastAPI dependencies: DB session, current user, rate limiting, audit."""
from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import Depends, Header, HTTPException, Request, status
from sqlmodel import Session, select

from app.core.config import settings
from app.core.security import decode_access_token
from app.db.base import get_session
from app.models import AuditLog, User


def db() -> Session:
    yield from get_session()


def get_current_user(
    authorization: str | None = Header(default=None),
    session: Session = Depends(db),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = decode_access_token(token)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token") from e
    user = session.get(User, payload.get("sub"))
    if not user or not user.is_active or user.deleted_at is not None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return user


# ---- Simple in-memory sliding-window rate limiter (per user/IP) ----
_hits: dict[str, deque[float]] = defaultdict(deque)


def rate_limit(request: Request) -> None:
    key = request.client.host if request.client else "anon"
    now = time.time()
    window = _hits[key]
    while window and now - window[0] > 60:
        window.popleft()
    if len(window) >= settings.RATE_LIMIT_PER_MINUTE:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Rate limit exceeded")
    window.append(now)


def audit(session: Session, action: str, user_id: str | None = None,
          resource: str | None = None, meta: dict | None = None) -> None:
    """Append an audit log row. Never store sensitive health values in `meta`."""
    session.add(AuditLog(user_id=user_id, action=action, resource=resource, meta=meta or {}))
    session.commit()


def get_user_by_email(session: Session, email: str) -> User | None:
    return session.exec(select(User).where(User.email == email)).first()
