"""Mail (their sql/15, sql/17 and Edge Functions ariba-send-email / ariba-send-report / ariba-notify-dispatch):
the sending mailboxes ("mine" per staff member, "company" for system notifications) with the password encrypted,
a test message, sending a PDF document to an employee, sending a report to chosen recipients, the assistant's
message to an employee, and the e-mail copy of every notification (scheduler, every 5 minutes)."""
from __future__ import annotations

import base64
import binascii
from typing import Any

from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.database import get_db
from app.routers import canonical as c
from app.services import mailer
from app.services import port_common as pc

router = APIRouter()
STAFF_ROLES = {"admin", "chairman", "hr", "ceo", "admin_manager", "finance", "accountant"}


def _owner(actor: dict[str, Any], scope: str) -> str:
    if scope == "company":
        return "company"
    if scope != "mine":
        raise ApiError(422, "BAD_SCOPE", "scope must be mine or company")
    if not actor.get("employee_id"):
        raise ApiError(409, "NO_EMPLOYEE", "الحساب غير مربوط بموظف")
    return str(actor["employee_id"])


def _staff(actor: dict[str, Any]) -> None:
    if actor.get("role") not in STAFF_ROLES:
        raise ApiError(403, "NOT_AUTHORIZED", "مفيش صلاحية إرسال")


@router.get("/mail/{scope}")
def mail_get(scope: str, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_mail_get: the saved mailbox without its password."""
    _staff(actor)
    row = c._row(db, "SELECT * FROM public.ariba_mail_accounts WHERE owner=:o", o=_owner(actor, scope))
    if not row:
        return {"configured": False}
    return {"configured": True, "host": row["host"], "port": row["port"], "secure": row["secure"], "username": row["username"],
            "from_name": row["from_name"], "from_email": row["from_email"], "has_password": bool(row["password_enc"])}


@router.put("/mail/{scope}")
def mail_set(scope: str, body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_mail_set: save the mailbox (an empty password keeps the saved one; Microsoft 365 sends through Graph)."""
    _staff(actor)
    if scope == "company":
        pc.require(db, actor, "settings", "edit")
    owner = _owner(actor, scope)
    host, user, from_email = str(body.get("host") or "").strip().lower(), str(body.get("username") or "").strip(), str(body.get("from_email") or "").strip()
    if not host or not user or not mailer.is_email(from_email):
        raise ApiError(422, "validation_error", "اكتب الخادم واسم المستخدم وعنوان المرسل")
    try:
        port = int(body.get("port") or 465)
    except (TypeError, ValueError) as exc:
        raise ApiError(422, "validation_error", "المنفذ غير صحيح") from exc
    pw = str(body.get("password") or "")
    old = c._row(db, "SELECT password_enc FROM public.ariba_mail_accounts WHERE owner=:o", o=owner)
    if not pw and not (old and old["password_enc"]) and not mailer.is_o365(host):
        raise ApiError(422, "PASSWORD_REQUIRED", "PASSWORD_REQUIRED")
    try:
        enc = mailer.encrypt(pw) if pw and pw != "GRAPH_OAUTH" else (old or {}).get("password_enc")
    except RuntimeError as exc:
        raise ApiError(503, "MAIL_SECRET_KEY_MISSING", "مفتاح تشفير البريد غير مضبوط على الخادم (MAIL_SECRET_KEY)") from exc
    db.execute(text("""INSERT INTO public.ariba_mail_accounts(owner,provider,host,port,secure,username,password_enc,from_name,from_email,updated_by,updated_at)
        VALUES(:o,:p,:h,:port,:s,:u,:pw,:fn,:fe,:by,now()) ON CONFLICT(owner) DO UPDATE SET provider=EXCLUDED.provider,host=EXCLUDED.host,port=EXCLUDED.port,
        secure=EXCLUDED.secure,username=EXCLUDED.username,password_enc=EXCLUDED.password_enc,from_name=EXCLUDED.from_name,from_email=EXCLUDED.from_email,
        updated_by=EXCLUDED.updated_by,updated_at=now()"""),
               {"o": owner, "p": "graph" if mailer.is_o365(host) else "smtp", "h": host, "port": port, "s": bool(body.get("secure")) or port == 465,
                "u": user, "pw": enc, "fn": str(body.get("from_name") or "") or None, "fe": from_email, "by": actor.get("username")})
    c._write_audit(db, actor, request, "settings", "mail_set", "mail_account", owner, details={"host": host, "from": from_email})
    db.commit()
    return mail_get(scope, actor, db)


@router.delete("/mail/{scope}")
def mail_delete(scope: str, request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    _staff(actor)
    if scope == "company":
        pc.require(db, actor, "settings", "edit")
    owner = _owner(actor, scope)
    db.execute(text("DELETE FROM public.ariba_mail_accounts WHERE owner=:o"), {"o": owner})
    c._write_audit(db, actor, request, "settings", "mail_delete", "mail_account", owner)
    db.commit()
    return {"ok": True}


@router.post("/mail/test")
def mail_test(body: dict[str, Any], actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba-send-email {test:true}: a test message to the mailbox itself (or `to`)."""
    _staff(actor)
    account = mailer.pick_account(db, None if body.get("scope") == "company" else actor.get("employee_id"))
    if not account:
        return {"ok": False, "error": "EMAIL_NOT_CONFIGURED", "message": "مفيش بريد إرسال محفوظ"}
    to = str(body.get("to") or "").strip() if mailer.is_email(body.get("to")) else account.from_email
    r = mailer.send(account, mailer.Mail([to], "رسالة تجربة — نظام الموارد البشرية",
                                         mailer.wrap("رسالة تجربة", "لو وصلتك الرسالة دي يبقى إعدادات البريد سليمة والإرسال التلقائي شغال ✓")))
    mailer.log_send(db, "test", [to], "test", r, actor.get("username"))
    db.commit()
    return {**r, "to": to} if r.get("ok") else r


def _pdf(att: dict[str, Any] | None) -> tuple[str, str]:
    """A PDF attachment as their send-email checks it: name *.pdf, %PDF signature, ≤ ~9 MB."""
    if not isinstance(att, dict) or not str(att.get("base64") or "").strip():
        raise ApiError(422, "PDF_REQUIRED", "المرفق لم يصل بصيغة PDF؛ حدّث واجهة البرنامج ثم أعد الإرسال.")
    name = "".join(ch for ch in str(att.get("filename") or "document.pdf") if ch not in '\\/:*?"<>|')[:140]
    b64 = str(att["base64"]).replace("data:application/pdf;base64,", "").replace("\n", "").replace(" ", "")
    try:
        head = base64.b64decode(b64[:16])[:4]
    except (binascii.Error, ValueError):
        head = b""
    if not name.lower().endswith(".pdf") or head != b"%PDF" or len(b64) > 12_000_000:
        raise ApiError(422, "BAD_ATTACHMENT", "المرفق يجب أن يكون PDF صالحًا وبحجم مناسب.")
    return name, b64


@router.post("/mail/send-document")
def send_document(body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba-send-email: a form / settlement as PDF to the employee's e-mail, from my mailbox (else the company's)."""
    _staff(actor)
    eid = str(body.get("employee_id") or "").strip()
    title = str(body.get("title") or "مستند من الموارد البشرية")[:200]
    name, b64 = _pdf(body.get("attachment"))
    emp = c._row(db, "SELECT name_ar,data FROM public.employee_directory WHERE employee_id=:e", e=eid)
    if not emp:
        raise ApiError(404, "not_found", "الموظف غير موجود")
    to = mailer.employee_email(emp["data"] or {})
    if not to:
        return {"ok": False, "error": "NO_EMAIL", "message": "مفيش إيميل مسجل للموظف ده"}
    r = mailer.send(mailer.pick_account(db, actor.get("employee_id")), mailer.Mail(
        [to], title, mailer.wrap(title, f"عزيزي/عزيزتي {mailer.esc(emp['name_ar'])}،<br>مرفق <b>{mailer.esc(title)}</b> بصيغة PDF على الورق الرسمي للشركة.<br><br>مع التحية،<br>الموارد البشرية"),
        [{"filename": name, "content": b64, "contentType": "application/pdf"}]))
    mailer.log_send(db, "document", [to], title, r, actor.get("username"))
    if r.get("ok"):
        c._write_audit(db, actor, request, "forms", "email_document", "employee", eid, summary=f"إرسال {title} بالإيميل إلى {to}", details={"type": body.get("type"), "via": r.get("via")})
    db.commit()
    return {**r, "to": to} if r.get("ok") else r


@router.post("/mail/send-report")
def send_report(body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba-send-report: a report file to up to 30 recipients."""
    _staff(actor)
    to = [str(x).strip() for x in (body.get("to") or []) if mailer.is_email(x)][:30]
    if not to:
        raise ApiError(422, "NO_RECIPIENTS", "لا يوجد مستلم بإيميل صحيح")
    att = body.get("attachment") or {}
    if not att.get("base64") or len(str(att["base64"])) > 10_000_000:
        raise ApiError(422, "BAD_ATTACHMENT", "المرفق غير صالح")
    subject, msg = str(body.get("subject") or "تقرير من الموارد البشرية")[:200], str(body.get("message") or "")[:2000]
    html = f'<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.9"><p>السلام عليكم ورحمة الله،</p><p>{mailer.esc(msg or "مرفق التقرير المطلوب.")}</p><p>مع التحية،<br>الموارد البشرية</p></div>'
    r = mailer.send(mailer.pick_account(db, actor.get("employee_id")), mailer.Mail(to, subject, html, [{"filename": str(att.get("name") or "report")[:120],
                                                                                                         "content": att["base64"], "contentType": att.get("mime") or "application/octet-stream"}]))
    mailer.log_send(db, "report", to, subject, r, actor.get("username"))
    if r.get("ok"):
        c._write_audit(db, actor, request, "reports", "email_report", "report", None, summary=f"إرسال تقرير بالإيميل ({len(to)} مستلم): {subject}", details={"to": to})
    db.commit()
    return {"ok": True, "sent": len(to)} if r.get("ok") else r


@router.post("/messages")
def send_message(body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_hr_send_message (sql/17): a message from HR / the assistant to one employee — in the app and by e-mail."""
    pc.require(db, actor, "employees|requests", "edit")
    eid = str(body.get("employee_id") or "")
    msg = str(body.get("message") or body.get("body") or "").strip()
    if not eid or not msg:
        raise ApiError(422, "validation_error", "اختر الموظف واكتب الرسالة")
    if not c._row(db, "SELECT 1 AS x FROM public.employee_directory WHERE employee_id=:e", e=eid):
        raise ApiError(404, "not_found", "الموظف غير موجود")
    pc.notify(db, eid, None, str(body.get("title") or "رسالة من الموارد البشرية")[:200], msg[:2000], "employee", "message")
    c._write_audit(db, actor, request, "employees", "send_message", "employee", eid, details={"length": len(msg)})
    db.commit()
    return {"ok": True}


def dispatch_notifications(db: Session, limit: int = 40) -> dict[str, int]:
    """ariba-notify-dispatch: e-mail every notification not sent yet (5 tries at most), from the company mailbox
    (else Resend); HR notifications also go to the extra HR e-mails of the workflow settings."""
    rows = c._rows(db, """SELECT n.id,n.title,n.body,n.stage,n.email_tries,d.name_ar,d.data FROM public.workflow_notifications n
        LEFT JOIN public.employee_directory d ON d.employee_id=n.recipient_employee_id
        WHERE n.emailed_at IS NULL AND n.email_tries < 5 ORDER BY n.created_at LIMIT :l""", l=limit)
    if not rows:
        return {"sent": 0, "failed": 0, "skipped": 0}
    account = mailer.pick_account(db, None)
    extra = [e for e in pc.wf_config(db).get("extra_hr_emails") or [] if mailer.is_email(e)]
    sent = failed = skipped = 0
    for n in rows:
        to = [x for x in [mailer.employee_email(n["data"] or {})] if x] + (extra if n["stage"] == "hr" else [])
        if not to:
            db.execute(text("UPDATE public.workflow_notifications SET emailed_at=now(),email_error='no-email' WHERE id=:i"), {"i": n["id"]})
            skipped += 1
            continue
        html = mailer.wrap(n["title"], f"مرحباً {mailer.esc(n['name_ar'] or '')}،<br>{mailer.esc(n['body'])}")
        r = mailer.send(account, mailer.Mail(to, n["title"], html))
        if r.get("ok"):
            db.execute(text("UPDATE public.workflow_notifications SET emailed_at=now(),email_error=NULL WHERE id=:i"), {"i": n["id"]})
            sent += 1
        else:
            db.execute(text("UPDATE public.workflow_notifications SET email_error=:e,email_tries=email_tries+1 WHERE id=:i"), {"e": str(r.get("message"))[:300], "i": n["id"]})
            failed += 1
    db.commit()
    return {"sent": sent, "failed": failed, "skipped": skipped}
