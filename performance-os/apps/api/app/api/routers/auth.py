from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr
from sqlmodel import Session

from app.api.deps import audit, db, get_current_user, get_user_by_email, rate_limit
from app.core.security import create_access_token, hash_password, verify_password
from app.models import NotificationPreference, User

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterIn(BaseModel):
    email: EmailStr
    password: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    onboarded: bool


class MeOut(BaseModel):
    id: str
    email: str
    onboarded: bool


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterIn, request: Request, session: Session = Depends(db),
             _: None = Depends(rate_limit)) -> TokenOut:
    if len(body.password) < 8:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            "Password must be at least 8 characters")
    if get_user_by_email(session, body.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    user = User(email=body.email, hashed_password=hash_password(body.password))
    session.add(user)
    session.commit()
    session.refresh(user)
    session.add(NotificationPreference(user_id=user.id))
    session.commit()
    audit(session, "register", user_id=user.id)
    return TokenOut(access_token=create_access_token(user.id), user_id=user.id,
                    onboarded=user.onboarded)


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, request: Request, session: Session = Depends(db),
          _: None = Depends(rate_limit)) -> TokenOut:
    user = get_user_by_email(session, body.email)
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    audit(session, "login", user_id=user.id)
    return TokenOut(access_token=create_access_token(user.id), user_id=user.id,
                    onboarded=user.onboarded)


@router.get("/me", response_model=MeOut)
def me(user: User = Depends(get_current_user)) -> MeOut:
    return MeOut(id=user.id, email=user.email, onboarded=user.onboarded)
