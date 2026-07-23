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


# ---- Sliding-window rate limiter ----
# In-process by default (resets on restart, not shared across workers). For multi-worker deploys
# swap `_check` for a Redis/DB-backed store — the dependency signatures stay the same.
_hits: dict[str, deque[float]] = defaultdict(deque)


def _check(key: str, per_minute: int) -> None:
    now = time.time()
    window = _hits[key]
    while window and now - window[0] > 60:
        window.popleft()
    if len(window) >= per_minute:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Rate limit exceeded")
    window.append(now)


def _subject_or_ip(request: Request, authorization: str | None) -> str:
    """Prefer the authenticated user id (fair per-user limits); fall back to client IP."""
    if authorization and authorization.lower().startswith("bearer "):
        try:
            return "u:" + str(decode_access_token(authorization.split(" ", 1)[1]).get("sub"))
        except Exception:  # noqa: BLE001
            pass
    return "ip:" + (request.client.host if request.client else "anon")


def rate_limit(request: Request, authorization: str | None = Header(default=None)) -> None:
    """General per-user/IP limiter."""
    _check(_subject_or_ip(request, authorization), settings.RATE_LIMIT_PER_MINUTE)


def ai_rate_limit(request: Request, authorization: str | None = Header(default=None)) -> None:
    """Stricter limiter for expensive AI/upload/export routes, keyed by user id."""
    _check("ai:" + _subject_or_ip(request, authorization), settings.AI_RATE_LIMIT_PER_MINUTE)


def audit(session: Session, action: str, user_id: str | None = None,
          resource: str | None = None, meta: dict | None = None) -> None:
    """Append an audit log row. Never store sensitive health values in `meta`."""
    session.add(AuditLog(user_id=user_id, action=action, resource=resource, meta=meta or {}))
    session.commit()


def get_user_by_email(session: Session, email: str) -> User | None:
    return session.exec(select(User).where(User.email == email)).first()
