from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from passlib.context import CryptContext
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import User as TokenUser
from app.auth import current_user
from app.config import Settings, get_settings
from app.db import get_db
from app.models import User
from app.schemas import Login, MeOut, Register, Token

router = APIRouter(prefix="/api/auth", tags=["auth"])

# argon2 rather than bcrypt: passlib misreads bcrypt 4.x's version and logs a spurious
# error on every hash. Same one-line contract, no warning, no 72-byte input limit.
passwords = CryptContext(schemes=["argon2"], deprecated="auto")


def _token(user: User, settings: Settings) -> Token:
    claims = {
        "sub": str(user.id),
        "username": user.username,
        "email": user.email,
        "exp": datetime.now(timezone.utc) + timedelta(days=settings.jwt_days),
    }
    return Token(
        access_token=jwt.encode(claims, settings.jwt_secret, algorithm="HS256"),
        username=user.username,
    )


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(
    payload: Register,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> Token:
    user = User(
        username=payload.username,
        email=payload.email,
        password_hash=passwords.hash(payload.password),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Username or email is taken") from exc
    return _token(user, settings)


@router.post("/login", response_model=Token)
def login(
    payload: Login,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> Token:
    # ponytail: no rate limit — argon2 makes each guess cost ~100ms, and this app has
    # one user. Put a limiter in front if it ever has more.
    user = db.scalar(
        select(User).where(or_(User.username == payload.username, User.email == payload.username))
    )
    if user is None or not passwords.verify(payload.password, user.password_hash):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Wrong username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _token(user, settings)


@router.get("/me", response_model=MeOut)
def me(user: TokenUser = Depends(current_user)) -> TokenUser:
    return user
