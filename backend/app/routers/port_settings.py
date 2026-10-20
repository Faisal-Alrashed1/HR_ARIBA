"""Settings ported from their React system (docs/17_PORT_PLAN.md section 2): the runtime settings their engines read, the
key/value settings (ariba_hr_get_setting / _set_setting), the permissions matrix, roles, the accounts still on a default
password, the public brand, password recovery and reading the brand colours from a company website."""
from __future__ import annotations

import hashlib
import ipaddress
import re
import secrets
import socket
import time
from collections import Counter
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx
from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.database import get_db
from app.routers import canonical as c
from app.routers.canonical import _app_setting, _gosi_settings, current_actor
from app.services import mailer
from app.services import port_audit as pa
from app.services import port_common as pc

router = APIRouter()

# Their lib/data.js SETTING_KEYS (the ones the formulas read).
RUNTIME_KEYS = {"insurance": "insurance_rules", "carry": "leave_carry", "accrual": "leave_accrual_method",
                "country": "country_system", "schedule": "attendance_schedule"}
# Every key their pages read or write through ariba_hr_get_setting / ariba_hr_set_setting, with the module needed to change it.
KV_KEYS = {"brand_colors": "settings", "company_logo": "settings", "company_names": "settings", "hr_signer": "settings",
           "insurance_rules": "settings", "leave_carry": "settings", "leave_accrual_method": "settings", "letterhead": "settings",
           "punch_watermark": "settings", "country_system": "settings", "attendance_schedule": "settings", "master_lists": "settings",
           "report_templates": "documents|forms", "salary_cert_seq": "documents|forms", "id_issue_place": "documents|forms",
           "candidate_auto": "employees", "apply_public_url": "employees"}


@router.get("/settings/runtime")
def runtime_settings(actor: dict[str, Any] = Depends(current_actor), db: Session = Depends(get_db)):
    """The settings their `runtimePatchFromSettings` turns into the engines' runtime (rt): leave carry, accrual method,
    GOSI table (with the automatic periods merged, as getInsSettings), country layer and the work schedule."""
    out = {k: _app_setting(db, key) for k, key in RUNTIME_KEYS.items()}
    out["insurance"] = _gosi_settings(db)
    return out


def _kv_key(key: str) -> str:
    if key not in KV_KEYS:
        raise ApiError(404, "UNKNOWN_SETTING", "إعداد غير معروف")
    return key


@router.get("/settings/kv/{key}")
def get_kv(key: str, actor: dict[str, Any] = Depends(current_actor), db: Session = Depends(get_db)):
    """ariba_hr_get_setting: any signed-in staff account reads (the pages need the brand, logo, signer…)."""
    pc.require(db, actor, "staff")
    return {"key": key, "value": _app_setting(db, _kv_key(key))}


@router.put("/settings/kv/{key}")
def set_kv(key: str, body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(current_actor), db: Session = Depends(get_db)):
    """ariba_hr_set_setting: {value}; a null value removes the setting."""
    pc.require(db, actor, KV_KEYS.get(_kv_key(key), "settings"), "edit")
    value = body.get("value")
    if len(str(value)) > 3_000_000:
        raise ApiError(413, "TOO_LARGE", "القيمة كبيرة جداً")
    if value is None:
        db.execute(text("DELETE FROM public.ariba_app_settings WHERE key=:k"), {"k": key})
    else:
        pc.set_setting(db, key, value, actor.get("username"))
    label = pa.SET_LBL.get(key, "تعديل إعداد: " + key)
    c._write_audit(db, actor, request, "settings", label, "setting", key, summary=label)
    db.commit()
    return {"ok": True, "key": key}


# ---------------------------------------------------------------- permissions matrix and roles (PermsCard, RolesCard)
EDIT_ROLES = [r for r in pc.ROLES if r not in pc.FULL_ROLES]


@router.get("/settings/permissions")
def perms_matrix(actor: dict[str, Any] = Depends(current_actor), db: Session = Depends(get_db)):
    """ariba_perms_matrix: {roles, modules, matrix{"role.module": level}, can_edit}."""
    pc.require(db, actor, "permissions|settings")
    rows = db.execute(text("SELECT role,module,level FROM public.ariba_role_perms")).all()
    return {"roles": EDIT_ROLES, "modules": pc.MODULES, "matrix": {f"{r}.{m}": lv for r, m, lv in rows},
            "can_edit": pc.can(db, actor, "permissions", "edit")}


@router.put("/settings/permissions")
def perms_set(body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(current_actor), db: Session = Depends(get_db)):
    """ariba_perms_set: {role, module, level}. Admin and chairman are always full and are not stored."""
    pc.require(db, actor, "permissions", "edit")
    role, module, level = str(body.get("role") or ""), str(body.get("module") or ""), str(body.get("level") or "")
    if role not in EDIT_ROLES or module not in pc.MODULES or level not in pc.LEVEL:
        raise ApiError(422, "validation_error", "قيمة غير صحيحة")
    old = pc.role_level(db, role, module)
    db.execute(text("DELETE FROM public.ariba_role_perms WHERE role=:r AND module=:m"), {"r": role, "m": module})
    db.execute(text("INSERT INTO public.ariba_role_perms(role,module,level,updated_at,updated_by) VALUES(:r,:m,:l,now(),:by)"),
               {"r": role, "m": module, "l": level, "by": actor.get("username")})
    c._write_audit(db, actor, request, "security", "تعديل صلاحية دور", "role_perm", f"{role}.{module}",
                   summary=f"صلاحية {role} على {module}: من {old} إلى {level}", details={"role": role, "module": module, "old": old, "new": level})
    db.commit()
    return {"ok": True}


@router.get("/settings/roles")
def list_roles(actor: dict[str, Any] = Depends(current_actor), db: Session = Depends(get_db)):
    """ariba_hr_list_roles: every account with its employee name and role."""
    pc.require(db, actor, "permissions|settings|employees_admin")
    return c._rows(db, """SELECT a.employee_id,d.name_ar,a.username,a.role,a.active FROM public.ariba_auth_accounts a
        LEFT JOIN public.employee_directory d ON d.employee_id=a.employee_id ORDER BY d.name_ar NULLS LAST,a.username""")


@router.put("/settings/roles")
def set_role(body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(current_actor), db: Session = Depends(get_db)):
    """ariba_hr_set_role: {employee_id (or username), role}. Only admin/chairman may give admin or chairman."""
    pc.require(db, actor, "permissions", "edit")
    who, role = str(body.get("employee_id") or "").strip(), str(body.get("role") or "")
    if role not in pc.ROLES:
        raise ApiError(422, "validation_error", "دور غير صحيح")
    if role in pc.FULL_ROLES and actor.get("role") not in pc.FULL_ROLES:
        raise ApiError(403, "NOT_AUTHORIZED", "ليست لديك صلاحية")
    acc = c._row(db, "SELECT id,role,username FROM public.ariba_auth_accounts WHERE employee_id=:w OR lower(username)=lower(:w) LIMIT 1", w=who)
    if not acc:
        raise ApiError(404, "not_found", "الحساب غير موجود")
    if acc["role"] in pc.FULL_ROLES and actor.get("role") not in pc.FULL_ROLES:
        raise ApiError(403, "NOT_AUTHORIZED", "ليست لديك صلاحية")
    db.execute(text("UPDATE public.ariba_auth_accounts SET role=:r,updated_at=now() WHERE id=:i"), {"r": role, "i": acc["id"]})
    db.execute(text("DELETE FROM public.ariba_sessions WHERE account_id=:i"), {"i": acc["id"]})
    c._write_audit(db, actor, request, "security", "تغيير صلاحية", "account", acc["id"], summary=f"تغيير صلاحية {acc['username']} إلى {role}")
    db.commit()
    return {"ok": True}


@router.get("/auth/users/default-passwords")
def default_passwords(actor: dict[str, Any] = Depends(current_actor), db: Session = Depends(get_db)):
    """ariba_hr_default_password_list: active accounts still on a default or temporary password (must change)."""
    pc.require(db, actor, "employees_admin|permissions", "edit")
    rows = c._rows(db, """SELECT coalesce(d.name_ar,a.username) AS name,a.username,a.role FROM public.ariba_auth_accounts a
        LEFT JOIN public.employee_directory d ON d.employee_id=a.employee_id WHERE a.active AND a.must_change ORDER BY 1""")
    return {"accounts": rows}


# ---------------------------------------------------------------- public: brand and company (login page, employee app)
@router.get("/public/brand")
def public_brand(db: Session = Depends(get_db)):
    """ariba_get_brand: colours, the punch logo and the company names — nothing private."""
    b = _app_setting(db, "brand_colors") or {}
    names = _app_setting(db, "company_names") or {}
    logo = _app_setting(db, "company_logo") or {}
    return {"brand": {k: b.get(k) for k in ("p", "s", "a", "reset", "updated", "punch") if k in b} if isinstance(b, dict) else {},
            "names": {k: names.get(k) for k in ("coAr", "coEn") if isinstance(names, dict)},
            "logo": (logo.get("data") if isinstance(logo, dict) else None) or None}


# ---------------------------------------------------------------- password recovery (their ariba-password-recovery function)
def _mask(email: str) -> str:
    user, _, dom = email.partition("@")
    return (user[:2] + "•" * max(1, len(user) - 2)) + "@" + dom


@router.post("/auth/password-recovery")
def password_recovery(body: dict[str, Any], db: Session = Depends(get_db)):
    """By username or iqama number: a temporary password goes to the e-mail on the employee record. The current password
    keeps working until the temporary one is used (so nobody can lock another person out), and one request per 10 minutes."""
    username, iqama = str(body.get("username") or "").strip().lower(), re.sub(r"\D", "", str(body.get("iqama") or ""))
    generic = {"ok": True, "message": "لو البيانات صحيحة ومسجّل لها بريد، هيوصلك بريد بكلمة مرور مؤقتة."}
    if not username and not iqama:
        raise ApiError(422, "validation_error", "اكتب القيمة المطلوبة")
    acc = c._row(db, """SELECT a.id,a.username,d.data FROM public.ariba_auth_accounts a JOIN public.employee_directory d ON d.employee_id=a.employee_id
        WHERE a.active AND d.active AND """ + ("lower(a.username)=:v" if username else "regexp_replace(coalesce(d.iqama_no,d.data->>'iqamaNo',''),'\\D','','g')=:v"),
                 v=username or iqama)
    email = mailer.employee_email((acc or {}).get("data") or {}) if acc else None
    if not acc or not email:
        return generic
    if db.scalar(text("SELECT 1 FROM public.ariba_password_resets WHERE account_id=:a AND created_at > now()-interval '10 minutes'"), {"a": acc["id"]}):
        return generic
    temp = "".join(secrets.choice("abcdefghjkmnpqrstuvwxyz23456789") for _ in range(8)) + secrets.choice("abcdefghjkmnpqrstuvwxyz") + secrets.choice("23456789")
    db.execute(text("UPDATE public.ariba_password_resets SET used_at=coalesce(used_at,now()) WHERE account_id=:a AND used_at IS NULL"), {"a": acc["id"]})
    db.execute(text("INSERT INTO public.ariba_password_resets(account_id,token_hash,expires_at) VALUES(:a,:h,now()+interval '24 hours')"),
               {"a": acc["id"], "h": "temp:" + hashlib.sha256(temp.encode()).hexdigest()})
    inner = (f"<p>اسم المستخدم: <b dir='ltr'>{mailer.esc(acc['username'])}</b></p><p>كلمة المرور المؤقتة: <b dir='ltr'>{temp}</b></p>"
             "<p>صالحة 24 ساعة، وهيُطلب منك تغييرها أول ما تدخل.</p>")
    r = mailer.send(mailer.pick_account(db, None), mailer.Mail([email], "استرجاع بيانات الدخول", mailer.wrap("استرجاع بيانات الدخول", inner)))
    mailer.log_send(db, "password_recovery", [email], "password recovery", r, None)
    db.commit()
    return {**generic, "sent_to": _mask(email)} if r.get("ok") else generic


# ---------------------------------------------------------------- brand colours from a website (their ariba-brand-colors)
_HEX = re.compile(r"#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b")
_LAST: dict[str, float] = {}


def _public_host(host: str) -> bool:
    try:
        infos = socket.getaddrinfo(host, None)
    except OSError:
        return False
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if not ip.is_global:
            return False
    return bool(infos)


def _fetch(url: str, limit: int = 600_000) -> str:
    """GET a public http(s) page only (no private / loopback addresses, redirects checked one by one, size and time capped)."""
    for _ in range(4):
        u = urlparse(url)
        if u.scheme not in ("http", "https") or not u.hostname or not _public_host(u.hostname):
            raise ApiError(422, "BAD_URL", "الرابط غير مسموح")
        with httpx.Client(timeout=8, follow_redirects=False) as cl, cl.stream("GET", url, headers={"User-Agent": "Mozilla/5.0 AribaHR"}) as r:
            if r.is_redirect and r.headers.get("location"):
                url = urljoin(url, r.headers["location"])
                continue
            out = b""
            for chunk in r.iter_bytes():
                out += chunk
                if len(out) > limit:
                    break
            return out.decode(r.encoding or "utf-8", "ignore")
    raise ApiError(422, "BAD_URL", "تحويلات كثيرة")


def _norm_hex(h: str) -> str:
    h = h.lstrip("#")
    return "#" + ("".join(ch * 2 for ch in h) if len(h) == 3 else h).upper()


def extract_colors(html: str, css: str = "") -> dict[str, Any]:
    theme = re.search(r"<meta[^>]+name=[\"']theme-color[\"'][^>]*content=[\"']([^\"']+)", html, re.I) or \
        re.search(r"<meta[^>]+content=[\"']([^\"']+)[\"'][^>]*name=[\"']theme-color", html, re.I)
    theme_c = _norm_hex(theme.group(1)) if theme and _HEX.fullmatch(theme.group(1).strip()) else None
    counts = Counter(_norm_hex(m.group(0)) for m in _HEX.finditer(html + "\n" + css))
    skip = {"#FFFFFF", "#000000"}

    def grey(h: str) -> bool:
        r, g, b = int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)
        return max(r, g, b) - min(r, g, b) < 18
    colors = [{"color": h, "count": n} for h, n in counts.most_common(40) if h not in skip and not grey(h)][:12]
    return {"ok": True, "theme_color": theme_c, "colors": colors}


@router.post("/settings/brand/extract")
def brand_extract(body: dict[str, Any], actor: dict[str, Any] = Depends(current_actor), db: Session = Depends(get_db)):
    pc.require(db, actor, "settings", "edit")
    url = str(body.get("url") or "").strip()
    if not url:
        raise ApiError(422, "validation_error", "اكتب لينك موقع الشركة")
    if not re.match(r"^https?://", url, re.I):
        url = "https://" + url
    key = str(actor.get("account_id"))
    if time.monotonic() - _LAST.get(key, 0) < 3:
        raise ApiError(429, "TOO_MANY", "استنى ثواني وحاول تاني")
    _LAST[key] = time.monotonic()
    try:
        html = _fetch(url)
        css = ""
        for href in re.findall(r"<link[^>]+rel=[\"']stylesheet[\"'][^>]*href=[\"']([^\"']+)", html, re.I)[:3]:
            try:
                css += _fetch(urljoin(url, href), 300_000)
            except (ApiError, httpx.HTTPError):
                continue
    except httpx.HTTPError as exc:
        return {"ok": False, "error": type(exc).__name__}
    return extract_colors(html, css)
