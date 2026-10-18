"""Document signing (their sql/13 + Docs.jsx/MgrSignDocs.jsx) and leave attachments kept on the server (sql/14).

Signing: the employee approves a form "with signature" — the app places his signature (kept on his device only) in
the document and sends the signed copy. When the form's type needs the direct manager (settings doc_sign_cfg:
manager_types, '*' = all), it waits for the manager's signature, then goes on; otherwise the form is approved at once.
The manager may refuse with a reason (the employee is told). HR receives only the signed copy."""
from __future__ import annotations

import base64
import binascii
import uuid
from typing import Any

from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.database import get_db
from app.routers import canonical as c
from app.services import port_common as pc

router = APIRouter()
MAX_LEAVE_FILE = 13 * 1024 * 1024


def _b64(value: Any, limit: int, label: str = "الملف") -> bytes:
    try:
        raw = base64.b64decode(str(value or "").split(",")[-1], validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ApiError(422, "BAD_FILE", f"{label} غير صالح") from exc
    if not raw:
        raise ApiError(422, "BAD_FILE", f"{label} فارغ")
    if len(raw) > limit:
        raise ApiError(413, "FILE_TOO_LARGE", f"{label} أكبر من الحد المسموح")
    return raw


def _sign_cfg(db: Session) -> list[str]:
    v = pc.get_setting(db, "doc_sign_cfg")
    return list((v or {}).get("manager_types") or []) if isinstance(v, dict) else []


@router.get("/settings/doc-sign")
def get_sign_cfg(actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    pc.require(db, actor, "settings|forms")
    return {"manager_types": _sign_cfg(db)}


@router.put("/settings/doc-sign")
def set_sign_cfg(body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    pc.require(db, actor, "settings", "edit")
    types = [str(x) for x in (body.get("manager_types") or []) if str(x).strip()][:30]
    pc.set_setting(db, "doc_sign_cfg", {"manager_types": types}, actor.get("username"))
    c._write_audit(db, actor, request, "settings", "update", "ariba_app_settings", "doc_sign_cfg", details={"manager_types": types})
    db.commit()
    return {"manager_types": types}


@router.get("/documents/{document_id}/content")
def document_content(document_id: uuid.UUID, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_get_document: the file as base64 with its name and type (the employee: his own; a manager: his team)."""
    row = c._row(db, "SELECT * FROM public.ariba_documents WHERE id=:id", id=document_id)
    if not row:
        raise ApiError(404, "not_found", "Document not found")
    signing = c._row(db, "SELECT manager_id FROM public.ariba_doc_signing WHERE document_id=:d", d=document_id)
    if not (signing and signing["manager_id"] == actor.get("employee_id")):
        c._employee_scope(db, actor, row["employee_id"])
    return {"id": str(row["id"]), "file_name": row["file_name"], "mime_type": row["mime_type"], "base64": base64.b64encode(bytes(row["file_data"])).decode()}


@router.post("/me/letters/{request_id}/sign")
def employee_sign(request_id: uuid.UUID, body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_doc_employee_sign (+ the approval their app sends right after when no manager signature is needed)."""
    eid = actor.get("employee_id")
    req = c._row(db, """SELECT * FROM public.workflow_requests WHERE id=:id AND employee_id=:e AND request_type LIKE 'template:%'
        AND current_stage='employee' AND status='pending'""", id=request_id, e=eid)
    if not req:
        raise ApiError(404, "not_found", "المستند غير موجود أو تم الرد عليه")
    if c._row(db, "SELECT 1 AS x FROM public.ariba_doc_signing WHERE request_id=:r AND stage<>'rejected'", r=request_id):
        raise ApiError(409, "ALREADY_SIGNED", "تم التوقيع على هذا المستند")
    signed = _b64(body.get("signed_base64"), 3 * 1024 * 1024, "المستند الموقّع")
    template_type = str(body.get("template_type") or (req.get("payload") or {}).get("template_type") or req["request_type"].split(":", 1)[-1])
    title = (req.get("payload") or {}).get("title") or template_type
    doc_id = db.scalar(text("""INSERT INTO public.ariba_documents(employee_id,request_id,document_type,file_name,mime_type,file_data,uploaded_by)
        VALUES(:e,:r,'signed_document',:n,'text/html',:d,:by) RETURNING id"""), {"e": eid, "r": request_id, "n": f"{title} (موقّع).html", "d": signed, "by": actor.get("username")})
    manager = (c._row(db, "SELECT manager_id FROM public.employee_directory WHERE employee_id=:e", e=eid) or {}).get("manager_id")
    types = _sign_cfg(db)
    needs = bool(manager) and ("*" in types or template_type in types)
    db.execute(text("""INSERT INTO public.ariba_doc_signing(request_id,document_id,employee_id,manager_id,template_type,stage,needs_manager)
        VALUES(:r,:d,:e,:m,:t,:s,:n) ON CONFLICT(request_id) DO UPDATE SET document_id=EXCLUDED.document_id,stage=EXCLUDED.stage,
        needs_manager=EXCLUDED.needs_manager,emp_signed_at=now(),mgr_signed_at=NULL,reject_reason=NULL,updated_at=now()"""),
               {"r": request_id, "d": doc_id, "e": eid, "m": manager if needs else None, "t": template_type, "s": "manager" if needs else "hr", "n": needs})
    if needs:
        pc.notify(db, manager, request_id, "مستند بانتظار توقيعك كمدير", f"وقّعه {actor.get('name_ar')}: {title}", "manager", "template")
        nxt = "manager"
    else:
        _ack(db, actor, req, "approved", None)
        nxt = "hr"
    c._write_audit(db, actor, request, "letters", "employee_sign", "workflow_request", request_id, details={"next": nxt})
    db.commit()
    return {"next": nxt, "document_id": str(doc_id)}


def _ack(db: Session, actor: dict[str, Any], req: dict[str, Any], action: str, reason: str | None) -> None:
    """The employee's answer to a form (their ariba_employee_ack_template) — approved completes it; HR is told."""
    db.execute(text("INSERT INTO public.workflow_actions(request_id,actor_account_id,stage,action,comment) VALUES(:id,:aid,'employee',:a,:c)"),
               {"id": req["id"], "aid": actor.get("account_id"), "a": action, "c": reason})
    db.execute(text("UPDATE public.workflow_requests SET current_stage=:s,completed_at=now(),updated_at=now() WHERE id=:id"),
               {"s": "completed" if action == "approved" else "rejected", "id": req["id"]})
    title = (req.get("payload") or {}).get("title") or ""
    name = (c._row(db, "SELECT name_ar FROM public.employee_directory WHERE employee_id=:e", e=req["employee_id"]) or {}).get("name_ar")
    for h in pc.hr_people(db):
        pc.notify(db, h, req["id"], ("✅ وافق" if action == "approved" else "❌ رفض") + f" {name} على مستند", title, "hr", "template")


@router.get("/me/sign/states")
def my_sign_states(actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_doc_my_states."""
    rows = c._rows(db, "SELECT request_id,stage,needs_manager,reject_reason,emp_signed_at,mgr_signed_at FROM public.ariba_doc_signing WHERE employee_id=:e", e=actor.get("employee_id"))
    return [{**r, "request_id": str(r["request_id"])} for r in rows]


@router.get("/me/sign/pending")
def manager_pending(actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_doc_manager_pending: forms my team members signed that wait for my signature."""
    rows = c._rows(db, """SELECT s.request_id,s.document_id,s.employee_id,d.name_ar AS employee_name,s.emp_signed_at,s.template_type
        FROM public.ariba_doc_signing s JOIN public.employee_directory d ON d.employee_id=s.employee_id
        WHERE s.manager_id=:m AND s.stage='manager' ORDER BY s.emp_signed_at""", m=actor.get("employee_id"))
    return [{**r, "request_id": str(r["request_id"]), "document_id": str(r["document_id"])} for r in rows]


@router.post("/me/sign/{request_id}")
def manager_sign(request_id: uuid.UUID, body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_doc_manager_sign: approved (with the manager's signature) → the form is approved and goes to HR;
    rejected (reason ≥ 3 letters) → the employee is told."""
    s = c._row(db, "SELECT * FROM public.ariba_doc_signing WHERE request_id=:r AND manager_id=:m AND stage='manager'", r=request_id, m=actor.get("employee_id"))
    if not s:
        raise ApiError(404, "not_found", "لا يوجد مستند بانتظار توقيعك")
    req = c._row(db, "SELECT * FROM public.workflow_requests WHERE id=:r", r=request_id)
    if body.get("action") == "rejected":
        reason = str(body.get("reason") or "").strip()
        if len(reason) < 3:
            raise ApiError(422, "REASON_REQUIRED", "اكتب سبب الرفض")
        db.execute(text("UPDATE public.ariba_doc_signing SET stage='rejected',reject_reason=:r,updated_at=now() WHERE request_id=:id"), {"r": reason, "id": request_id})
        pc.notify(db, s["employee_id"], request_id, "رفض المدير توقيع المستند", reason, "employee", "template")
    elif body.get("action") == "approved":
        signed = _b64(body.get("signed_base64"), 3 * 1024 * 1024, "المستند الموقّع")
        db.execute(text("UPDATE public.ariba_documents SET file_data=:d WHERE id=:i"), {"d": signed, "i": s["document_id"]})
        db.execute(text("UPDATE public.ariba_doc_signing SET stage='hr',mgr_signed_at=now(),updated_at=now() WHERE request_id=:id"), {"id": request_id})
        if req and req["status"] == "pending":
            _ack(db, {"account_id": None}, req, "approved", "وقّعه المدير المباشر")
        pc.notify(db, s["employee_id"], request_id, "وقّع مديرك المستند", "أُرسل المستند للموارد البشرية", "employee", "template")
    else:
        raise ApiError(422, "invalid_action", "Action must be approved or rejected")
    c._write_audit(db, actor, request, "letters", "manager_sign", "workflow_request", request_id, details={"action": body.get("action")})
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------- leave attachments (sql/14)
def _leave_owner_ok(db: Session, actor: dict[str, Any], employee_id: str) -> bool:
    return pc.can(db, actor, "requests|leaves") or actor.get("employee_id") == employee_id


@router.post("/leave-files")
def save_leave_file(body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_leave_file_save."""
    eid, leave_id = str(body.get("employee_id") or ""), str(body.get("leave_id") or "")
    if not eid or not leave_id:
        raise ApiError(422, "validation_error", "leave_id and employee_id are required")
    if not (pc.can(db, actor, "requests|leaves", "edit") or actor.get("employee_id") == eid):
        raise ApiError(403, "NOT_AUTHORIZED", "ليست لديك صلاحية")
    raw = _b64(body.get("base64"), MAX_LEAVE_FILE, "المرفق")
    fid = db.scalar(text("""INSERT INTO public.ariba_leave_files(leave_id,employee_id,file_name,mime_type,file_data,created_by)
        VALUES(:l,:e,:n,:m,:d,:by) RETURNING id"""), {"l": leave_id, "e": eid, "n": str(body.get("file_name") or "file")[:200],
                                                     "m": str(body.get("mime_type") or "application/octet-stream")[:100], "d": raw, "by": actor.get("username")})
    c._write_audit(db, actor, request, "leaves", "file_save", "leave_file", fid, details={"leave_id": leave_id})
    db.commit()
    return {"id": str(fid)}


@router.get("/leave-files")
def list_leave_files(leave_id: str | None = None, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_leave_file_list: every attachment (HR), or only mine (an employee)."""
    mine_only = not pc.can(db, actor, "requests|leaves")
    rows = c._rows(db, """SELECT f.id,f.leave_id,f.employee_id,d.name_ar AS employee_name,f.file_name,f.mime_type,f.file_size,f.created_by,f.created_at
        FROM public.ariba_leave_files f LEFT JOIN public.employee_directory d ON d.employee_id=f.employee_id
        WHERE (CAST(:l AS text) IS NULL OR f.leave_id=:l) AND (CAST(:mine AS boolean)=false OR f.employee_id=:me) ORDER BY f.created_at DESC LIMIT 1000""",
                   l=leave_id, mine=mine_only, me=actor.get("employee_id"))
    return [{**r, "id": str(r["id"])} for r in rows]


@router.get("/leave-files/{file_id}")
def get_leave_file(file_id: uuid.UUID, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    f = c._row(db, "SELECT * FROM public.ariba_leave_files WHERE id=:i", i=file_id)
    if not f or not _leave_owner_ok(db, actor, f["employee_id"]):
        raise ApiError(404, "not_found", "الملف غير موجود")
    return {"file_name": f["file_name"], "mime_type": f["mime_type"], "base64": base64.b64encode(bytes(f["file_data"])).decode()}


@router.delete("/leave-files")
def delete_leave_files(leave_id: str, request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_leave_file_delete: a deleted leave takes its attachments with it."""
    pc.require(db, actor, "requests|leaves", "edit")
    n = db.execute(text("DELETE FROM public.ariba_leave_files WHERE leave_id=:l"), {"l": leave_id}).rowcount
    c._write_audit(db, actor, request, "leaves", "file_delete", "leave_file", leave_id, details={"deleted": n})
    db.commit()
    return {"deleted": n}
