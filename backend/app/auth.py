"""Keycloak bearer-token validation.

Tokens are RS256-signed by the realm; we fetch the realm JWKS once (PyJWKClient
caches keys and re-fetches on rotation) and validate signature, expiry and issuer.
Keycloak puts the API's own audience in `aud` only when a client scope maps it,
so audience verification is opt-in via KEYCLOAK_AUDIENCE.
"""

from dataclasses import dataclass
from functools import lru_cache

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


@lru_cache
def _jwk_client(jwks_url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(jwks_url, cache_keys=True)


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
        key = _jwk_client(settings.jwks_url).get_signing_key_from_jwt(creds.credentials)
        claims = jwt.decode(
            creds.credentials,
            key.key,
            algorithms=["RS256"],
            issuer=settings.keycloak_issuer,
            audience=settings.keycloak_audience or None,
            options={"verify_aud": bool(settings.keycloak_audience)},
        )
    except jwt.PyJWTError as exc:
        raise _unauthorized(f"Invalid token: {exc}") from exc

    sub = claims.get("sub")
    if not sub:
        raise _unauthorized("Token has no subject")

    return User(id=sub, username=claims.get("preferred_username"), email=claims.get("email"))
