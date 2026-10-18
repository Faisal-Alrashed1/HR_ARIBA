"""E-mail (their supabase/functions/_shared/mail.ts): SMTP from the saved mailbox (the sender's own, else the company's),
Microsoft 365 through Graph (client credentials), and Resend as the fallback. Passwords are stored AES-GCM encrypted
with MAIL_SECRET_KEY (decision 5). Configuration from the environment:

  MAIL_SECRET_KEY          32+ characters; required to save or read a mailbox password
  RESEND_API_KEY, EMAIL_FROM                  Resend fallback (e.g. "Ariba HR <hr@example.com>")
  M365_TENANT_ID, M365_CLIENT_ID, M365_CLIENT_SECRET   Microsoft Graph Mail.Send (application permission)
  MAIL_DISABLED=1          never connect out (tests, local runs); sends are logged as failed with MAIL_DISABLED
"""
from __future__ import annotations

import base64
import hashlib
import html
import os
import re
import smtplib
import ssl
from dataclasses import dataclass, field
from email.message import EmailMessage
from email.utils import formataddr
from typing import Any

import httpx
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from sqlalchemy import text
from sqlalchemy.orm import Session

EMAIL_RE = re.compile(r"^\S+@\S+\.\S+$")


def is_email(x: Any) -> bool:
    return bool(EMAIL_RE.match(str(x or "").strip()))


def esc(s: Any) -> str:
    return html.escape(str(s or ""), quote=True)


def wrap(title: str, inner: str) -> str:
    """Their mail.ts `wrap` (the HTML frame of every e-mail)."""
    return (f'<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">'
            f'<div style="background:#014D3D;color:#fff;padding:14px 18px;font-weight:700">{esc(title)}</div>'
            f'<div style="padding:18px;line-height:1.9;color:#111">{inner}</div>'
            f'<div style="padding:10px 18px;background:#f8fafc;color:#64748b;font-size:12px">الموارد البشرية — أريبا</div></div>')


# ---------------------------------------------------------------- password encryption (AES-GCM)
def _key() -> bytes:
    secret = os.environ.get("MAIL_SECRET_KEY", "")
    if len(secret) < 32:
        raise RuntimeError("MAIL_SECRET_KEY is not set (32+ characters)")
    return hashlib.sha256(secret.encode()).digest()


def encrypt(password: str) -> bytes:
    nonce = os.urandom(12)
    return nonce + AESGCM(_key()).encrypt(nonce, password.encode(), b"ariba-mail")


def decrypt(blob: bytes | memoryview | None) -> str:
    if not blob:
        return ""
    b = bytes(blob)
    return AESGCM(_key()).decrypt(b[:12], b[12:], b"ariba-mail").decode()


# ---------------------------------------------------------------- accounts
@dataclass
class Account:
    owner: str
    host: str
    port: int
    secure: bool
    username: str
    password: str
    from_name: str | None
    from_email: str


@dataclass
class Mail:
    to: list[str]
    subject: str
    html: str
    attachments: list[dict[str, str]] = field(default_factory=list)  # {filename, content(base64), contentType}


def pick_account(db: Session, owner_id: str | None) -> Account | None:
    """The sender's own mailbox, else the company's (mail.ts pickAccount)."""
    owners = [o for o in (owner_id, "company") if o]
    rows = {r["owner"]: r for r in db.execute(text("SELECT * FROM public.ariba_mail_accounts WHERE owner = ANY(:o)"), {"o": owners}).mappings()}
    row = rows.get(owner_id or "") or rows.get("company")
    if not row:
        return None
    try:
        pw = decrypt(row["password_enc"])
    except Exception:  # noqa: BLE001 - a wrong key must not break the send; it fails over to Resend
        pw = ""
    return Account(row["owner"], row["host"] or "", int(row["port"] or 465), bool(row["secure"]), row["username"] or "", pw,
                   row["from_name"], row["from_email"])


def fix_account(acc: Account) -> Account:
    """mail.ts fixAccount: common Gmail typos; port 465 means SSL."""
    host = acc.host.strip().lower()
    if re.match(r"^smtp\.(gmil|gmial|gmai|gamil|gmal)\.com$", host) or host in ("gmail.com", "smtp.gmail"):
        host = "smtp.gmail.com"
    port = acc.port or 465
    return Account(acc.owner, host, port, True if port == 465 else acc.secure, acc.username, acc.password, acc.from_name, acc.from_email)


def is_o365(host: str) -> bool:
    return bool(re.search(r"office365|outlook\.com|live\.com|hotmail", host or "", re.I))


def _smtp(acc: Account, m: Mail) -> None:
    msg = EmailMessage()
    msg["From"] = formataddr((acc.from_name.replace('"', ""), acc.from_email)) if acc.from_name else acc.from_email
    msg["To"] = ", ".join(m.to)
    msg["Subject"] = m.subject
    msg.set_content("هذه الرسالة بتنسيق HTML.")
    msg.add_alternative(m.html, subtype="html")
    for a in m.attachments:
        maintype, _, subtype = (a.get("contentType") or "application/octet-stream").partition("/")
        msg.add_attachment(base64.b64decode(a["content"]), maintype=maintype, subtype=subtype or "octet-stream", filename=a["filename"])
    ctx = ssl.create_default_context()
    if acc.port == 465 or acc.secure and acc.port != 587:
        with smtplib.SMTP_SSL(acc.host, acc.port, context=ctx, timeout=15) as s:
            s.login(acc.username, acc.password)
            s.send_message(msg)
    else:
        with smtplib.SMTP(acc.host, acc.port, timeout=15) as s:
            s.starttls(context=ctx)
            s.login(acc.username, acc.password)
            s.send_message(msg)


def _graph(acc: Account, m: Mail) -> dict[str, Any]:
    tenant, cid, secret = os.environ.get("M365_TENANT_ID"), os.environ.get("M365_CLIENT_ID"), os.environ.get("M365_CLIENT_SECRET")
    if not (tenant and cid and secret):
        return {"ok": False, "error": "M365_GRAPH_NOT_CONFIGURED", "message": "Microsoft 365 يحتاج M365_TENANT_ID وM365_CLIENT_ID وM365_CLIENT_SECRET وصلاحية Mail.Send مع موافقة المسؤول."}
    if any(len(a["content"]) > 4_000_000 for a in m.attachments):
        return {"ok": False, "error": "M365_ATTACHMENT_TOO_LARGE", "message": "ملف PDF أكبر من 3 MB؛ قلّل حجمه ثم أعد الإرسال."}
    sender = (acc.from_email or acc.username).strip()
    with httpx.Client(timeout=20) as c:
        tr = c.post(f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
                    data={"client_id": cid, "client_secret": secret, "scope": "https://graph.microsoft.com/.default", "grant_type": "client_credentials"})
        token = tr.json().get("access_token") if tr.status_code == 200 else None
        if not token:
            return {"ok": False, "error": "M365_TOKEN_FAILED", "message": "فشل تسجيل تطبيق Microsoft 365؛ راجع بيانات التطبيق."}
        message = {"subject": m.subject, "body": {"contentType": "HTML", "content": m.html},
                   "toRecipients": [{"emailAddress": {"address": a}} for a in m.to],
                   "attachments": [{"@odata.type": "#microsoft.graph.fileAttachment", "name": a["filename"],
                                    "contentType": a.get("contentType") or "application/pdf", "contentBytes": a["content"]} for a in m.attachments]}
        sent = c.post(f"https://graph.microsoft.com/v1.0/users/{sender}/sendMail", headers={"Authorization": f"Bearer {token}"},
                      json={"message": message, "saveToSentItems": True})
        if sent.status_code >= 300:
            return {"ok": False, "error": "M365_SEND_FAILED", "message": f"Microsoft 365 رفض الإرسال ({sent.status_code}). " + sent.text[:180]}
    return {"ok": True, "via": "microsoft_graph", "from": sender}


def _resend(acc: Account | None, m: Mail) -> dict[str, Any] | None:
    key, sender = os.environ.get("RESEND_API_KEY"), os.environ.get("EMAIL_FROM")
    if not (key and sender):
        return None
    r = httpx.post("https://api.resend.com/emails", headers={"Authorization": f"Bearer {key}"}, timeout=20, json={
        "from": sender, "to": m.to, "subject": m.subject, "html": m.html, "reply_to": acc.from_email if acc else None,
        "attachments": [{"filename": a["filename"], "content": a["content"]} for a in m.attachments]})
    if r.status_code < 300:
        return {"ok": True, "via": "resend", "from": sender}
    return {"ok": False, "error": "SEND_FAILED", "message": "Resend: " + r.text[:200]}


def send(acc0: Account | None, m: Mail) -> dict[str, Any]:
    """mail.ts sendMail: Graph for Microsoft 365, else SMTP; Resend when SMTP fails or nothing is saved.
    Our server is not on Supabase, so ports 25/587 are not blocked here."""
    if os.environ.get("MAIL_DISABLED") == "1":
        return {"ok": False, "error": "MAIL_DISABLED", "message": "الإرسال معطّل في هذه البيئة (MAIL_DISABLED)"}
    errs: list[str] = []
    acc = fix_account(acc0) if acc0 else None
    if acc and is_o365(acc.host):
        try:
            return _graph(acc, m)
        except httpx.HTTPError as e:
            return {"ok": False, "error": "M365_SEND_FAILED", "message": "تعذر الاتصال بـ Microsoft Graph: " + str(e)[:180]}
    if acc:
        try:
            _smtp(acc, m)
            return {"ok": True, "via": "smtp", "from": acc.from_email}
        except (OSError, smtplib.SMTPException) as e:
            errs.append("SMTP: " + str(e)[:200])
    try:
        r = _resend(acc, m)
    except httpx.HTTPError as e:
        r = {"ok": False, "error": "SEND_FAILED", "message": "Resend: " + str(e)[:200]}
    if r and r["ok"]:
        return r
    if r:
        errs.append(r["message"])
    if not acc and not r:
        return {"ok": False, "error": "EMAIL_NOT_CONFIGURED", "message": "مفيش بريد إرسال مضبوط (الإعدادات ← البريد والإشعارات)"}
    return {"ok": False, "error": "SEND_FAILED", "message": " | ".join(errs)}


def log_send(db: Session, kind: str, to: list[str], subject: str, result: dict[str, Any], by: str | None) -> None:
    db.execute(text("""INSERT INTO public.ariba_mail_log(kind,recipients,subject,status,error,sent_by)
        VALUES(:k,:to,:s,:st,:e,:by)"""), {"k": kind, "to": to, "s": subject[:300], "st": "sent" if result.get("ok") else "failed",
                                           "e": None if result.get("ok") else str(result.get("message") or result.get("error"))[:500], "by": by})


def employee_email(data: dict[str, Any]) -> str | None:
    for k in ("email", "workEmail", "mail"):
        v = str(data.get(k) or "").strip()
        if is_email(v):
            return v
    return None
