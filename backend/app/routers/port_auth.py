"""Sign-in with fingerprint / Face ID on the site (WebAuthn, ariba_webauthn_credentials) and the employee app's push
tokens (ariba_push_tokens). The challenge travels in a short signed token, so the server keeps no state between the
two steps. WEBAUTHN_RP_ID / WEBAUTHN_ORIGINS name the site (default: the first CORS origin)."""
from __future__ import annotations

import json
import os
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlparse

import jwt
from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.orm import Session
from webauthn import (generate_authentication_options, generate_registration_options, options_to_json,
                      verify_authentication_response, verify_registration_response)
from webauthn.helpers import base64url_to_bytes, bytes_to_base64url
from webauthn.helpers.exceptions import InvalidAuthenticationResponse, InvalidJSONStructure, InvalidRegistrationResponse
from webauthn.helpers.structs import (AuthenticatorSelectionCriteria, PublicKeyCredentialDescriptor, ResidentKeyRequirement,
                                      UserVerificationRequirement)

from app.config import get_settings
from app.core.errors import ApiError
from app.database import get_db
from app.routers import canonical as c

router = APIRouter()


def _rp() -> tuple[str, list[str]]:
    s = get_settings()
    origins = [o.strip().rstrip("/") for o in os.environ.get("WEBAUTHN_ORIGINS", "").split(",") if o.strip()] or s.cors_origin_list[:1]
    rp_id = os.environ.get("WEBAUTHN_RP_ID") or urlparse(origins[0]).hostname or "localhost"
    return rp_id, origins


def _state(kind: str, challenge: bytes, account_id: str | None = None) -> str:
    s = get_settings()
    claims = {"typ": "webauthn-" + kind, "ch": bytes_to_base64url(challenge), "aud": s.jwt_audience,
              "exp": int((datetime.now(UTC) + timedelta(minutes=5)).timestamp())}
    if account_id:
        claims["sub"] = account_id
    return jwt.encode(claims, s.jwt_secret, algorithm="HS256")


def _read_state(token: str, kind: str) -> dict[str, Any]:
    s = get_settings()
    try:
        st = jwt.decode(token, s.jwt_secret, algorithms=["HS256"], audience=s.jwt_audience)
    except jwt.PyJWTError as exc:
        raise ApiError(400, "WEBAUTHN_EXPIRED", "انتهت المهلة، حاول تاني") from exc
    if st.get("typ") != "webauthn-" + kind:
        raise ApiError(400, "WEBAUTHN_EXPIRED", "انتهت المهلة، حاول تاني")
    return st


@router.post("/auth/webauthn/register/options")
def register_options(actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    rp_id, _ = _rp()
    have = [r[0] for r in db.execute(text("SELECT credential_id FROM public.ariba_webauthn_credentials WHERE account_id=:a"), {"a": actor["account_id"]})]
    challenge = secrets.token_bytes(32)
    opts = generate_registration_options(
        rp_id=rp_id, rp_name="ARIBA HR", user_name=actor["username"], user_id=str(actor["account_id"]).encode(),
        user_display_name=actor.get("name_ar") or actor["username"], challenge=challenge,
        authenticator_selection=AuthenticatorSelectionCriteria(resident_key=ResidentKeyRequirement.PREFERRED,
                                                               user_verification=UserVerificationRequirement.REQUIRED),
        exclude_credentials=[PublicKeyCredentialDescriptor(id=base64url_to_bytes(x)) for x in have])
    return {"options": json.loads(options_to_json(opts)), "state": _state("register", challenge, str(actor["account_id"]))}


@router.post("/auth/webauthn/register")
def register(body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    st = _read_state(str(body.get("state") or ""), "register")
    if st.get("sub") != str(actor["account_id"]):
        raise ApiError(400, "WEBAUTHN_EXPIRED", "انتهت المهلة، حاول تاني")
    rp_id, origins = _rp()
    try:
        v = verify_registration_response(credential=body.get("credential"), expected_challenge=base64url_to_bytes(st["ch"]),
                                         expected_rp_id=rp_id, expected_origin=origins, require_user_verification=True)
    except (InvalidRegistrationResponse, InvalidJSONStructure, ValueError, TypeError, KeyError) as exc:
        raise ApiError(400, "WEBAUTHN_FAILED", "تعذر تسجيل البصمة") from exc
    cid = bytes_to_base64url(v.credential_id)
    db.execute(text("""INSERT INTO public.ariba_webauthn_credentials(account_id,credential_id,public_key,sign_count,device_label)
        VALUES(:a,:c,:k,:n,:l) ON CONFLICT (credential_id) DO NOTHING"""),
               {"a": actor["account_id"], "c": cid, "k": v.credential_public_key, "n": v.sign_count, "l": str(body.get("label") or "")[:80] or None})
    c._write_audit(db, actor, request, "security", "تسجيل بصمة دخول", "account", actor["account_id"])
    db.commit()
    return {"ok": True, "credential_id": cid}


@router.post("/auth/webauthn/login/options")
def login_options(body: dict[str, Any] | None = None, db: Session = Depends(get_db)):
    """With a username: only that account's devices; without: the browser offers its saved passkeys."""
    rp_id, _ = _rp()
    username = str((body or {}).get("username") or "").strip().lower()
    allow = []
    if username:
        allow = [PublicKeyCredentialDescriptor(id=base64url_to_bytes(r[0])) for r in db.execute(text("""SELECT w.credential_id
            FROM public.ariba_webauthn_credentials w JOIN public.ariba_auth_accounts a ON a.id=w.account_id
            WHERE lower(a.username)=:u AND a.active"""), {"u": username})]
    challenge = secrets.token_bytes(32)
    opts = generate_authentication_options(rp_id=rp_id, challenge=challenge, allow_credentials=allow or None,
                                           user_verification=UserVerificationRequirement.REQUIRED)
    return {"options": json.loads(options_to_json(opts)), "state": _state("login", challenge)}


@router.post("/auth/webauthn/login")
def login(body: dict[str, Any], request: Request, db: Session = Depends(get_db)):
    st = _read_state(str(body.get("state") or ""), "login")
    cred = body.get("credential") or {}
    cid = str(cred.get("id") or "") if isinstance(cred, dict) else ""
    row = c._row(db, """SELECT w.id AS wid,w.public_key,w.sign_count,a.* FROM public.ariba_webauthn_credentials w
        JOIN public.ariba_auth_accounts a ON a.id=w.account_id WHERE w.credential_id=:c AND a.active""", c=cid)
    if not row:
        raise ApiError(401, "invalid_credentials", "البصمة غير مسجّلة")
    rp_id, origins = _rp()
    try:
        v = verify_authentication_response(credential=cred, expected_challenge=base64url_to_bytes(st["ch"]), expected_rp_id=rp_id,
                                           expected_origin=origins, credential_public_key=bytes(row["public_key"]),
                                           credential_current_sign_count=int(row["sign_count"]), require_user_verification=True)
    except (InvalidAuthenticationResponse, InvalidJSONStructure, ValueError, TypeError, KeyError) as exc:
        raise ApiError(401, "invalid_credentials", "تعذر التحقق من البصمة") from exc
    db.execute(text("UPDATE public.ariba_webauthn_credentials SET sign_count=:n,last_used_at=now() WHERE id=:i"), {"n": v.new_sign_count, "i": row["wid"]})
    account = {k: v2 for k, v2 in row.items() if k not in ("wid", "public_key", "sign_count")}
    c._write_audit(db, {**account, "name_ar": account["username"]}, request, "auth", "login_webauthn", "account", account["id"])
    return c._session_response(db, account)


@router.get("/me/webauthn")
def my_credentials(actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    rows = c._rows(db, "SELECT id,device_label,created_at,last_used_at FROM public.ariba_webauthn_credentials WHERE account_id=:a ORDER BY created_at",
                   a=actor["account_id"])
    return {"items": [{**r, "id": str(r["id"])} for r in rows]}


@router.delete("/me/webauthn/{cred_id}")
def forget_credential(cred_id: str, request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    n = db.execute(text("DELETE FROM public.ariba_webauthn_credentials WHERE id=CAST(:i AS uuid) AND account_id=:a"), {"i": cred_id, "a": actor["account_id"]}).rowcount
    if not n:
        raise ApiError(404, "not_found", "غير موجود")
    c._write_audit(db, actor, request, "security", "حذف بصمة دخول", "account", actor["account_id"])
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------- push tokens (employee app)
@router.post("/me/push-token")
def register_push(body: dict[str, Any], actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    token = str(body.get("token") or "").strip()
    if not (token.startswith("ExponentPushToken[") or token.startswith("ExpoPushToken[")) or len(token) > 200:
        raise ApiError(422, "validation_error", "رمز الجهاز غير صحيح")
    db.execute(text("""INSERT INTO public.ariba_push_tokens(token,account_id,platform) VALUES(:t,:a,:p)
        ON CONFLICT (token) DO UPDATE SET account_id=EXCLUDED.account_id,platform=EXCLUDED.platform,last_seen_at=now()"""),
               {"t": token, "a": actor["account_id"], "p": str(body.get("platform") or "expo")[:20]})
    db.commit()
    return {"ok": True}


@router.delete("/me/push-token")
def unregister_push(body: dict[str, Any] | None = None, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """Sign-out on the device: forget its token (or every token of the account when none is given)."""
    token = str((body or {}).get("token") or "")
    if token:
        db.execute(text("DELETE FROM public.ariba_push_tokens WHERE token=:t AND account_id=:a"), {"t": token, "a": actor["account_id"]})
    else:
        db.execute(text("DELETE FROM public.ariba_push_tokens WHERE account_id=:a"), {"a": actor["account_id"]})
    db.commit()
    return {"ok": True}
