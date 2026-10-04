"""Bearer JWT (issued by Supabase Auth) -> current `User` row.

Verification order:
1. HS256 with SUPABASE_JWT_SECRET, when it is set (legacy Supabase projects, local dev, tests).
2. Asymmetric keys from the project's JWKS endpoint (current Supabase projects).

The role always comes from our `users` table, never from the token.
"""

import uuid
from functools import lru_cache

import jwt
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.errors import ApiError
from app.database import get_db
from app.models import User

_bearer = HTTPBearer(auto_error=False)

_UNAUTHORIZED = ApiError(401, "unauthorized", "Sign in required")


@lru_cache
def _jwks_client(url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(url, cache_keys=True, lifespan=3600)


def decode_token(token: str) -> dict:
    s = get_settings()
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg")
        if alg == "HS256":
            if not s.supabase_jwt_secret:
                raise _UNAUTHORIZED
            key = s.supabase_jwt_secret
        elif alg in ("RS256", "ES256") and s.supabase_url:
            key = _jwks_client(f"{s.supabase_url}/auth/v1/.well-known/jwks.json").get_signing_key_from_jwt(token).key
        else:
            raise _UNAUTHORIZED
        claims = jwt.decode(
            token, key, algorithms=[alg], audience=s.jwt_audience, options={"require": ["exp", "sub"]}
        )
    except jwt.ExpiredSignatureError:
        raise ApiError(401, "session_expired", "Your session has expired. Please sign in again.")
    except (jwt.PyJWTError, ValueError):
        raise _UNAUTHORIZED
    if claims.get("typ") == "refresh":
        raise _UNAUTHORIZED
    return claims


def _load_user(request: Request, creds: HTTPAuthorizationCredentials | None, db: Session) -> User:
    if creds is None or creds.scheme.lower() != "bearer":
        raise _UNAUTHORIZED
    claims = decode_token(creds.credentials)
    try:
        user_id = uuid.UUID(claims["sub"])
    except ValueError:
        raise _UNAUTHORIZED
    user = db.get(User, user_id)
    if user is None:
        raise _UNAUTHORIZED
    if not user.is_active:
        raise ApiError(403, "account_inactive", "This account is disabled")
    request.state.user = user
    return user


def get_current_user_allow_pending(
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    """Any signed-in, active user, including one who still has to change a temporary password.
    Only /me and /auth/change-password use this."""
    return _load_user(request, creds, db)


def get_current_user(user: User = Depends(get_current_user_allow_pending)) -> User:
    if user.must_change_password:
        raise ApiError(403, "password_change_required", "You must change your temporary password first")
    return user
