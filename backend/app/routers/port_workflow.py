"""Request workflow of their sql/10 (docs/PORT_PLAN.md section 9): the new request types (unpaid leave, salary advance,
IBAN change, profile edit, document upload) with attachments, submitting on behalf of a team member, HR rejection
with a reason and return to the manager, escalation after the configured wait, the workflow settings, the direct
manager's permissions and the employee's delegation. The approval steps themselves stay in canonical.py (_advance,
_override), which read the stages from port_common.stages_for."""
from __future__ import annotations

import base64
import binascii
import json
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.core.scheduling import today_riyadh
from app.database import get_db
from app.routers import canonical as c
from app.services import canonical_data as cdata
from app.services import employees_port as ep
from app.services import port_common as pc

router = APIRouter()

MAX_ATTACHMENT = 12 * 1024 * 1024
PROFILE_FIELDS = {"mobile", "email", "address", "city", "nameEn", "emergencyName", "emergencyPhone", "nationalAddress", "maritalStatus"}
NEW_TYPES = {"unpaid", "salary_advance", "iban_change", "profile_edit", "document"}
DOC_TYPE_CODES = {"id", "passport", "experience", "cv", "national_address", "contract", "graduation", "social_insurance", "other"}


def _bad(msg: str, code: str = "invalid_request") -> ApiError:
    return ApiError(422, code, msg)


def _attachment(body: dict[str, Any]) -> dict[str, Any] | None:
    """Their p_attachment_name / _mime / _base64 (or attachment: {name, mime, data})."""
    a = body.get("attachment") if isinstance(body.get("attachment"), dict) else None
    name = (a or {}).get("name") or body.get("attachment_name")
    data = (a or {}).get("data") or (a or {}).get("base64") or body.get("attachment_base64")
    if not name or not data:
        return None
    try:
        raw = base64.b64decode(str(data).split(",")[-1], validate=True)
    except (binascii.Error, ValueError) as exc:
        raise _bad("المرفق غير صالح") from exc
    if len(raw) > MAX_ATTACHMENT:
        raise _bad("حجم المرفق يتجاوز 12 MB")
    return {"name": str(name)[:200], "mime": str((a or {}).get("mime") or body.get("attachment_mime") or "application/octet-stream")[:100], "data": raw}


def _save_doc(db: Session, employee_id: str, request_id: Any, doc_type: str, name: str, mime: str, data: bytes, by: str | None) -> Any:
    db.execute(text("INSERT INTO public.document_types(code,name_ar) VALUES(:c,:c) ON CONFLICT(code) DO NOTHING"), {"c": doc_type})
    return db.execute(text("""INSERT INTO public.ariba_documents(employee_id,request_id,document_type,file_name,mime_type,file_data,uploaded_by)
        VALUES(:e,:r,:t,:n,:m,:d,:by) RETURNING id"""), {"e": employee_id, "r": request_id, "t": doc_type, "n": name, "m": mime, "d": data, "by": by}).scalar()


def create_request(db: Session, actor: dict[str, Any], eid: str, emp: dict[str, Any], body: dict[str, Any], *, on_behalf: dict[str, Any] | None = None) -> dict[str, Any]:
    """ariba_submit_request (sql/10) / ariba_submit_request_for. Validates the type's fields, stores the request with
    its leave/permission row and attachment, and notifies the first stage (+ HR of every new request)."""
    t = str(body.get("type") or "")
    c._require_lookup(db, "workflow_request_types", t, "request type")
    p_in = body.get("payload") if isinstance(body.get("payload"), dict) else {}
    get = lambda k, *alt: next((v for v in (body.get(k), *(body.get(a) for a in alt), p_in.get(k), *(p_in.get(a) for a in alt)) if v not in (None, "")), None)  # noqa: E731
    notes = str(get("notes") or "").strip()
    today = today_riyadh()
    payload: dict[str, Any] = {"notes": notes}
    att = _attachment(body)
    if t in c.LEAVE_TYPES or t in {"mission", "unpaid"}:
        c._require_lookup(db, "leave_types", t, "leave type")
        f, to = cdata._d(get("from_date", "from")), cdata._d(get("to_date", "to"))
        if not f or not to or to < f:
            raise _bad("حدد الفترة بشكل صحيح")
        if t == "unpaid" and not notes:
            raise _bad("اكتب سبب الإجازة بدون راتب")
        emps = cdata.employees(db, employee_id=eid)
        book = cdata.leave_book(db, today, emps)
        days = book.count_workdays(f, to) if t == "annual" else (to - f).days + 1  # unpaid: calendar days (sql/10)
        if t == "annual" and days > book.current(emps[0]):
            raise ApiError(422, "exceeds_balance", "يتجاوز الرصيد المتاح")
        payload.update({"from": f.isoformat(), "to": to.isoformat(), "days": days})
    elif t in c.HOURLY_TYPES:
        c._require_lookup(db, "permission_types", t, "permission type")
        d, tm = cdata._d(get("on_date", "date")), get("time_from", "time")
        if not d or not tm:
            raise _bad("حدد التاريخ والوقت")
        payload.update({"date": d.isoformat(), "time": str(tm)[:5], "dur": float(get("hours", "dur") or 1)})
    elif t in {"advance", "salary_advance"}:
        try:
            amount = float(get("amount") or 0)
        except (TypeError, ValueError):
            amount = 0
        if amount <= 0:
            raise _bad("أدخل مبلغ السلفة")
        if t == "salary_advance":
            if not notes:
                raise _bad("اكتب سبب طلب الراتب المقدم")
            data = emp.get("data") or {}
            total = float(data.get("salaryTotal") or 0) or sum(float(data.get(k) or 0) for k in ("salary", "housingAllowance", "transportAllowance", "projectAllowance", "otherAllowance"))
            cap = round(total * float(pc.wf_config(db)["advance_max_percent"] or 100) / 100, 2)
            if cap and amount > cap:
                raise ApiError(422, "ADVANCE_OVER_LIMIT", f"المبلغ يتجاوز الحد المسموح ({cap:,.2f})")
            if c._row(db, "SELECT 1 AS x FROM public.workflow_requests WHERE employee_id=:e AND request_type='salary_advance' AND status='pending'", e=eid):
                raise ApiError(409, "ADVANCE_PENDING", "لديك طلب راتب مقدم قيد المراجعة")
        payload["amount"] = amount
    elif t == "overtime":
        d = cdata._d(get("on_date", "date"))
        hours = float(get("hours") or 0)
        if not d or hours < 0.5:
            raise _bad("حدد التاريخ والساعات (0.5 على الأقل)")
        payload.update({"date": d.isoformat(), "hours": hours})
    elif t == "forgot_punch":
        kind = get("punch_kind", "kind")
        d = cdata._d(get("on_date", "date"))
        t1, t2 = get("time_from", "time"), get("time_to", "time2")
        if kind not in {"in", "out", "both"} or not d:
            raise _bad("حدد نوع البصمة والتاريخ")
        if d > today:
            raise _bad("لا يمكن اختيار تاريخ في المستقبل")
        if not t1:
            raise _bad("اختر الوقت")
        if kind == "both" and (not t2 or str(t2)[:5] <= str(t1)[:5]):
            raise _bad("وقت الخروج لازم يكون بعد وقت الدخول")
        if not notes:
            raise _bad("اكتب سبب نسيان البصمة")
        if c._row(db, "SELECT id FROM public.workflow_requests WHERE employee_id=:e AND request_type='forgot_punch' AND status='pending' AND payload->>'date'=:d AND payload->>'kind'=:k", e=eid, d=d.isoformat(), k=kind):
            raise _bad("يوجد طلب نسيان بصمة معلق لنفس اليوم")
        payload.update({"kind": kind, "date": d.isoformat(), "time": str(t1)[:5]})
        if kind == "both":
            payload["time2"] = str(t2)[:5]
    elif t == "iban_change":
        iban = str(get("iban") or "").replace(" ", "").upper()
        bank, account = str(get("bank") or "").strip(), str(get("account_no") or "").strip()
        if not bank or not account:
            raise _bad("اكتب اسم البنك ورقم الحساب")
        import re
        if not re.match(r"^[A-Z]{2}[0-9A-Z]{13,32}$", iban):
            raise _bad("رقم الآيبان غير صحيح")
        if not att:
            raise _bad("أرفق شهادة الآيبان")
        letter = str(get("letter_html") or "")
        if len(letter.encode()) > 400 * 1024:
            raise _bad("الخطاب أكبر من الحد المسموح")
        if c._row(db, "SELECT 1 AS x FROM public.workflow_requests WHERE employee_id=:e AND request_type='iban_change' AND status='pending'", e=eid):
            raise ApiError(409, "IBAN_PENDING", "لديك طلب تغيير آيبان قيد المراجعة بالفعل")
        payload.update({"iban": iban, "bank": bank, "account_no": account, "letter_html": letter})
    elif t == "profile_edit":
        changes = get("changes")
        changes = {k: str(v).strip()[:300] for k, v in (changes or {}).items() if k in PROFILE_FIELDS and str(v or "").strip()} if isinstance(changes, dict) else {}
        if not changes:
            raise _bad("لم تغيّر أي بيان")
        payload["changes"] = changes
    elif t == "document":
        doc_type = str(get("doc_type") or "other")
        if doc_type not in DOC_TYPE_CODES:
            raise _bad("نوع المستند غير صحيح")
        if not att:
            raise _bad("اختر الملف")
        payload.update({"doc_type": doc_type, "doc_label": str(get("doc_label") or doc_type)[:120]})
    else:
        raise _bad("نوع طلب غير مدعوم")
    payload.update({"type": t, "submitted_from": "manager_app" if on_behalf else "employee_app", "submitted_at": datetime.now(UTC).isoformat()})
    if on_behalf:
        payload.update({"submitted_by_manager": on_behalf["employee_id"], "submitted_by_name": on_behalf["name_ar"]})
    manager = emp.get("manager_id") or None
    stages = pc.stages_for(db, t, bool(manager))
    stage = stages[0]
    for configured in stages:
        if configured in {"hr", "ceo"}:
            c._require_stage_approver(db, configured)
    # on behalf: the manager's own submission counts as their approval → straight to HR (their sql/16)
    if on_behalf and stage == "manager":
        stage = stages[1]
    row = c._row(db, """INSERT INTO public.workflow_requests(employee_id,request_type,payload,current_stage,submitted_by_employee_id)
        VALUES(:eid,:type,CAST(:payload AS jsonb),:stage,:by) RETURNING *""",
                 eid=eid, type=t, payload=json.dumps(payload, ensure_ascii=False), stage=stage, by=(on_behalf or {}).get("employee_id"))
    db.execute(text("INSERT INTO public.workflow_actions(request_id,actor_account_id,stage,action,comment) VALUES(:rid,:account,'employee','submitted',:comment)"),
               {"rid": row["id"], "account": actor["account_id"], "comment": (f"قدّمه بالنيابة: {on_behalf['name_ar']}" if on_behalf else None) or notes or None})
    if on_behalf and stages[0] == "manager":
        db.execute(text("INSERT INTO public.workflow_actions(request_id,actor_account_id,stage,action,comment) VALUES(:rid,:account,'manager','approved',:c)"),
                   {"rid": row["id"], "account": actor["account_id"], "c": "قدّمه المدير المباشر بالنيابة عن الموظف"})
    if t in c.LEAVE_TYPES or t in {"mission", "unpaid"}:
        f = cdata._d(payload.get("from"))
        db.execute(text("""INSERT INTO public.leave_requests(employee_id,leave_type,from_date,to_date,days,notes,workflow_request_id)
            VALUES(:eid,:type,:f,:t,:days,:notes,:rid)"""),
                   {"eid": eid, "type": t, "f": f, "t": cdata._d(payload.get("to")) or f, "days": max(1, int(payload.get("days") or 1)), "notes": notes, "rid": row["id"]})
    elif t in c.HOURLY_TYPES:
        db.execute(text("""INSERT INTO public.permissions(employee_id,permission_type,date,time,dur,notes,status,workflow_request_id)
            VALUES(:eid,:type,:date,:time,:dur,:notes,'pending',:rid)"""),
                   {"eid": eid, "type": t, "date": cdata._d(payload.get("date")), "time": payload.get("time"), "dur": payload.get("dur"), "notes": notes, "rid": row["id"]})
    if att:
        doc_type = {"iban_change": "iban_certificate", "document": payload.get("doc_type"), "profile_edit": "employee_upload"}.get(t, "employee_upload")
        _save_doc(db, eid, row["id"], doc_type, att["name"], att["mime"], att["data"], actor.get("username"))
    _notify_new(db, row, emp, stage, on_behalf)
    return row


def _notify_new(db: Session, row: dict[str, Any], emp: dict[str, Any], stage: str, on_behalf: dict[str, Any] | None) -> None:
    """The notifications of their ariba_submit_request (texts as their last known version), + the on-behalf notes."""
    eid, rid, t = row["employee_id"], row["id"], row["request_type"]
    manager = emp.get("manager_id")
    if t == "forgot_punch":
        for h in c._require_stage_approver(db, "hr"):
            pc.notify(db, h, rid, "طلب نسيان بصمة", "يوجد طلب نسيان بصمة بانتظار موافقتك", "hr", "request")
    elif stage == "manager":
        pc.notify(db, manager, rid, "طلب جديد", "يوجد طلب جديد من الموظف بانتظار موافقتك", "manager", "request")
    else:
        c._notify_stage(db, row, stage)
    if stage == "hr" and t != "forgot_punch" and not on_behalf:  # no manager → the employee is told it went to HR
        pc.notify(db, eid, rid, "طلب جديد", "تم إرسال طلبك إلى الموارد البشرية", "hr", "request")
    if stage == "manager":  # every new request reaches HR too (V115 / sql/10)
        for h in c._require_stage_approver(db, "hr"):
            if h not in {eid, manager}:
                pc.notify(db, h, rid, f"طلب جديد من {emp.get('name_ar') or eid}",
                          "الطلب بانتظار المدير المباشر — تقدر تعتمده بالنيابة عنه من طلبات الموظفين", "hr", "request")
    if on_behalf:
        label = TYPE_AR.get(t, t)
        pc.notify(db, eid, rid, "قُدّم طلب بالنيابة عنك", f"قدّم {on_behalf['name_ar']} طلب {label} بالنيابة عنك", "employee", "workflow")
        for h in c._require_stage_approver(db, "hr"):
            pc.notify(db, h, rid, "طلب مقدّم بالنيابة", f"قدّمه {on_behalf['name_ar']} بالنيابة عن {emp.get('name_ar') or eid}", "hr", "request")


TYPE_AR = {"annual": "إجازة سنوية", "sick": "إجازة مرضية", "unpaid": "إجازة بدون راتب", "salary_advance": "راتب مقدم", "iban_change": "تغيير الآيبان",
           "profile_edit": "تعديل بيانات", "document": "رفع مستند", "overtime": "عمل إضافي", "forgot_punch": "نسيان بصمة", "advance": "سلفة",
           "remote": "عمل عن بعد", "emergency": "إجازة اضطرارية"}


def apply_completed(db: Session, item: dict[str, Any]) -> None:
    """Effects of an approved request (sql/10): IBAN change → the employee's iban/bank/accountNo + the signed letter kept
    as a document; profile edit → the allowed fields."""
    t, p, eid = item["request_type"], item.get("payload") or {}, item["employee_id"]
    row = c._row(db, "SELECT data FROM public.employee_directory WHERE employee_id=:e", e=eid)
    if not row:
        return
    data = dict(row["data"] or {})
    if t == "iban_change":
        data.update({"iban": p.get("iban"), "bank": p.get("bank"), "accountNo": p.get("account_no")})
        if p.get("letter_html"):
            _save_doc(db, eid, item["id"], "iban_letter", "خطاب تغيير الآيبان.html", "text/html", str(p["letter_html"]).encode(), "workflow")
    elif t == "profile_edit":
        changes = {k: v for k, v in (p.get("changes") or {}).items() if k in PROFILE_FIELDS}
        data.update(changes)
        if "nameEn" in changes:
            db.execute(text("UPDATE public.employee_directory SET name_en=:n WHERE employee_id=:e"), {"n": changes["nameEn"], "e": eid})
    else:
        return
    db.execute(text("UPDATE public.employee_directory SET data=CAST(:d AS jsonb),updated_at=now() WHERE employee_id=:e"),
               {"d": json.dumps(data, ensure_ascii=False), "e": eid})


def _request_out(db: Session, row: dict[str, Any]) -> dict[str, Any]:
    """The raw request their screens read (request_type, payload, current_stage, status, reject_reason) + our fields."""
    out = c._workflow_out(db, row)
    payload = dict(row.get("payload") or {})
    payload.pop("letter_html", None)
    out.update({"request_type": row["request_type"], "payload": payload, "current_stage": row["current_stage"],
                "reject_reason": out.get("rejection_reason"), "submitted_by_employee_id": row.get("submitted_by_employee_id"),
                "escalated_from": row.get("escalated_from"), "returned_at": row.get("returned_at"), "return_note": row.get("return_note"),
                "updated_at": row.get("updated_at")})
    return out


# ---------------------------------------------------------------- employee: submit, delegation
@router.get("/me/delegation")
def my_delegation(actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_my_delegation: my direct manager and whether I delegated him."""
    eid = actor.get("employee_id")
    emp = c._row(db, "SELECT manager_id FROM public.employee_directory WHERE employee_id=:e", e=eid) or {}
    mid = emp.get("manager_id")
    if not mid:
        return {"manager_id": None, "active": False}
    mgr = c._row(db, "SELECT name_ar FROM public.employee_directory WHERE employee_id=:m", m=mid) or {}
    d = c._row(db, "SELECT active FROM public.ariba_delegations WHERE employee_id=:e AND manager_id=:m", e=eid, m=mid)
    return {"manager_id": mid, "manager_name": mgr.get("name_ar"), "active": bool((d or {}).get("active"))}


@router.put("/me/delegation")
def set_delegation(body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    eid = actor.get("employee_id")
    emp = c._row(db, "SELECT manager_id FROM public.employee_directory WHERE employee_id=:e", e=eid) or {}
    if not emp.get("manager_id"):
        raise ApiError(409, "NO_MANAGER", "لا يوجد مدير مباشر")
    active = bool(body.get("active"))
    db.execute(text("""INSERT INTO public.ariba_delegations(employee_id,manager_id,active,updated_at) VALUES(:e,:m,:a,now())
        ON CONFLICT(employee_id) DO UPDATE SET manager_id=EXCLUDED.manager_id,active=EXCLUDED.active,updated_at=now()"""),
               {"e": eid, "m": emp["manager_id"], "a": active})
    pc.notify(db, emp["manager_id"], None, "تفويض من موظف" if active else "إلغاء تفويض",
              f"{actor.get('name_ar')} {'فوّضك بتقديم طلباته بالنيابة عنه' if active else 'ألغى تفويضك'}", "manager", "info")
    c._write_audit(db, actor, request, "workflow", "delegation", "employee", eid, details={"active": active})
    db.commit()
    return {"active": active}


# ---------------------------------------------------------------- direct manager: perms, team, requests, on behalf
@router.get("/me/manager-perms")
def my_manager_perms(actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_mgr_my_perms: whether I manage anyone and what HR lets me do."""
    me = actor.get("employee_id")
    team = pc.team_ids(db, me)
    return {"is_manager": bool(team), "team_count": len(team), "perms": pc.manager_perms(db, me) if team else {k: False for k in pc.MGR_PERM_KEYS}}


@router.get("/me/team")
def my_team(actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_mgr_team (+ the team's leave balances computed here, decision 4 — no snapshots): each member with only the
    fields the manager's permissions allow (GET /me/manager-perms says which)."""
    me = actor.get("employee_id")
    ids = pc.team_ids(db, me)
    perms = pc.manager_perms(db, me)
    if not ids or not perms["view_team"]:
        return []
    rows = c._rows(db, f"SELECT {c._EMPLOYEE_COLUMNS} FROM {c._EMPLOYEE_FROM} WHERE d.employee_id = ANY(:ids) ORDER BY d.name_ar", ids=ids)
    book = None
    if perms["view_team_leaves"]:
        emps = [e for i in ids for e in cdata.employees(db, employee_id=i)]
        book = cdata.leave_book(db, today_riyadh(), emps)
        books = {e.id: e for e in emps}
    out = []
    for r in rows:
        e = c._employee_dict(r)
        d = e["data"]
        m: dict[str, Any] = {"id": e["employee_id"], "emp_no": e["emp_no"], "name_ar": e["name_ar"], "name_en": e["name_en"], "job_title": e["job_title"],
                             "department": e["department"]}
        if perms["view_team_data"]:
            m.update({"employer": e["employer"], "join_date": e["join_date"], "nationality": e["nationality"], "mobile": d.get("mobile"), "email": d.get("email")})
        if perms["view_team_salary"]:
            m.update({"salary_total": d.get("salaryTotal"), "net_salary": d.get("netSalary")})
        if book is not None and e["employee_id"] in books:
            s = book.summary(books[e["employee_id"]])
            m.update({"leave_balance": s["current"], "leave_year_end": s["year_end"]})
        out.append(m)
    return out


@router.get("/me/team/requests")
def my_team_requests(actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_mgr_team_requests: my team's requests and their state (view_team_requests)."""
    me = actor.get("employee_id")
    if not pc.manager_perms(db, me)["view_team_requests"]:
        raise ApiError(403, "NOT_AUTHORIZED", "ليست لديك صلاحية رؤية طلبات الفريق")
    ids = pc.team_ids(db, me)
    rows = c._rows(db, "SELECT * FROM public.workflow_requests WHERE employee_id = ANY(:ids) AND request_type NOT LIKE 'template:%' ORDER BY created_at DESC LIMIT 300", ids=ids)
    return [_request_out(db, r) for r in rows]


@router.post("/me/team/{employee_id}/requests", status_code=201)
def submit_for(employee_id: str, body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_submit_request_for: the direct manager submits for a team member who delegated him (submit_for_team)."""
    me = actor.get("employee_id")
    pc.require_manager_perm(db, actor, employee_id, "submit_for_team")
    d = c._row(db, "SELECT active FROM public.ariba_delegations WHERE employee_id=:e AND manager_id=:m", e=employee_id, m=me)
    if not (d and d["active"]):
        raise ApiError(403, "NOT_DELEGATED", "الموظف لم يفعّل تفويضك لتقديم الطلبات بالنيابة عنه")
    emp = c._row(db, f"SELECT {c._EMPLOYEE_COLUMNS} FROM {c._EMPLOYEE_FROM} WHERE d.employee_id=:e", e=employee_id)
    mgr = c._row(db, "SELECT employee_id,name_ar FROM public.employee_directory WHERE employee_id=:m", m=me)
    row = create_request(db, actor, employee_id, emp, body, on_behalf=mgr)
    c._write_audit(db, actor, request, "workflow", "submit_for", "workflow_request", row["id"], details={"type": row["request_type"], "employee_id": employee_id})
    db.commit()
    return _request_out(db, row)


# ---------------------------------------------------------------- HR: lists, return, reject, escalation
@router.get("/staff/requests")
def staff_requests(actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_staff_requests: every request (their AllRequests)."""
    pc.require(db, actor, "requests|leaves")
    rows = c._rows(db, "SELECT * FROM public.workflow_requests WHERE request_type NOT LIKE 'template:%' ORDER BY created_at DESC LIMIT 2000")
    return {"requests": _items(db, rows)}


def _items(db: Session, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Their queue/requests item: {request, employee (record shape), attachments}."""
    if not rows:
        return []
    emps = {e["id"]: e for e in ep.legacy_employees(db)}
    docs: dict[str, list[dict[str, Any]]] = {}
    for d in c._rows(db, """SELECT id,request_id,document_type,file_name,mime_type,file_size,created_at FROM public.ariba_documents
            WHERE request_id = ANY(:ids) ORDER BY created_at""", ids=[r["id"] for r in rows]):
        docs.setdefault(str(d["request_id"]), []).append({**d, "id": str(d["id"]), "request_id": str(d["request_id"])})
    out = []
    for r in rows:
        req = _request_out(db, r)
        req["manager_id"] = (emps.get(r["employee_id"]) or {}).get("managerId") or None
        out.append({"request": req, "employee": emps.get(r["employee_id"]) or {}, "attachments": docs.get(str(r["id"]), [])})
    return out


@router.get("/staff/queue")
def staff_queue(actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_staff_queue: the pending requests (dashboard counter, Pending tab), with the stage they wait at."""
    if not (pc.can(db, actor, "requests|leaves") or actor.get("role") in {"manager", "ceo"}):
        return {"queue": []}
    rows = c._rows(db, "SELECT * FROM public.workflow_requests WHERE status='pending' AND request_type NOT LIKE 'template:%' ORDER BY created_at")
    if not pc.can(db, actor, "requests|leaves"):
        rows = [r for r in rows if c._can_act(db, actor, r)]
    return {"queue": _items(db, rows)}


@router.post("/requests/{request_id}/return")
def return_to_manager(request_id: str, body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_hr_return_to_manager: HR sends a pending request back to the direct manager with a note."""
    pc.require(db, actor, "requests", "edit")
    item = c._row(db, "SELECT * FROM public.workflow_requests WHERE id=:id", id=request_id)
    if not item or item["status"] != "pending":
        raise ApiError(404, "not_found", "Pending request not found")
    mgr = (c._row(db, "SELECT manager_id FROM public.employee_directory WHERE employee_id=:e", e=item["employee_id"]) or {}).get("manager_id")
    if not mgr:
        raise ApiError(409, "NO_MANAGER", "لا يوجد مدير مباشر لهذا الموظف")
    note = str(body.get("note") or "").strip()
    if len(note) < 3:
        raise _bad("اكتب ملاحظة الإرجاع", "NOTE_REQUIRED")
    payload = dict(item.get("payload") or {}, returned=True, return_note=note)
    db.execute(text("""UPDATE public.workflow_requests SET current_stage='manager',returned_at=now(),return_note=:n,escalated_from=NULL,
        payload=CAST(:p AS jsonb),updated_at=now() WHERE id=:id"""), {"n": note, "p": json.dumps(payload, ensure_ascii=False, default=str), "id": request_id})
    db.execute(text("INSERT INTO public.workflow_actions(request_id,actor_account_id,stage,action,comment) VALUES(:r,:a,:s,'returned',:c)"),
               {"r": request_id, "a": actor["account_id"], "s": item["current_stage"], "c": note})
    pc.notify(db, mgr, item["id"], "طلب أعادته الموارد البشرية إليك", note, "manager", "request")
    pc.notify(db, item["employee_id"], item["id"], "أُعيد طلبك للمدير المباشر", note, "employee", "workflow")
    c._write_audit(db, actor, request, "workflow", "return", "workflow_request", request_id, details={"note": note})
    db.commit()
    return _request_out(db, c._row(db, "SELECT * FROM public.workflow_requests WHERE id=:id", id=request_id))


def run_escalation(db: Session, now: datetime | None = None) -> int:
    """ariba_hr_run_escalation: a request waiting at the direct manager (or the CEO) longer than the configured days
    (from its last update) moves to HR, which approves, rejects with a reason or returns it. 0 days = never."""
    cfg = pc.wf_config(db)
    now = now or datetime.now(UTC)
    moved = 0
    for stage, days in (("manager", int(cfg.get("manager_wait_days") or 0)), ("ceo", int(cfg.get("ceo_wait_days") or 0))):
        if days <= 0:
            continue
        rows = c._rows(db, """SELECT * FROM public.workflow_requests WHERE current_stage=:s AND request_type NOT LIKE 'template:%'
            AND updated_at < :cut""", s=stage, cut=now - timedelta(days=days))
        for r in rows:
            payload = dict(r.get("payload") or {}, escalated_from=stage)
            db.execute(text("""UPDATE public.workflow_requests SET current_stage='hr',escalated_from=:s,escalated_at=now(),
                payload=CAST(:p AS jsonb),updated_at=now() WHERE id=:id"""), {"s": stage, "p": json.dumps(payload, ensure_ascii=False, default=str), "id": r["id"]})
            db.execute(text("INSERT INTO public.workflow_actions(request_id,actor_account_id,stage,action,comment) VALUES(:r,NULL,:s,'escalated',:c)"),
                       {"r": r["id"], "s": stage, "c": f"انتهت مهلة {days} يوم"})
            who = "المدير المباشر" if stage == "manager" else "الرئيس التنفيذي"
            for h in pc.hr_people(db):
                pc.notify(db, h, r["id"], "طلب انتقل إليك لانتهاء المهلة", f"لم يرد {who} خلال {days} يوم — القرار للموارد البشرية", "hr", "request")
            pc.notify(db, r["employee_id"], r["id"], "انتقل طلبك للموارد البشرية", f"لانتهاء مهلة رد {who}", "employee", "workflow")
            moved += 1
    return moved


@router.post("/requests/escalate")
def escalate_now(request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    pc.require(db, actor, "settings|requests", "edit")
    n = run_escalation(db)
    c._write_audit(db, actor, request, "workflow", "escalation", "workflow_request", None, details={"escalated": n})
    db.commit()
    return {"escalated": n}


# ---------------------------------------------------------------- settings: workflow, manager permissions
@router.get("/settings/workflow")
def get_wf(actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    pc.require(db, actor, "settings|requests")
    return {"config": pc.wf_config(db)}


@router.put("/settings/workflow")
def set_wf(body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    pc.require(db, actor, "settings", "edit")
    cfg = pc.wf_config(db)
    try:
        mw, cw, adv = int(body.get("manager_wait_days", cfg["manager_wait_days"])), int(body.get("ceo_wait_days", cfg["ceo_wait_days"])), float(body.get("advance_max_percent", cfg["advance_max_percent"]))
    except (TypeError, ValueError) as exc:
        raise _bad("قيم غير صحيحة") from exc
    emails = [str(x).strip() for x in (body.get("extra_hr_emails") or []) if str(x).strip()]
    from app.services.mailer import is_email
    if not (0 <= mw <= 60 and 0 <= cw <= 60 and 1 <= adv <= 1000) or any(not is_email(x) for x in emails):
        raise _bad("قيم غير صحيحة")
    cfg.update({"manager_wait_days": mw, "ceo_wait_days": cw, "advance_max_percent": adv, "extra_hr_emails": emails})
    pc.set_setting(db, "workflow_config", cfg, actor.get("username"))
    c._write_audit(db, actor, request, "settings", "update", "ariba_app_settings", "workflow_config", details=cfg)
    db.commit()
    return {"config": cfg}


@router.get("/settings/manager-perms")
def list_manager_perms(actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_hr_manager_perms: every direct manager (anyone with an active team member) with his permissions."""
    pc.require(db, actor, "settings|permissions")
    rows = c._rows(db, """SELECT m.employee_id,m.name_ar,jt.name AS job,count(t.employee_id) AS team,p.perms FROM public.employee_directory m
        JOIN public.employee_directory t ON t.manager_id=m.employee_id AND t.active
        LEFT JOIN public.job_titles jt ON jt.id=m.job_title_id LEFT JOIN public.ariba_manager_perms p ON p.manager_id=m.employee_id
        WHERE m.active GROUP BY m.employee_id,m.name_ar,jt.name,p.perms ORDER BY m.name_ar""")
    return {"managers": [{"manager_id": r["employee_id"], "name": r["name_ar"], "job": r["job"], "team": r["team"], "perms": r["perms"] or {}} for r in rows]}


@router.put("/settings/manager-perms/{manager_id}")
def set_manager_perms(manager_id: str, body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    pc.require(db, actor, "settings|permissions", "edit")
    perms = {k: bool((body.get("perms") or body).get(k)) for k in pc.MGR_PERM_KEYS if k in (body.get("perms") or body)}
    db.execute(text("""INSERT INTO public.ariba_manager_perms(manager_id,perms,updated_by,updated_at) VALUES(:m,CAST(:p AS jsonb),:by,now())
        ON CONFLICT(manager_id) DO UPDATE SET perms=EXCLUDED.perms,updated_by=EXCLUDED.updated_by,updated_at=now()"""),
               {"m": manager_id, "p": json.dumps(perms), "by": actor.get("username")})
    c._write_audit(db, actor, request, "permissions", "manager_perms", "employee", manager_id, details=perms)
    db.commit()
    return {"manager_id": manager_id, "perms": pc.manager_perms(db, manager_id)}

