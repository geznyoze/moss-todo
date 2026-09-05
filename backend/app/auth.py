"""Bearer-token validation.

Tokens are HS256, minted by /api/auth/login and signed with JWT_SECRET. Nothing is
fetched over the network to verify one — the secret is right here — so this is a
signature and expiry check and nothing else.
"""

from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import Settings, get_settings

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class User:
    id: str
    username: str | None
    email: str | None


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    settings: Settings = Depends(get_settings),
) -> User:
    if not settings.auth_enabled:
        return User(id="dev-user", username="dev", email="dev@example.com")

    if creds is None:
        raise _unauthorized("Missing bearer token")

    try:
        claims = jwt.decode(creds.credentials, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise _unauthorized(f"Invalid token: {exc}") from exc

    sub = claims.get("sub")
    if not sub:
        raise _unauthorized("Token has no subject")

    return User(id=sub, username=claims.get("username"), email=claims.get("email"))
