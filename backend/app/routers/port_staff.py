"""The HR program's own data calls in the shapes their screens read (ARIBA_HR_React lib/data.js, lib/leaves.js,
lib/payroll.js, pages/attendance, forms, HrBell …), under their permission matrix (ariba_role_perms). Our older routes
keep serving the employee web app; these serve the ported HR screens.

ariba_staff_* / ariba_hr_leaves_since / ariba_hr_record_leave / ariba_hr_delete_leave / ariba_sync_holidays /
ariba_hr_locations / ariba_upsert_location / ariba_delete_location / ariba_hr_attendance_range / ariba_staff_attendance /
ariba_sync_attendance / ariba_hr_submit_overtime / ariba_list_documents / ariba_save_document / ariba_get_document /
ariba_hr_send_template / ariba_hr_template_status / ariba_hr_reset_password / ariba_hr_terminate_employee /
ariba_payroll_draft_get / ariba_sync_payroll / ariba_payroll_archive / ariba_my_notifications /
ariba_hr_set_attendance_settings / ariba_hr_set_flexible_hours / ariba_login_jwt (my permissions)."""
from __future__ import annotations

import base64
import binascii
import json
import secrets
import uuid
from datetime import UTC, date, datetime, time
from typing import Any

from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.database import get_db
from app.routers import canonical as c
from app.services import port_audit as pa
from app.services import port_common as pc

router = APIRouter()
LEAVE_TYPES = {"annual", "sick", "emergency", "death", "marriage", "paternity", "maternity", "umrah", "hajj", "remote", "unpaid", "mission"}
MAX_FILE = 12 * 1024 * 1024


def _b64(data: Any, what: str = "الملف") -> bytes:
    try:
        raw = base64.b64decode(str(data or ""), validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ApiError(422, "BAD_FILE", f"{what} غير صالح") from exc
    if not raw or len(raw) > MAX_FILE:
        raise ApiError(422, "FILE_TOO_LARGE", f"{what} فارغ أو أكبر من 12 MB")
    return raw


def _iso(v: Any) -> str | None:
    return v.isoformat() if isinstance(v, (date, datetime)) else (str(v) if v is not None else None)


# ---------------------------------------------------------------- who am I (ariba_login_jwt / ariba_my_perms)
@router.get("/me/perms")
def my_perms(actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    emp = c._row(db, "SELECT name_ar,name_en,data FROM public.employee_directory WHERE employee_id=:e", e=actor.get("employee_id")) or {}
    return {"ok": True, "role": actor.get("role"), "real_role": actor.get("role"), "perms": pc.perms_of(db, actor.get("role")),
            "username": actor.get("username"), "employee_id": actor.get("employee_id"), "name": emp.get("name_ar"),
            "name_en": emp.get("name_en"), "email": (emp.get("data") or {}).get("email")}


# ---------------------------------------------------------------- leaves (their normalizeLeave)
def _leave_out(r: dict[str, Any]) -> dict[str, Any]:
    p = r.get("payload") or {}
    hr = p.get("submitted_from") == "hr_main"
    return {"id": p.get("hr_leave_id") or str(r["wid"]) if hr else str(r["wid"]), "empId": r["employee_id"], "type": r["leave_type"],
            "from": _iso(r["from_date"]), "to": _iso(r["to_date"]), "days": r["days"], "status": r["status"], "notes": r.get("notes") or "",
            "hr": hr, "workflowRequestId": str(r["wid"]), "created_at": r["created_at"], "updated_at": r["updated_at"]}


@router.get("/staff/leaves")
def leaves_since(actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_hr_leaves_since: every leave (HR-recorded and from the workflow) with its status."""
    pc.require(db, actor, "staff|leaves|payroll|attendance")
    rows = c._rows(db, """SELECT l.employee_id,l.leave_type,l.from_date,l.to_date,l.days,l.notes,w.id AS wid,w.status,w.payload,w.created_at,w.updated_at
        FROM public.leave_requests l JOIN public.workflow_requests w ON w.id=l.workflow_request_id ORDER BY w.updated_at DESC""")
    return {"leaves": [_leave_out(r) for r in rows]}


def _hr_leave(db: Session, leave_id: str) -> dict[str, Any] | None:
    try:
        as_uuid = str(uuid.UUID(leave_id))
    except ValueError:
        as_uuid = None
    return c._row(db, """SELECT * FROM public.workflow_requests WHERE payload->>'hr_leave_id'=:i OR (CAST(:u AS text) IS NOT NULL AND id=CAST(:u AS uuid))
        ORDER BY created_at LIMIT 1""", i=leave_id, u=as_uuid)


@router.post("/staff/leaves")
def record_leave(body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_hr_record_leave: HR records (or re-saves with a new status) a leave by its own id."""
    pc.require(db, actor, "leaves", "edit")
    eid, lid, ltype = str(body.get("employee_id") or ""), str(body.get("hr_leave_id") or ""), str(body.get("type") or "annual")
    if not eid or not lid or ltype not in LEAVE_TYPES:
        raise ApiError(422, "validation_error", "بيانات الإجازة غير مكتملة")
    try:
        start = date.fromisoformat(str(body.get("from"))[:10])
        end = date.fromisoformat(str(body.get("to") or body.get("from"))[:10])
    except ValueError as exc:
        raise ApiError(422, "validation_error", "التاريخ غير صحيح") from exc
    if end < start:
        raise ApiError(422, "validation_error", "تاريخ النهاية قبل البداية")
    days = int(body.get("days") or 0) or (end - start).days + 1
    status = str(body.get("status") or "pending").lower()
    stage = {"approved": "completed", "rejected": "rejected"}.get(status, "hr")
    notes = str(body.get("notes") or "")
    old = _hr_leave(db, lid)
    payload = {**((old or {}).get("payload") or {}), "from": start.isoformat(), "to": end.isoformat(), "days": days, "notes": notes,
               "submitted_from": "hr_main", "hr_leave_id": lid}
    if old:
        db.execute(text("""UPDATE public.workflow_requests SET employee_id=:e,request_type=:t,payload=CAST(:p AS jsonb),current_stage=:s,updated_at=now(),
            completed_at=CASE WHEN :s IN ('completed','rejected') THEN now() END WHERE id=:id"""),
                   {"e": eid, "t": ltype, "p": json.dumps(payload, ensure_ascii=False), "s": stage, "id": old["id"]})
        db.execute(text("""UPDATE public.leave_requests SET employee_id=:e,leave_type=:t,from_date=:f,to_date=:to,days=:d,notes=:n,updated_at=now()
            WHERE workflow_request_id=:id"""), {"e": eid, "t": ltype, "f": start, "to": end, "d": days, "n": notes, "id": old["id"]})
        rid = old["id"]
    else:
        rid = db.scalar(text("""INSERT INTO public.workflow_requests(employee_id,request_type,payload,current_stage,completed_at)
            VALUES(:e,:t,CAST(:p AS jsonb),:s,CASE WHEN :s IN ('completed','rejected') THEN now() END) RETURNING id"""),
                        {"e": eid, "t": ltype, "p": json.dumps(payload, ensure_ascii=False), "s": stage})
        db.execute(text("""INSERT INTO public.leave_requests(employee_id,leave_type,from_date,to_date,days,notes,workflow_request_id)
            VALUES(:e,:t,:f,:to,:d,:n,:id)"""), {"e": eid, "t": ltype, "f": start, "to": end, "d": days, "n": notes, "id": rid})
    db.execute(text("INSERT INTO public.workflow_actions(request_id,actor_account_id,stage,action,comment) VALUES(:r,:a,'hr',:act,:c)"),
               {"r": rid, "a": actor["account_id"], "act": {"completed": "approved", "rejected": "rejected"}.get(stage, "submitted"), "c": notes or None})
    name = (c._row(db, "SELECT name_ar FROM public.employee_directory WHERE employee_id=:e", e=eid) or {}).get("name_ar") or eid
    c._write_audit(db, actor, request, "leaves", "تسجيل إجازة", "employee", eid, entity_name=name,
                   summary=f"تسجيل إجازة {ltype} لـ {name} من {start} إلى {end}" + ("" if status == "pending" else f" ({status})"))
    db.commit()
    return {"ok": True, "id": lid, "workflow_request_id": str(rid)}


@router.delete("/staff/leaves/{leave_id}")
def delete_leave(leave_id: str, request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_hr_delete_leave: kept in ariba_deleted_items, then removed."""
    pc.require(db, actor, "leaves", "edit")
    row = _hr_leave(db, leave_id)
    if not row:
        raise ApiError(404, "not_found", "الإجازة غير موجودة")
    db.execute(text("INSERT INTO public.ariba_deleted_items(kind,ref_id,employee_id,snapshot,deleted_by,deleted_by_role) VALUES('workflow_request',:i,:e,CAST(:s AS jsonb),:by,:r)"),
               {"i": str(row["id"]), "e": row["employee_id"], "s": json.dumps(row, default=str, ensure_ascii=False), "by": actor.get("employee_id"), "r": actor.get("role")})
    c._delete_request_rows(db, row["id"])
    c._write_audit(db, actor, request, "requests", "حذف طلب / مستند", "request", row["id"], summary=f"حذف إجازة (رقم {str(row['id'])[:8]})")
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------- holidays
@router.get("/staff/holidays")
def staff_holidays(actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    rows = c._rows(db, "SELECT id,name,name_en,holiday_date,days,recurring FROM public.public_holidays ORDER BY holiday_date")
    return [{"id": r["id"], "name": r["name"], "nameEn": r["name_en"] or r["name"], "date": _iso(r["holiday_date"]), "days": r["days"] or 1,
             "recurring": bool(r["recurring"])} for r in rows]


@router.put("/staff/holidays")
def sync_holidays(body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_sync_holidays: the whole list replaces the stored one."""
    if not (pc.can(db, actor, "settings", "edit") or pc.can(db, actor, "leaves", "edit")):
        raise ApiError(403, "NOT_AUTHORIZED", "ليست لديك صلاحية")
    items = body.get("holidays") if isinstance(body.get("holidays"), list) else []
    clean = []
    for h in items:
        try:
            d = date.fromisoformat(str(h.get("date"))[:10])
        except (ValueError, AttributeError) as exc:
            raise ApiError(422, "validation_error", "تاريخ عطلة غير صحيح") from exc
        name = str(h.get("name") or "").strip()
        if not name:
            raise ApiError(422, "validation_error", "اسم العطلة مطلوب")
        clean.append({"id": str(h.get("id") or uuid.uuid4())[:64], "n": name[:120], "ne": str(h.get("nameEn") or name)[:120], "d": d,
                      "days": max(1, min(60, int(h.get("days") or 1))), "r": bool(h.get("recurring"))})
    db.execute(text("DELETE FROM public.public_holidays"))
    for h in clean:
        db.execute(text("INSERT INTO public.public_holidays(id,name,name_en,holiday_date,days,recurring) VALUES(:id,:n,:ne,:d,:days,:r)"), h)
    c._write_audit(db, actor, request, "settings", "تحديث العطلات الرسمية", "public_holiday", None, summary=f"تحديث قائمة العطلات الرسمية ({len(clean)} عطلة)")
    db.commit()
    return {"ok": True, "count": len(clean)}


# ---------------------------------------------------------------- punch locations
def _loc_out(r: dict[str, Any]) -> dict[str, Any]:
    return {"id": r["id"], "name": r["name"], "nameEn": r.get("name_en") or r["name"], "name_en": r.get("name_en"), "employer": r.get("employer") or "all",
            "type": r["type"], "latitude": r["latitude"], "longitude": r["longitude"], "lat": r["latitude"], "lng": r["longitude"],
            "radius_m": r["radius_m"], "radius": r["radius_m"], "active": r["active"], "polygon": r.get("polygon")}


@router.get("/staff/locations")
def staff_locations(actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    rows = c._rows(db, """SELECT w.*,coalesce(e.name,'all') AS employer FROM public.work_locations w
        LEFT JOIN public.employers e ON e.id=w.employer_id ORDER BY w.name""")
    return {"locations": [_loc_out(r) for r in rows]}


@router.post("/staff/locations")
def upsert_location(body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_upsert_location: {id, name, name_en, employer ('all' or a company), type (hq/project/remote), latitude, longitude, radius_m}."""
    pc.require(db, actor, "locations", "edit")
    loc = body.get("location") if isinstance(body.get("location"), dict) else body
    name, ltype = str(loc.get("name") or "").strip(), str(loc.get("type") or "project")
    if not name or ltype not in ("hq", "project", "remote", "office"):
        raise ApiError(422, "validation_error", "بيانات الموقع غير صحيحة")
    try:
        lat, lng = float(loc.get("latitude") or 0), float(loc.get("longitude") or 0)
        radius = max(50, min(5000, int(loc.get("radius_m") or 200)))
    except (TypeError, ValueError) as exc:
        raise ApiError(422, "validation_error", "الإحداثيات غير صحيحة") from exc
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        raise ApiError(422, "validation_error", "الإحداثيات غير صحيحة")
    employer = str(loc.get("employer") or "all").strip()
    emp_id = None if employer.lower() == "all" else c._lookup_id(db, "employers", employer)
    lid = str(loc.get("id") or ("L" + str(int(datetime.now(UTC).timestamp() * 1000))))[:64]
    db.execute(text("""INSERT INTO public.work_locations(id,name,name_en,employer_id,type,latitude,longitude,radius_m,active)
        VALUES(:id,:n,:ne,:em,:t,:lat,:lng,:r,:a) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,name_en=EXCLUDED.name_en,employer_id=EXCLUDED.employer_id,
        type=EXCLUDED.type,latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,radius_m=EXCLUDED.radius_m,active=EXCLUDED.active,updated_at=now()"""),
               {"id": lid, "n": name[:120], "ne": str(loc.get("name_en") or name)[:120], "em": emp_id, "t": ltype, "lat": lat, "lng": lng, "r": radius,
                "a": loc.get("active") is not False})
    c._write_audit(db, actor, request, "locations", "إضافة/تعديل موقع بصمة", "location", lid, entity_name=name,
                   summary=f'موقع "{name}" — {lat}, {lng} — نصف القطر {radius}', details={"employer": employer, "type": ltype})
    db.commit()
    return {"ok": True, "id": lid}


@router.delete("/staff/locations/{location_id}")
def delete_location(location_id: str, request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_delete_location: deactivated (punches keep pointing at it)."""
    pc.require(db, actor, "locations", "edit")
    if not db.execute(text("UPDATE public.work_locations SET active=false,updated_at=now() WHERE id=:i"), {"i": location_id}).rowcount:
        raise ApiError(404, "not_found", "الموقع غير موجود")
    c._write_audit(db, actor, request, "locations", "حذف موقع بصمة", "location", location_id, summary=f"حذف موقع بصمة (رقم {location_id})")
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------- attendance
def _hm(t: Any) -> str | None:
    return str(t)[:8] if t is not None else None


def _att_out(r: dict[str, Any]) -> dict[str, Any]:
    return {"id": str(r["id"]), "emp_id": r["employee_id"], "employee_id": r["employee_id"], "date": _iso(r["date"]), "time_in": _hm(r.get("time_in")),
            "time_out": _hm(r.get("time_out")), "status": r.get("status") or "present", "location_id": r.get("location_id"),
            "location_name": r.get("location_name"), "lat": float(r["lat"]) if r.get("lat") is not None else None,
            "lng": float(r["lng"]) if r.get("lng") is not None else None, "notes": r.get("notes"), "late_minutes": r.get("late_minutes"),
            "early_minutes": r.get("early_minutes")}


_ATT_SQL = """SELECT a.*,w.name AS location_name FROM public.attendance a LEFT JOIN public.work_locations w ON w.id=a.location_id"""


@router.get("/staff/attendance/range")
def attendance_range(date_from: date, date_to: date, employee_id: str | None = None, actor: dict[str, Any] = Depends(c.current_actor),
                     db: Session = Depends(get_db)):
    """ariba_hr_attendance_range."""
    pc.require(db, actor, "attendance|payroll|reports")
    rows = c._rows(db, _ATT_SQL + " WHERE a.date BETWEEN :f AND :t AND (CAST(:e AS text) IS NULL OR a.employee_id=:e) ORDER BY a.date,a.employee_id,a.time_in",
                   f=date_from, t=date_to, e=employee_id)
    return [_att_out(r) for r in rows]


@router.get("/staff/attendance")
def staff_attendance(day: date, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_staff_attendance: the records of one day."""
    pc.require(db, actor, "attendance")
    return {"attendance": [_att_out(r) for r in c._rows(db, _ATT_SQL + " WHERE a.date=:d ORDER BY a.employee_id,a.time_in", d=day)]}


@router.put("/staff/attendance")
def sync_attendance(body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_sync_attendance: HR's manual record — replaces that employee's records of the day."""
    pc.require(db, actor, "attendance", "edit")
    eid = str(body.get("employee_id") or "")
    try:
        day = date.fromisoformat(str(body.get("date"))[:10])
        t_in = time.fromisoformat(str(body["time_in"])[:8]) if body.get("time_in") else None
        t_out = time.fromisoformat(str(body["time_out"])[:8]) if body.get("time_out") else None
    except ValueError as exc:
        raise ApiError(422, "validation_error", "الوقت أو التاريخ غير صحيح") from exc
    status = str(body.get("status") or "present")
    if status not in ("present", "late", "absent", "leave", "remote") or not c._row(db, "SELECT 1 AS x FROM public.employee_directory WHERE employee_id=:e", e=eid):
        raise ApiError(422, "validation_error", "بيانات الحضور غير صحيحة")
    loc = c._resolve_location_id(db, body.get("location_id") or body.get("location_name")) if (body.get("location_id") or body.get("location_name")) else None
    db.execute(text("DELETE FROM public.attendance WHERE employee_id=:e AND date=:d"), {"e": eid, "d": day})
    db.execute(text("""INSERT INTO public.attendance(employee_id,date,time_in,time_out,location_id,lat,lng,status,notes)
        VALUES(:e,:d,:i,:o,:l,:lat,:lng,:s,:n)"""), {"e": eid, "d": day, "i": t_in, "o": t_out, "l": loc, "lat": body.get("lat"), "lng": body.get("lng"),
                                                   "s": status, "n": body.get("notes")})
    name = (c._row(db, "SELECT name_ar FROM public.employee_directory WHERE employee_id=:e", e=eid) or {}).get("name_ar") or eid
    c._write_audit(db, actor, request, "attendance", "تعديل/إضافة سجل حضور", "employee", eid, entity_name=name,
                   summary=f"سجل حضور يدوي — {name} {day} {status}", details={"rec": {k: body.get(k) for k in ("date", "time_in", "time_out", "status")}})
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------- overtime recorded by HR
@router.post("/staff/overtime")
def submit_overtime(body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_hr_submit_overtime: an overtime request on behalf of the employee (goes through the workflow)."""
    pc.require(db, actor, "requests", "edit")
    from app.routers import port_workflow as pw
    eid = str(body.get("employee_id") or "")
    payload = body.get("payload") if isinstance(body.get("payload"), dict) else {}
    att = None
    if body.get("attachment_base64"):
        att = {"name": body.get("attachment_name") or "attachment", "mime": body.get("attachment_mime") or "application/octet-stream", "data": body["attachment_base64"]}
    emp = c._row(db, f"SELECT {c._EMPLOYEE_COLUMNS} FROM {c._EMPLOYEE_FROM} WHERE d.employee_id=:e", e=eid)
    if not emp:
        raise ApiError(404, "not_found", "الموظف غير موجود")
    row = pw.create_request(db, actor, eid, emp, {"type": "overtime", "payload": payload, "notes": payload.get("notes"), "attachment": att})
    out = pw._request_out(db, row)
    c._write_audit(db, actor, request, "requests", "تسجيل عمل إضافي", "employee", eid, summary=f"عمل إضافي لـ {eid}: {payload.get('date', '')} {payload.get('hours', '')}")
    db.commit()
    return out


# ---------------------------------------------------------------- documents (base64, as their screens send them)
@router.get("/staff/documents/{employee_id}")
def list_documents(employee_id: str, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    pc.require(db, actor, "attachments|documents|employees")
    rows = c._rows(db, """SELECT id,employee_id,request_id,document_type,file_name,mime_type,file_size,uploaded_by,created_at FROM public.ariba_documents
        WHERE employee_id=:e ORDER BY created_at DESC""", e=employee_id)
    return {"documents": [{**r, "id": str(r["id"]), "request_id": str(r["request_id"]) if r["request_id"] else None} for r in rows]}


@router.post("/staff/documents")
def save_document(body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    pc.require(db, actor, "attachments|documents|employees", "edit")
    eid = str(body.get("employee_id") or "")
    if not c._row(db, "SELECT 1 AS x FROM public.employee_directory WHERE employee_id=:e", e=eid):
        raise ApiError(404, "not_found", "الموظف غير موجود")
    raw = _b64(body.get("base64"))
    did = db.scalar(text("""INSERT INTO public.ariba_documents(employee_id,request_id,document_type,file_name,mime_type,file_data,uploaded_by)
        VALUES(:e,:r,:t,:n,:m,:d,:by) RETURNING id"""), {"e": eid, "r": body.get("request_id"), "t": str(body.get("document_type") or "other")[:40],
                                                        "n": str(body.get("file_name") or "file")[:200], "m": str(body.get("mime_type") or "application/octet-stream")[:100],
                                                        "d": raw, "by": actor.get("username")})
    c._write_audit(db, actor, request, "documents", "رفع مستند", "employee", eid, summary=f"رفع مستند ({body.get('document_type') or 'other'}) للموظف {eid}")
    db.commit()
    return {"id": str(did)}


@router.post("/staff/templates")
def send_template(body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_hr_send_template: a form (HTML) the employee approves or objects to from the app."""
    pc.require(db, actor, "forms|documents", "edit")
    eid, ttype, title = str(body.get("employee_id") or ""), str(body.get("template_type") or "custom")[:40], str(body.get("title") or "").strip()[:200]
    if not title or not c._row(db, "SELECT 1 AS x FROM public.employee_directory WHERE employee_id=:e", e=eid):
        raise ApiError(422, "validation_error", "الموظف والعنوان مطلوبان")
    raw = _b64(body.get("base64"), "النموذج")
    rtype = "template:" + ttype
    db.execute(text("""INSERT INTO public.workflow_request_types(code,name_ar,name_en) SELECT :c,:n,:n
        WHERE NOT EXISTS (SELECT 1 FROM public.workflow_request_types WHERE code=:c)"""), {"c": rtype, "n": title})
    rid = db.scalar(text("""INSERT INTO public.workflow_requests(employee_id,request_type,payload,current_stage) VALUES(:e,:t,CAST(:p AS jsonb),'employee') RETURNING id"""),
                    {"e": eid, "t": rtype, "p": json.dumps({"title": title, "template_type": ttype, "emp_no": body.get("emp_no"), "sent_by": actor.get("employee_id")}, ensure_ascii=False)})
    db.execute(text("INSERT INTO public.workflow_actions(request_id,actor_account_id,stage,action,comment) VALUES(:r,:a,'hr','submitted',:c)"),
               {"r": rid, "a": actor["account_id"], "c": title})
    db.execute(text("""INSERT INTO public.ariba_documents(employee_id,request_id,document_type,file_name,mime_type,file_data,uploaded_by)
        VALUES(:e,:r,'letter',:n,:m,:d,:by)"""), {"e": eid, "r": rid, "n": str(body.get("file_name") or ttype + ".html")[:200],
                                                 "m": str(body.get("mime_type") or "text/html")[:100], "d": raw, "by": actor.get("username")})
    pc.notify(db, eid, rid, "نموذج جديد بانتظار ردك", title, "employee", "template")
    name = (c._row(db, "SELECT name_ar FROM public.employee_directory WHERE employee_id=:e", e=eid) or {}).get("name_ar") or eid
    c._write_audit(db, actor, request, "documents", "إرسال نموذج للموظف", "employee", eid, entity_name=name, summary=f"إرسال نموذج ({title}) إلى {name}")
    db.commit()
    return {"ok": True, "request_id": str(rid)}


@router.get("/staff/templates")
def template_status(actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    pc.require(db, actor, "forms|documents")
    rows = c._rows(db, """SELECT r.id,r.employee_id,r.payload->>'template_type' AS template_type,r.payload->>'title' AS title,r.status,r.current_stage AS stage,r.created_at,r.updated_at,
        r.completed_at AS responded_at,(SELECT a.comment FROM public.workflow_actions a WHERE a.request_id=r.id AND a.action='rejected' ORDER BY a.created_at DESC LIMIT 1) AS rejection_reason
        FROM public.workflow_requests r WHERE r.request_type LIKE 'template:%' ORDER BY r.created_at DESC LIMIT 500""")
    return [{**r, "id": str(r["id"]), "template_type": r["template_type"] or ""} for r in rows]


# ---------------------------------------------------------------- employee account and termination
@router.post("/staff/employees/{employee_id}/reset-password")
def reset_password(employee_id: str, request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_hr_reset_password: a temporary password shown once (the employee must change it); creates the account if missing."""
    pc.require(db, actor, "employees_admin", "edit")
    emp = c._row(db, "SELECT employee_id,name_ar,data FROM public.employee_directory WHERE employee_id=:e", e=employee_id)
    if not emp:
        raise ApiError(404, "not_found", "الموظف غير موجود")
    acc = c._row(db, "SELECT * FROM public.ariba_auth_accounts WHERE employee_id=:e", e=employee_id)
    if acc and acc["role"] in pc.FULL_ROLES and actor.get("role") not in pc.FULL_ROLES:
        raise ApiError(403, "NOT_AUTHORIZED", "ليست لديك صلاحية")
    temp = "".join(secrets.choice("abcdefghjkmnpqrstuvwxyz23456789") for _ in range(8)) + secrets.choice("abcdefghjkmnpqrstuvwxyz") + secrets.choice("23456789")
    h = c._hasher.hash(temp)
    if acc:
        db.execute(text("UPDATE public.ariba_auth_accounts SET password_hash=:h,must_change=true,active=true,updated_at=now() WHERE id=:i"), {"h": h, "i": acc["id"]})
        db.execute(text("DELETE FROM public.ariba_sessions WHERE account_id=:i"), {"i": acc["id"]})
        username = acc["username"]
    else:
        no = str((emp["data"] or {}).get("empNo") or employee_id)
        username = ("emp" + no.zfill(3)) if no.isdigit() else no.lower()
        db.execute(text("INSERT INTO public.ariba_auth_accounts(username,password_hash,role,employee_id,active,must_change) VALUES(:u,:h,'employee',:e,true,true)"),
                   {"u": username, "h": h, "e": employee_id})
    c._write_audit(db, actor, request, "security", "إعادة تعيين كلمة مرور", "employee", employee_id, entity_name=emp["name_ar"],
                   summary=f"إعادة تعيين كلمة مرور {emp['name_ar']}")
    db.commit()
    return {"ok": True, "username": username, "temporary_password": temp}


@router.post("/staff/employees/{employee_id}/terminate")
def terminate(employee_id: str, body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_hr_terminate_employee: {reason, last_day}."""
    pc.require(db, actor, "employees_admin", "edit")
    row = c._row(db, "SELECT name_ar,data FROM public.employee_directory WHERE employee_id=:e", e=employee_id)
    if not row:
        raise ApiError(404, "not_found", "الموظف غير موجود")
    last = str(body.get("last_day") or "")[:10]
    try:
        date.fromisoformat(last)
    except ValueError as exc:
        raise ApiError(422, "validation_error", "آخر يوم عمل غير صحيح") from exc
    reason = str(body.get("reason") or "").strip()
    data = {**(row["data"] or {}), "isTerminated": True, "term": True, "lastDay": last, "terminationDate": last, "terminationReason": reason}
    db.execute(text("UPDATE public.employee_directory SET active=false,data=CAST(:d AS jsonb),updated_at=now() WHERE employee_id=:e"),
               {"d": json.dumps(data, ensure_ascii=False, default=str), "e": employee_id})
    c._write_audit(db, actor, request, "employees", "إنهاء خدمة موظف", "employee", employee_id, entity_name=row["name_ar"],
                   summary=f"إنهاء خدمة {row['name_ar']} — {reason} (آخر يوم {last})")
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------- payroll (their draft / sync / archive)
def _month(year: int, month: int) -> tuple[int, int]:
    if not (2000 <= year <= 2100 and 1 <= month <= 12):
        raise ApiError(422, "validation_error", "الشهر غير صحيح")
    return year, month


@router.get("/staff/payroll/{year}/{month}")
def payroll_draft(year: int, month: int, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_payroll_draft_get: {rows:[{employee_id, payload, updated_at}], approved, approved_at}."""
    pc.require(db, actor, "payroll|payroll_prepare|payroll_approve")
    y, m = _month(year, month)
    period = c._row(db, "SELECT approved,approved_at FROM public.payroll_periods WHERE pay_year=:y AND pay_month=:m", y=y, m=m) or {}
    items = c._rows(db, "SELECT employee_id,payload,updated_at FROM public.employee_payrolls WHERE pay_year=:y AND pay_month=:m", y=y, m=m)
    if not items:  # months saved before (one archive row) — same rows, one per employee
        arch = c._row(db, "SELECT rows,coalesce(updated_at,saved_at) AS u FROM public.payroll_archives_v2 WHERE pay_year=:y AND pay_month=:m", y=y, m=m)
        items = [{"employee_id": str(r.get("id") or r.get("employee_id")), "payload": r, "updated_at": arch["u"]} for r in (arch or {}).get("rows") or [] if isinstance(r, dict)]
    items.sort(key=lambda r: float((r["payload"] or {}).get("idx") or 0))
    return {"rows": items, "approved": bool(period.get("approved")), "approved_at": period.get("approved_at")}


def _pay_diffs(old_rows: list[dict[str, Any]], new_rows: list[dict[str, Any]], month: str) -> list[tuple[str, str, dict[str, Any], str]]:
    """Their logPayEdit, server side: one entry per changed manual field of a row."""
    old = {str(r.get("id")): r for r in old_rows if isinstance(r, dict)}
    out = []
    for r in new_rows:
        if not isinstance(r, dict) or str(r.get("id")) not in old:
            continue
        o = old[str(r.get("id"))]
        for f in pa.PAYF:
            if pa._js(o.get(f)) != pa._js(r.get(f)):
                got = pa.pay_edit(r, f, o.get(f), r.get(f), month)
                if got:
                    out.append((*got, str(r.get("id"))))
    return out


@router.put("/staff/payroll/{year}/{month}")
def sync_payroll(year: int, month: int, body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_sync_payroll: saves the month's rows; with approved=true it is finance's approval (the month must be prepared,
    admin/chairman may approve directly); an approved month is locked until finance reopens it."""
    y, m = _month(year, month)
    rows = [r for r in (body.get("rows") or []) if isinstance(r, dict)]
    key = f"pay_{y}_{m:02d}"
    status = c._pay_status(db, y, m)
    if status["status"] == "approved":
        raise ApiError(409, "PAYROLL_APPROVED_LOCKED", "المسير معتمد ومقفول")
    approve = bool(body.get("approved"))
    if approve:
        if not pc.can(db, actor, "payroll_approve", "edit"):
            raise ApiError(403, "APPROVAL_REQUIRES_FINANCE", "الاعتماد للمالية")
        if actor.get("role") not in pc.FULL_ROLES and status["status"] != "prepared":
            raise ApiError(409, "PAYROLL_NOT_PREPARED", "المسير لسه ما اتجهّزش")
    elif not (pc.can(db, actor, "payroll", "edit") or pc.can(db, actor, "payroll_prepare", "edit")):
        raise ApiError(403, "NOT_AUTHORIZED", "ليست لديك صلاحية")
    old_rows = [dict(i["payload"] or {}) for i in c._rows(db, "SELECT payload FROM public.employee_payrolls WHERE pay_year=:y AND pay_month=:m", y=y, m=m)]
    ids = c._employee_ids(db)
    db.execute(text("INSERT INTO public.payroll_periods(pay_year,pay_month,approved) VALUES(:y,:m,false) ON CONFLICT(pay_year,pay_month) DO NOTHING"), {"y": y, "m": m})
    db.execute(text("DELETE FROM public.employee_payrolls WHERE pay_year=:y AND pay_month=:m"), {"y": y, "m": m})
    for i, r in enumerate(rows):
        eid = ids.get(str(r.get("id") or "")) or ids.get(str(r.get("empNo") or ""))
        if eid:
            db.execute(text("INSERT INTO public.employee_payrolls(employee_id,pay_year,pay_month,payload,updated_at) VALUES(:e,:y,:m,CAST(:p AS jsonb),now())"),
                       {"e": eid, "y": y, "m": m, "p": json.dumps({**r, "idx": r.get("idx") or i + 1}, ensure_ascii=False, default=str)})
    payload = json.dumps(rows, ensure_ascii=False, default=str)
    done = db.execute(text("UPDATE public.payroll_archives_v2 SET rows=CAST(:r AS jsonb),approved=:a,approved_at=CASE WHEN :a THEN now()::text END,updated_at=now() WHERE pay_year=:y AND pay_month=:m"),
                      {"r": payload, "a": approve, "y": y, "m": m})
    if not done.rowcount:
        db.execute(text("INSERT INTO public.payroll_archives_v2(pay_year,pay_month,approved,approved_at,rows,saved_at,updated_at) VALUES(:y,:m,:a,CASE WHEN :a THEN now()::text END,CAST(:r AS jsonb),now(),now())"),
                   {"r": payload, "a": approve, "y": y, "m": m})
    by = actor.get("name_ar") or actor.get("username")
    if approve:
        db.execute(text("UPDATE public.payroll_periods SET approved=true,approved_at=now(),approved_by=:b WHERE pay_year=:y AND pay_month=:m"), {"b": by, "y": y, "m": m})
        c._write_audit(db, actor, request, "payroll", "اعتماد المسير", "payroll_month", key, summary=f"اعتماد مسير {m}/{y}")
    for action, summary, details, eid in _pay_diffs(old_rows, rows, f"{y}-{m:02d}")[:200]:
        c._write_audit(db, actor, request, "payroll", action, "employee", eid, summary=summary, details=details)
    db.commit()
    return {"ok": True, "rows": len(rows), "approved": approve}


@router.get("/staff/payroll-archive")
def payroll_archive(year: int | None = None, month: int | None = None, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_payroll_archive: the approved months (all, or one with its rows)."""
    pc.require(db, actor, "payroll|payroll_approve")
    rows = c._rows(db, """SELECT a.pay_year AS year,a.pay_month AS month,p.approved_at,p.approved_by,a.rows FROM public.payroll_archives_v2 a
        JOIN public.payroll_periods p USING(pay_year,pay_month) WHERE p.approved AND (CAST(:y AS int) IS NULL OR (a.pay_year=:y AND a.pay_month=:m))
        ORDER BY a.pay_year DESC,a.pay_month DESC""", y=year, m=month)
    return {"archives": rows}


# ---------------------------------------------------------------- the bell (HrBell)
@router.get("/staff/notifications")
def my_notifications(limit: int = 40, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    rows = c._rows(db, """SELECT id,title,body,stage,kind,request_id,created_at,read_at FROM public.workflow_notifications
        WHERE recipient_employee_id=:e ORDER BY created_at DESC LIMIT :l""", e=actor.get("employee_id"), l=max(1, min(limit, 100)))
    unread = db.scalar(text("SELECT count(*) FROM public.workflow_notifications WHERE recipient_employee_id=:e AND read_at IS NULL"), {"e": actor.get("employee_id")}) or 0
    return {"items": [{**r, "id": str(r["id"]), "request_id": str(r["request_id"]) if r["request_id"] else None, "is_read": r["read_at"] is not None} for r in rows],
            "unread": unread}


# ---------------------------------------------------------------- attendance settings, as their cards save them
def _company(db: Session) -> dict[str, Any]:
    row = c._row(db, "SELECT * FROM public.company_settings WHERE id='default'")
    if not row:
        raise ApiError(404, "not_found", "company_settings row is missing")
    return row


@router.put("/staff/attendance-settings")
def set_attendance_settings(body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_hr_set_attendance_settings: work start, late tolerance, remote days per year."""
    pc.require(db, actor, "settings", "edit")
    row = _company(db)
    try:
        start = time.fromisoformat(str(body.get("work_start") or row.get("work_start") or "08:00")[:8])
        tol = max(0, min(240, int(body.get("tolerance_minutes", row.get("tolerance_minutes") or 15))))
        remote = max(0, min(366, int(body.get("remote_days_per_year", row.get("remote_days_per_year") or 10))))
    except (TypeError, ValueError) as exc:
        raise ApiError(422, "validation_error", "قيمة غير صحيحة") from exc
    db.execute(text("UPDATE public.company_settings SET work_start=:s,tolerance_minutes=:t,remote_days_per_year=:r,updated_at=now() WHERE id='default'"),
               {"s": start, "t": tol, "r": remote})
    c._write_audit(db, actor, request, "settings", "تعديل إعدادات الحضور", "company_settings", "default",
                   summary=f"بداية الدوام {start.strftime('%H:%M')} — هامش التأخير {tol} دقيقة", details={"remote_days_per_year": remote})
    db.commit()
    return {"ok": True}


@router.put("/staff/flexible-hours")
def set_flexible_hours(body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_hr_set_flexible_hours: on/off, the shift hours and the window."""
    pc.require(db, actor, "settings", "edit")
    _company(db)
    try:
        hours = float(body.get("shift_hours") or 8)
        ws = time.fromisoformat(str(body.get("window_start") or "08:00")[:8])
        we = time.fromisoformat(str(body.get("window_end") or "17:00")[:8])
    except (TypeError, ValueError) as exc:
        raise ApiError(422, "validation_error", "قيمة غير صحيحة") from exc
    if not (1 <= hours <= 16) or we <= ws:
        raise ApiError(422, "validation_error", "عدد الساعات أو نافذة الدوام غير صحيحة")
    enabled = bool(body.get("enabled"))
    db.execute(text("""UPDATE public.company_settings SET flexible_enabled=:e,shift_duration_minutes=:d,flex_window_start=:ws,flex_window_end=:we,updated_at=now()
        WHERE id='default'"""), {"e": enabled, "d": round(hours * 60), "ws": ws, "we": we})
    c._write_audit(db, actor, request, "settings", "تعديل الدوام المرن", "company_settings", "default",
                   summary=("تفعيل" if enabled else "إيقاف") + f" الدوام المرن — {hours:g} ساعة")
    db.commit()
    return {"ok": True}
