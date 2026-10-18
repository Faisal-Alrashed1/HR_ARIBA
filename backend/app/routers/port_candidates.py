"""Candidates and the public job-application form (their sql/11, sql/20 and apply/ApplyApp.jsx — tasks 6 and 9).

Public (no sign-in): GET /public/apply/invite/{token} (ariba_candidate_invite_check), POST /public/apply (ariba_candidate_submit
with the form key, or ariba_candidate_submit_invite with a single-use link). Protections: hidden honeypot field, the
form key, invite-only mode, single-use expiring links, ≤10 files of ≤6 MB (PDF/JPG/PNG/WEBP), a CV required, one
submission per e-mail per 10 minutes and 200 per hour overall.
HR: list / by reference / file / accept (becomes the next employee number; files move to the documents) / reject
(files deleted), form-key rotation, invite-only mode and links. Auto-registration runs in the scheduler (candidate_auto).
"""
from __future__ import annotations

import base64
import binascii
import json
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.database import get_db
from app.routers import canonical as c
from app.services import employees_port as ep
from app.services import port_common as pc

router = APIRouter()

FILE_TYPES = {"cv", "id", "passport", "certificate", "experience", "national_address", "insurance", "photo", "other"}
MIMES = {"application/pdf", "image/jpeg", "image/png", "image/webp"}
MAX_FILE = 6 * 1024 * 1024
FIELDS = ["nameAr", "nameEn", "nationality", "dob", "mobile", "email", "city", "address", "idNo", "idExpiry", "passportNo", "passportExpiry",
          "position", "education", "experienceYears", "currentEmployer", "expectedSalary", "availability", "bank", "iban", "notes"]


def _err(code: str, status: int = 422) -> ApiError:
    """The public form reads the message as a code (FORM_CLOSED, INVITE_USED…), as their RPC errors."""
    return ApiError(status, code, code)


def _invite_state(row: dict[str, Any] | None) -> str:
    if not row:
        return "invalid"
    if row["used_at"]:
        return "used"
    if row["revoked_at"]:
        return "revoked"
    if row["expires_at"] < datetime.now(UTC):
        return "expired"
    return "ok"


@router.get("/public/apply/invite/{token}")
def invite_check(token: str, db: Session = Depends(get_db)):
    row = c._row(db, "SELECT * FROM public.ariba_candidate_invites WHERE token=:t", t=token)
    st = _invite_state(row)
    if st == "ok" and not row["opened_at"]:
        db.execute(text("UPDATE public.ariba_candidate_invites SET opened_at=now() WHERE token=:t"), {"t": token})
        db.commit()
    return {"status": st}


@router.post("/public/apply")
def public_apply(body: dict[str, Any], request: Request, db: Session = Depends(get_db)):
    data = body.get("data") if isinstance(body.get("data"), dict) else {}
    files = body.get("files") if isinstance(body.get("files"), list) else []
    ref = secrets.token_urlsafe(12)
    if str(data.get("website") or "").strip():  # honeypot: a bot filled the hidden field — answer as if it worked
        return {"ok": True, "ref": ref}
    invite = str(body.get("invite") or body.get("i") or "")
    inv_row = None
    if invite:
        inv_row = c._row(db, "SELECT * FROM public.ariba_candidate_invites WHERE token=:t FOR UPDATE", t=invite)
        st = _invite_state(inv_row)
        if st != "ok":
            raise _err({"used": "INVITE_USED", "expired": "INVITE_EXPIRED"}.get(st, "INVITE_INVALID"))
    else:
        key = pc.get_flag(db, "apply_form_key")
        if not key or str(body.get("form_key") or body.get("k") or "") != key:
            raise _err("FORM_CLOSED")
        if (pc.get_flag(db, "apply_invite_only") or "false") == "true":
            raise _err("INVITE_ONLY")
    clean = {k: str(data.get(k) or "").strip()[:500] for k in FIELDS if str(data.get(k) or "").strip()}
    for k in ("nameAr", "mobile", "email", "position"):
        if not clean.get(k):
            raise _err("REQUIRED_" + k.upper())
    from app.services.mailer import is_email
    if not is_email(clean["email"]):
        raise _err("BAD_EMAIL")
    if not files or len(files) > 10:
        raise _err("FILES_1_TO_10")
    decoded = []
    for f in files:
        ftype, mime = str(f.get("type") or "other"), str(f.get("mime") or "")
        if ftype not in FILE_TYPES or mime not in MIMES:
            raise _err("BAD_FILE_TYPE")
        try:
            raw = base64.b64decode(str(f.get("base64") or ""), validate=True)
        except (binascii.Error, ValueError) as exc:
            raise _err("BAD_FILE") from exc
        if not raw or len(raw) > MAX_FILE:
            raise _err("FILE_TOO_LARGE")
        decoded.append((ftype, str(f.get("name") or ftype)[:200], mime, raw))
    if not any(t == "cv" for t, *_ in decoded):
        raise _err("CV_REQUIRED")
    if c._row(db, "SELECT 1 AS x FROM public.ariba_candidates WHERE email=:e AND submitted_at > now() - interval '10 minutes'", e=clean["email"].lower()):
        raise _err("TOO_SOON", 429)
    if (db.scalar(text("SELECT count(*) FROM public.ariba_candidates WHERE submitted_at > now() - interval '1 hour'")) or 0) >= 200:
        raise _err("RATE_LIMIT", 429)
    cid = db.scalar(text("""INSERT INTO public.ariba_candidates(ref_token,data,source,ip) VALUES(:r,CAST(:d AS jsonb),:s,:ip) RETURNING id"""),
                    {"r": ref, "d": json.dumps(clean, ensure_ascii=False), "s": "invite" if invite else "public",
                     "ip": request.client.host if request.client else None})
    for ftype, name, mime, raw in decoded:
        db.execute(text("INSERT INTO public.ariba_candidate_files(candidate_id,file_type,file_name,mime_type,file_data) VALUES(:c,:t,:n,:m,:d)"),
                   {"c": cid, "t": ftype, "n": name, "m": mime, "d": raw})
    if inv_row:
        db.execute(text("UPDATE public.ariba_candidate_invites SET used_at=now(),candidate_id=:c WHERE token=:t"), {"c": cid, "t": invite})
    for h in pc.hr_people(db):
        pc.notify(db, h, None, "طلب توظيف جديد", f"{clean['nameAr']} — {clean['position']}", "hr", "info")
    db.commit()
    return {"ok": True, "ref": ref}


# ---------------------------------------------------------------- HR side
def _can_view(db: Session, actor: dict[str, Any]) -> None:
    pc.require(db, actor, "employees_admin|employees")


def _can_edit(db: Session, actor: dict[str, Any]) -> None:
    pc.require(db, actor, "employees_admin|employees", "edit")


def _candidate_out(db: Session, r: dict[str, Any]) -> dict[str, Any]:
    files = c._rows(db, "SELECT id,file_type AS type,file_name AS name,mime_type AS mime,file_size AS size FROM public.ariba_candidate_files WHERE candidate_id=:c ORDER BY created_at", c=r["id"])
    return {"id": str(r["id"]), "ref": r["ref_token"], "status": r["status"], "data": r["data"], "files": [{**f, "id": str(f["id"])} for f in files],
            "submitted_at": r["submitted_at"], "employee_id": r["employee_id"], "review_note": r["review_note"], "source": r["source"]}


@router.get("/candidates")
def list_candidates(status: str | None = None, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_hr_candidates: the candidates (+ the current form key for the link)."""
    _can_view(db, actor)
    rows = c._rows(db, "SELECT * FROM public.ariba_candidates WHERE (CAST(:s AS text) IS NULL OR status=:s) ORDER BY submitted_at DESC LIMIT 500", s=status)
    return {"candidates": [_candidate_out(db, r) for r in rows], "form_key": pc.get_flag(db, "apply_form_key") or ""}


@router.get("/candidates/by-ref/{ref:path}")
def candidate_by_ref(ref: str, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_hr_candidate_by_ref: the pasted link (…?c=<ref>) or the reference itself."""
    _can_view(db, actor)
    token = ref.strip().split("c=")[-1].split("&")[0].strip()
    r = c._row(db, "SELECT * FROM public.ariba_candidates WHERE ref_token=:t", t=token)
    if not r:
        raise ApiError(404, "NOT_FOUND", "لا يوجد مرشح بهذا الرمز")
    return {"candidate": _candidate_out(db, r)}


@router.get("/candidates/files/{file_id}")
def candidate_file(file_id: str, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    _can_view(db, actor)
    f = c._row(db, "SELECT file_name,mime_type,file_data FROM public.ariba_candidate_files WHERE id=:i", i=file_id)
    if not f:
        raise ApiError(404, "NOT_FOUND", "الملف غير موجود")
    return {"name": f["file_name"], "mime": f["mime_type"], "base64": base64.b64encode(bytes(f["file_data"])).decode()}


def accept_candidate(db: Session, actor: dict[str, Any], cand: dict[str, Any], v: dict[str, Any]) -> dict[str, Any]:
    """Their acceptCandidate + ariba_hr_candidate_accept: the candidate becomes the next employee number (buildEmployee
    rules), the photo becomes the employee's photo and every file moves to the employee's documents."""
    d = cand["data"] or {}
    f = {**ep.empty_form(), "na": d.get("nameAr", ""), "ne": d.get("nameEn", ""), "nat": d.get("nationality") or "سعودي", "dob": d.get("dob", ""),
         "mb": d.get("mobile", ""), "ml": d.get("email", ""), "bk": d.get("bank", ""), "ib": d.get("iban", ""), "iq": d.get("idNo", ""),
         "iqe": d.get("idExpiry", ""), "pn": d.get("passportNo", ""), "ppe": d.get("passportExpiry", ""), "em": v.get("em"), "dep": v.get("dep"),
         "jt": v.get("jt"), "contractNature": v.get("nature") or "indefinite", "cj": v.get("cj"), "dur": v.get("dur") if v.get("nature") == "fixed" else "",
         "sal": v.get("sal") or 0, "notes": d.get("notes", "")}
    built = ep.build_employee(f, None, ep.legacy_employees(db))
    if built.get("error"):
        raise ApiError(422, "BUILD_FAILED", built["error"])
    emp = built["emp"]
    saved = ep.save_employee(db, emp, actor)
    eid = saved["id"]
    moved = 0
    for fl in c._rows(db, "SELECT * FROM public.ariba_candidate_files WHERE candidate_id=:c ORDER BY created_at", c=cand["id"]):
        db.execute(text("""INSERT INTO public.ariba_documents(employee_id,document_type,file_name,mime_type,file_data,uploaded_by)
            VALUES(:e,:t,:n,:m,:d,:by)"""), {"e": eid, "t": fl["file_type"], "n": fl["file_name"], "m": fl["mime_type"], "d": fl["file_data"], "by": actor.get("username") or "candidate_auto"})
        moved += 1
        if fl["file_type"] == "photo":
            db.execute(text("""UPDATE public.employee_directory SET data=jsonb_set(data,'{photoUrl}',to_jsonb(CAST(:u AS text))) WHERE employee_id=:e"""),
                       {"u": f"/api/v1/employees/{eid}/photo", "e": eid})
    db.execute(text("DELETE FROM public.ariba_candidate_files WHERE candidate_id=:c"), {"c": cand["id"]})
    db.execute(text("""UPDATE public.ariba_candidates SET status='accepted',employee_id=:e,reviewed_at=now(),reviewed_by=:by,review_note=:n WHERE id=:c"""),
               {"e": eid, "by": actor.get("username") or "candidate_auto", "n": v.get("note"), "c": cand["id"]})
    return {"emp": {"id": eid, "empNo": emp["empNo"], "username": emp["username"], "nameAr": emp["nameAr"]}, "moved": moved}


@router.post("/candidates/{candidate_id}/accept")
def accept(candidate_id: str, body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    _can_edit(db, actor)
    cand = c._row(db, "SELECT * FROM public.ariba_candidates WHERE id=:i FOR UPDATE", i=candidate_id)
    if not cand or cand["status"] != "new":
        raise ApiError(409, "NOT_NEW", "المرشح ليس بانتظار المراجعة")
    if not body.get("em"):
        raise ApiError(422, "validation_error", "جهة العمل مطلوبة")
    out = accept_candidate(db, actor, cand, body)
    c._write_audit(db, actor, request, "candidates", "accept", "candidate", candidate_id, details={"employee_id": out["emp"]["id"], "moved": out["moved"]})
    db.commit()
    return out


@router.post("/candidates/{candidate_id}/reject")
def reject(candidate_id: str, body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_hr_candidate_reject: rejected with the reason, and his files are deleted (as theirs)."""
    _can_edit(db, actor)
    note = str(body.get("note") or "").strip()
    if not note:
        raise ApiError(422, "REASON_REQUIRED", "اكتب سبب الرفض")
    cand = c._row(db, "SELECT status FROM public.ariba_candidates WHERE id=:i", i=candidate_id)
    if not cand or cand["status"] != "new":
        raise ApiError(409, "NOT_NEW", "المرشح ليس بانتظار المراجعة")
    db.execute(text("DELETE FROM public.ariba_candidate_files WHERE candidate_id=:c"), {"c": candidate_id})
    db.execute(text("UPDATE public.ariba_candidates SET status='rejected',reviewed_at=now(),reviewed_by=:by,review_note=:n WHERE id=:c"),
               {"by": actor.get("username"), "n": note, "c": candidate_id})
    c._write_audit(db, actor, request, "candidates", "reject", "candidate", candidate_id, details={"note": note})
    db.commit()
    return {"ok": True}


@router.post("/candidates/apply-key/rotate")
def rotate_key(request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_hr_apply_key_rotate: a new form key (the old public link stops working)."""
    _can_edit(db, actor)
    key = secrets.token_urlsafe(18)
    pc.set_flag(db, "apply_form_key", key, actor.get("username"))
    c._write_audit(db, actor, request, "candidates", "rotate_key", "security_flag", "apply_form_key")
    db.commit()
    return {"form_key": key}


@router.put("/candidates/apply-mode")
def apply_mode(body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_hr_apply_mode_set: invite-only on/off and the validity of a link (1–720 hours)."""
    pc.require(db, actor, "settings|employees_admin", "edit")
    hours = int(body.get("hours") or 72)
    if not 1 <= hours <= 720:
        raise ApiError(422, "validation_error", "المدة من 1 إلى 720 ساعة")
    pc.set_flag(db, "apply_invite_only", "true" if body.get("invite_only") else "false", actor.get("username"))
    pc.set_flag(db, "apply_invite_hours", str(hours), actor.get("username"))
    c._write_audit(db, actor, request, "settings", "update", "security_flag", "apply_invite", details={"invite_only": bool(body.get("invite_only")), "hours": hours})
    db.commit()
    return {"invite_only": bool(body.get("invite_only")), "hours": hours}


@router.get("/candidates/invites")
def invites(actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_hr_invites: the single-use links (+ invite-only mode and the default validity)."""
    _can_view(db, actor)
    rows = c._rows(db, """SELECT i.*,ca.data->>'nameAr' AS candidate FROM public.ariba_candidate_invites i
        LEFT JOIN public.ariba_candidates ca ON ca.id=i.candidate_id ORDER BY i.created_at DESC LIMIT 100""")
    return {"invites": rows, "invite_only": (pc.get_flag(db, "apply_invite_only") or "false") == "true",
            "hours": int(pc.get_flag(db, "apply_invite_hours") or 72)}


@router.post("/candidates/invites")
def create_invite(body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    _can_edit(db, actor)
    hours = int(body.get("hours") or pc.get_flag(db, "apply_invite_hours") or 72)
    if not 1 <= hours <= 720:
        raise ApiError(422, "validation_error", "المدة من 1 إلى 720 ساعة")
    token = secrets.token_urlsafe(18)
    label = (str(body.get("label") or "").strip() or None)
    expires = datetime.now(UTC) + timedelta(hours=hours)
    db.execute(text("INSERT INTO public.ariba_candidate_invites(token,label,created_by,expires_at) VALUES(:t,:l,:by,:x)"),
               {"t": token, "l": label, "by": actor.get("username"), "x": expires})
    c._write_audit(db, actor, request, "candidates", "invite_create", "candidate_invite", token[:8], details={"label": label, "hours": hours})
    db.commit()
    return {"token": token, "label": label, "expires_at": expires}


@router.post("/candidates/invites/{token}/revoke")
def revoke_invite(token: str, request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    _can_edit(db, actor)
    done = db.execute(text("UPDATE public.ariba_candidate_invites SET revoked_at=now() WHERE token=:t AND used_at IS NULL AND revoked_at IS NULL"), {"t": token})
    if not done.rowcount:
        raise ApiError(409, "NOT_REVOCABLE", "الرابط مستخدم أو ملغي")
    c._write_audit(db, actor, request, "candidates", "invite_revoke", "candidate_invite", token[:8])
    db.commit()
    return {"ok": True}


def auto_register(db: Session) -> int:
    """Their CandAuto (every minute while an HR browser is open), as a scheduled job: when `candidate_auto` is on, every
    new candidate becomes an employee with the configured employer/department/contract; start date = today, salary =
    the expected salary. A candidate that cannot be built stays for manual review."""
    cfg = pc.get_setting(db, "candidate_auto") or {}
    if not (isinstance(cfg, dict) and cfg.get("on") and cfg.get("em")):
        return 0
    n = 0
    actor = {"username": "candidate_auto", "role": "hr", "employee_id": None}
    for cand in c._rows(db, "SELECT * FROM public.ariba_candidates WHERE status='new' ORDER BY submitted_at"):
        try:
            with db.begin_nested():
                accept_candidate(db, actor, cand, {"em": cfg["em"], "dep": cfg.get("dep") or "التشغيل", "jt": (cand["data"] or {}).get("position", ""),
                                                   "nature": cfg.get("nature") or "indefinite", "cj": datetime.now(UTC).date().isoformat(), "dur": "12",
                                                   "sal": (cand["data"] or {}).get("expectedSalary") or 0, "note": "تسجيل تلقائي"})
            n += 1
        except ApiError:
            continue
    return n
