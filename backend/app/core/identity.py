"""The identity provider behind login: Supabase Auth (GoTrue), or a dev-only local stand-in.

The browser never calls Supabase. The backend maps a username to an internal email
(`emp084` -> `emp084@users.ariba-hr.internal`) and talks to GoTrue with the anon key
(password/refresh grants) or the service-role key (admin operations).

`LocalDevIdentity` exists so the app can be run end to end before a Supabase project is
configured. It is refused outside development/test and whenever SUPABASE_URL is set.
"""

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import httpx
import jwt

from app.config import Settings, get_settings
from app.core.errors import ApiError


@dataclass
class AuthSession:
    access_token: str
    refresh_token: str
    expires_in: int
    user_id: uuid.UUID


class IdentityProvider(Protocol):
    def sign_in(self, email: str, password: str) -> AuthSession: ...
    def refresh(self, refresh_token: str) -> AuthSession: ...
    def sign_out(self, access_token: str) -> None: ...
    def create_user(self, email: str, password: str, role: str) -> uuid.UUID: ...
    def set_password(self, user_id: uuid.UUID, password: str) -> None: ...
    def set_role(self, user_id: uuid.UUID, role: str) -> None: ...


def internal_email(username: str, settings: Settings | None = None) -> str:
    s = settings or get_settings()
    return f"{username.strip().lower()}@{s.internal_email_domain}"


_INVALID = ApiError(401, "invalid_credentials", "Invalid username or password")


# --------------------------------------------------------------------------- Supabase


class SupabaseIdentity:
    def __init__(self, settings: Settings):
        self.s = settings
        self.base = f"{settings.supabase_url}/auth/v1"

    def _client(self) -> httpx.Client:
        return httpx.Client(timeout=10)

    def _public_headers(self) -> dict:
        return {"apikey": self.s.supabase_anon_key, "Content-Type": "application/json"}

    def _admin_headers(self) -> dict:
        key = self.s.supabase_service_role_key
        return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}

    @staticmethod
    def _session(data: dict) -> AuthSession:
        return AuthSession(
            access_token=data["access_token"],
            refresh_token=data["refresh_token"],
            expires_in=int(data.get("expires_in", 3600)),
            user_id=uuid.UUID(data["user"]["id"]),
        )

    def _upstream_error(self, r: httpx.Response) -> ApiError:
        if r.status_code in (400, 401, 422):
            return _INVALID
        if r.status_code == 429:
            return ApiError(429, "rate_limited", "Too many attempts. Try again later.")
        return ApiError(502, "auth_unavailable", "The sign-in service is unavailable")

    def sign_in(self, email: str, password: str) -> AuthSession:
        with self._client() as c:
            r = c.post(
                f"{self.base}/token?grant_type=password",
                headers=self._public_headers(),
                json={"email": email, "password": password},
            )
        if r.status_code != 200:
            raise self._upstream_error(r)
        return self._session(r.json())

    def refresh(self, refresh_token: str) -> AuthSession:
        with self._client() as c:
            r = c.post(
                f"{self.base}/token?grant_type=refresh_token",
                headers=self._public_headers(),
                json={"refresh_token": refresh_token},
            )
        if r.status_code != 200:
            raise ApiError(401, "session_expired", "Your session has expired. Please sign in again.")
        return self._session(r.json())

    def sign_out(self, access_token: str) -> None:
        with self._client() as c:
            c.post(
                f"{self.base}/logout",
                headers={**self._public_headers(), "Authorization": f"Bearer {access_token}"},
            )

    def create_user(self, email: str, password: str, role: str) -> uuid.UUID:
        with self._client() as c:
            r = c.post(
                f"{self.base}/admin/users",
                headers=self._admin_headers(),
                json={
                    "email": email,
                    "password": password,
                    "email_confirm": True,
                    "app_metadata": {"role": role},
                },
            )
        if r.status_code not in (200, 201):
            if r.status_code == 422:
                raise ApiError(409, "conflict", "A login with this username already exists")
            raise ApiError(502, "auth_unavailable", "Could not create the login")
        return uuid.UUID(r.json()["id"])

    def _admin_update(self, user_id: uuid.UUID, body: dict) -> None:
        with self._client() as c:
            r = c.put(f"{self.base}/admin/users/{user_id}", headers=self._admin_headers(), json=body)
        if r.status_code != 200:
            raise ApiError(502, "auth_unavailable", "Could not update the login")

    def set_password(self, user_id: uuid.UUID, password: str) -> None:
        self._admin_update(user_id, {"password": password})

    def set_role(self, user_id: uuid.UUID, role: str) -> None:
        # Copied into the JWT so the frontend middleware can mirror routing. The backend
        # never trusts this claim: it always reads the role from the users table.
        self._admin_update(user_id, {"app_metadata": {"role": role}})


# --------------------------------------------------------------------------- local dev


class LocalDevIdentity:
    """File-backed stand-in for GoTrue. Development and tests only."""

    ACCESS_TTL = 3600
    REFRESH_TTL = 7 * 24 * 3600

    def __init__(self, settings: Settings, path: Path | None = None):
        if settings.env == "production" or settings.supabase_url:
            raise RuntimeError("LocalDevIdentity is only allowed in development/test without Supabase")
        if not settings.supabase_jwt_secret:
            raise RuntimeError("Set SUPABASE_JWT_SECRET (any long random string) to use local dev auth")
        self.s = settings
        self.path = path or Path(os.environ.get("LOCAL_AUTH_FILE", ".local_auth.json"))

    def _load(self) -> dict:
        if self.path.exists():
            return json.loads(self.path.read_text())
        return {}

    def _save(self, data: dict) -> None:
        self.path.write_text(json.dumps(data, indent=2))

    @staticmethod
    def _hash(password: str, salt: bytes) -> str:
        return base64.b64encode(hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 200_000)).decode()

    def _token(self, user_id: str, email: str, role: str, kind: str, ttl: int) -> str:
        now = int(time.time())
        claims = {
            "sub": user_id,
            "email": email,
            "aud": self.s.jwt_audience,
            "role": "authenticated",
            "app_metadata": {"role": role},
            "iat": now,
            "exp": now + ttl,
            "typ": kind,
        }
        return jwt.encode(claims, self.s.supabase_jwt_secret, algorithm="HS256")

    def _session_for(self, email: str, rec: dict) -> AuthSession:
        return AuthSession(
            access_token=self._token(rec["id"], email, rec["role"], "access", self.ACCESS_TTL),
            refresh_token=self._token(rec["id"], email, rec["role"], "refresh", self.REFRESH_TTL),
            expires_in=self.ACCESS_TTL,
            user_id=uuid.UUID(rec["id"]),
        )

    def sign_in(self, email: str, password: str) -> AuthSession:
        rec = self._load().get(email)
        if not rec:
            raise _INVALID
        expected = self._hash(password, base64.b64decode(rec["salt"]))
        if not hmac.compare_digest(expected, rec["hash"]):
            raise _INVALID
        return self._session_for(email, rec)

    def refresh(self, refresh_token: str) -> AuthSession:
        try:
            claims = jwt.decode(
                refresh_token, self.s.supabase_jwt_secret, algorithms=["HS256"], audience=self.s.jwt_audience
            )
        except jwt.PyJWTError:
            raise ApiError(401, "session_expired", "Your session has expired. Please sign in again.")
        if claims.get("typ") != "refresh":
            raise ApiError(401, "session_expired", "Your session has expired. Please sign in again.")
        email = claims["email"]
        rec = self._load().get(email)
        if not rec:
            raise ApiError(401, "session_expired", "Your session has expired. Please sign in again.")
        return self._session_for(email, rec)

    def sign_out(self, access_token: str) -> None:
        return None

    def create_user(self, email: str, password: str, role: str) -> uuid.UUID:
        data = self._load()
        if email in data:
            raise ApiError(409, "conflict", "A login with this username already exists")
        salt = secrets.token_bytes(16)
        uid = str(uuid.uuid4())
        data[email] = {"id": uid, "role": role, "salt": base64.b64encode(salt).decode(), "hash": self._hash(password, salt)}
        self._save(data)
        return uuid.UUID(uid)

    def _find(self, data: dict, user_id: uuid.UUID) -> dict:
        for rec in data.values():
            if rec["id"] == str(user_id):
                return rec
        raise ApiError(404, "not_found", "Login not found")

    def set_password(self, user_id: uuid.UUID, password: str) -> None:
        data = self._load()
        rec = self._find(data, user_id)
        salt = secrets.token_bytes(16)
        rec["salt"] = base64.b64encode(salt).decode()
        rec["hash"] = self._hash(password, salt)
        self._save(data)

    def set_role(self, user_id: uuid.UUID, role: str) -> None:
        data = self._load()
        self._find(data, user_id)["role"] = role
        self._save(data)


# --------------------------------------------------------------------------- selection

_override: IdentityProvider | None = None


def set_identity_provider(provider: IdentityProvider | None) -> None:
    """Tests use this to swap the provider."""
    global _override
    _override = provider


def get_identity() -> IdentityProvider:
    if _override is not None:
        return _override
    s = get_settings()
    if s.supabase_url:
        return SupabaseIdentity(s)
    if s.env in ("development", "test"):
        return LocalDevIdentity(s)
    raise ApiError(503, "auth_not_configured", "Authentication is not configured")


def generate_temporary_password() -> str:
    # 10 chars, guaranteed letters + digits, no look-alike characters.
    letters = "abcdefghjkmnpqrstuvwxyz"
    digits = "23456789"
    body = [secrets.choice(letters + digits) for _ in range(8)]
    return "".join(body) + secrets.choice(letters) + secrets.choice(digits)
