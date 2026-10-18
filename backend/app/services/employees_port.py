"""Employee records as their HR program builds and saves them (lib/employees.js `buildEmployee`, sql `ariba_sync_employee`),
on our normalized employee_directory. The stored figures (salaryTotal, insuranceSub, netSalary…) are recomputed here by
canonical._store_figures, never trusted from the browser."""
from __future__ import annotations

import calendar
import json
import re
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.core.scheduling import today_riyadh

SAUDI = {"سعودي", "سعودية"}


def add_months_safe(date_str: str | None, months: Any) -> str:
    """Their addMonthsSafe: same day `months` later (clamped to the month end) minus one day."""
    if not date_str:
        return ""
    try:
        d = date.fromisoformat(str(date_str)[:10])
        m = int(float(months))
    except (TypeError, ValueError):
        return ""
    if m <= 0:
        return ""
    y, mo = d.year + (d.month - 1 + m) // 12, (d.month - 1 + m) % 12 + 1
    day = min(d.day, calendar.monthrange(y, mo)[1])
    from datetime import timedelta
    return (date(y, mo, day) - timedelta(days=1)).isoformat()


def _days_left(d: str | None, today: date) -> int:
    if not d:
        return 9999
    try:
        return (date.fromisoformat(str(d)[:10]) - today).days
    except ValueError:
        return 9999


def empty_form() -> dict[str, Any]:
    return {"na": "", "ne": "", "empNo": "", "em": "", "nat": "سعودي", "dep": "التشغيل", "jt": "", "dob": "", "mb": "", "ml": "", "photoData": "",
            "bk": "", "ib": "", "sp": "", "rel": "مسلم", "managerId": "", "notes": "", "iq": "", "iqe": "", "pn": "", "ppe": "", "ic": "", "icl": "",
            "icard": "", "ie": "", "contractNature": "fixed", "ct": "", "dur": "", "cj": "", "ce": "", "ldc": 21, "sal": 0, "hou": 0, "tra": 0,
            "prj": 0, "oth": 0, "ded": 0, "extra": 0, "currency": "ريال سعودي", "exchRate": 1, "insSystem": "old", "wpsType": "wps"}


def build_employee(f: dict[str, Any], existing: dict[str, Any] | None, all_emps: list[dict[str, Any]]) -> dict[str, Any]:
    """Their buildEmployee (validation, next number, username EMP###, contract end) → {"error"} or {"emp"}.
    The money figures are filled by the save (canonical._store_figures)."""
    norm = lambda v: str(v or "").strip().lower()  # noqa: E731
    num = lambda v: float(v) if str(v or "").strip() not in ("",) and re.match(r"^-?\d+(\.\d+)?$", str(v).strip()) else 0.0  # noqa: E731
    nature = f.get("contractNature") or "fixed"
    dur = int(num(f.get("dur"))) if nature == "fixed" else 0
    contract_end = add_months_safe(f.get("cj"), dur) if nature == "fixed" else (f.get("ce") or "")
    if nature == "fixed" and (not f.get("cj") or not dur or not contract_end):
        return {"error": "يرجى إدخال تاريخ المباشرة ومدة العقد المحددة."}
    others = [x for x in all_emps if not existing or str(x.get("id")) != str(existing.get("id"))]
    emp_no = str(f.get("empNo") or (existing and (existing.get("empNo") or existing.get("id"))) or "").strip()
    eid = str(existing["id"]) if existing else ""
    if not existing:
        ints = lambda v: int(str(v).strip()) if re.match(r"^\d+$", str(v if v is not None else "").strip()) else 0  # noqa: E731
        eid = str(max([0] + [ints(e.get("id")) for e in all_emps] + [ints(e.get("empNo")) for e in all_emps]) + 1)
        emp_no = emp_no or eid
    if not emp_no:
        return {"error": "الرقم الوظيفي مطلوب"}
    email, iq = norm(f.get("ml")), norm(f.get("iq"))
    if any(norm(x.get("empNo") or x.get("id")) == norm(emp_no) or (email and norm(x.get("email")) == email) or (iq and norm(x.get("iqamaNo")) == iq) for x in others):
        return {"error": "يوجد موظف مسجل بنفس الرقم الوظيفي أو البريد الإلكتروني أو رقم الهوية/الإقامة."}
    username = existing.get("username") if existing else "EMP" + emp_no.zfill(3)
    if not existing and any(str(x.get("username") or "").upper() == username.upper() or str(x.get("id")) == eid for x in all_emps):
        return {"error": f"اسم المستخدم {username} مستخدم لموظف تاني — غيّر الرقم الوظيفي"}
    cur = f.get("currency") or "ريال سعودي"
    exch = num(f.get("exchRate")) if num(f.get("exchRate")) > 0 else (3.755 if cur == "دولار" else 1)
    today = today_riyadh()
    base = existing or {"isTerminated": False, "payMethod": "مدد", "leaveBalance": 21, "yearsOfService": 0, "empType": "دوام كامل",
                        "eosLaborLaw": 0, "gender": "", "createdAt": datetime.now(UTC).isoformat()}
    g = lambda k: num(f.get(k))  # noqa: E731
    emp = {**base, "id": eid, "empNo": emp_no, "username": username, "managerId": f.get("managerId") or "", "nameAr": f.get("na"), "nameEn": f.get("ne"),
           "employer": f.get("em"), "nationality": f.get("nat"), "dept": f.get("dep"), "jobTitle": f.get("jt"), "mobile": f.get("mb"), "email": f.get("ml"),
           "bank": f.get("bk"), "iban": f.get("ib"), "sponsor": f.get("sp"), "religion": f.get("rel"), "notes": f.get("notes"),
           "isSaudi": str(f.get("nat") or "") in SAUDI, "iqamaNo": f.get("iq"), "iqamaExpiry": f.get("iqe"), "iqamaDaysLeft": _days_left(f.get("iqe"), today),
           "passportNo": f.get("pn"), "passportExpiry": f.get("ppe"), "passportDaysLeft": _days_left(f.get("ppe"), today),
           "insuranceCo": f.get("ic"), "insuranceClass": f.get("icl"), "insuranceCard": f.get("icard"), "insuranceExpiry": f.get("ie"),
           "insuranceDaysLeft": _days_left(f.get("ie"), today), "contractNature": nature, "contractType": f.get("ct"), "contractDuration": dur,
           "contractJoin": f.get("cj"), "contractEnd": contract_end, "contractDaysLeft": _days_left(contract_end, today),
           "leaveDaysContract": int(num(f.get("ldc"))) or 21, "salary": g("sal"), "housingAllowance": g("hou"), "transportAllowance": g("tra"),
           "projectAllowance": g("prj"), "otherAllowance": g("oth"), "otherDeductions": g("ded"), "extraAllowance": g("extra"),
           "insSystem": f.get("insSystem") or "old", "wpsType": f.get("wpsType") or "wps", "currency": cur, "exchRate": exch,
           "dob": f.get("dob") or (existing or {}).get("dob") or "", "photoUrl": f.get("photoData") or (existing or {}).get("photoUrl") or "",
           "updatedAt": datetime.now(UTC).isoformat()}
    emp.pop("password", None)
    return {"emp": emp}


def legacy_employees(db: Session) -> list[dict[str, Any]]:
    """Every employee in their record shape (data + id/empNo/username), for numbering and uniqueness checks."""
    rows = db.execute(text("""SELECT d.employee_id,d.active,d.data,a.username FROM public.employee_directory d
        LEFT JOIN public.ariba_auth_accounts a ON a.employee_id=d.employee_id""")).mappings()
    return [{**(r["data"] or {}), "id": r["employee_id"], "username": r["username"] or (r["data"] or {}).get("username"),
             "isTerminated": not r["active"]} for r in rows]


def save_employee(db: Session, emp: dict[str, Any], actor: dict[str, Any]) -> dict[str, Any]:
    """Their ariba_sync_employee: insert or update one record (data JSONB + the normalized columns and lookups); the
    figures are recomputed (canonical._store_figures) and the contract end follows addMonthsSafe."""
    from app.routers import canonical as c
    eid = str(emp.get("id") or emp.get("employee_id") or "").strip()
    if not eid or not str(emp.get("nameAr") or emp.get("name_ar") or "").strip():
        raise ApiError(422, "validation_error", "رقم الموظف والاسم مطلوبان")
    old = c._row(db, f"SELECT {c._EMPLOYEE_COLUMNS} FROM {c._EMPLOYEE_FROM} WHERE d.employee_id=:e", e=eid)
    keep = {k: v for k, v in emp.items() if k not in ("password", "username", "employee_id", "employeeId", "name_ar", "name_en", "department",
                                                      "job_title", "iqama_no", "join_date", "manager_id", "active")}
    data = {**((old or {}).get("data") or {}), **keep, "id": eid, "empNo": str(emp.get("empNo") or eid)}
    data["isTerminated"] = bool(emp.get("isTerminated"))
    top = {"name_ar": data.get("nameAr"), "name_en": data.get("nameEn"), "employer": data.get("employer"), "department": data.get("dept") or data.get("department"),
           "job_title": data.get("jobTitle"), "nationality": data.get("nationality"), "iqama_no": data.get("iqamaNo") or None,
           "dob": data.get("dob") or None, "join_date": data.get("contractJoin") or None, "manager_id": data.get("managerId") or None}
    if top["manager_id"]:
        c._validate_manager(db, eid, top["manager_id"])
    c._contract_end(data)
    c._store_figures(db, data, top, old)
    photo = str(data.get("photoUrl") or "")
    if photo.startswith("data:image/"):  # their form sends the resized photo as a data URL; it is kept as the photo document
        import base64
        head, _, b64 = photo.partition(",")
        db.execute(text("DELETE FROM public.ariba_documents WHERE employee_id=:e AND document_type='photo'"), {"e": eid})
        pending_photo = (head[5:].split(";")[0], base64.b64decode(b64))
        data["photoUrl"] = f"/api/v1/employees/{eid}/photo"
    else:
        pending_photo = None
    active = not data.get("isTerminated")
    lookup = {"employer_id": c._lookup_id(db, "employers", top["employer"]), "department_id": c._lookup_id(db, "departments", top["department"]),
              "job_title_id": c._lookup_id(db, "job_titles", top["job_title"])}
    params = {**{k: v for k, v in top.items() if k not in ("employer", "department", "job_title")}, **lookup, "id": eid, "active": active,
              "data": json.dumps(data, ensure_ascii=False, default=str)}
    db.execute(text("""INSERT INTO public.employee_directory
        (employee_id,name_ar,name_en,employer_id,department_id,job_title_id,nationality,iqama_no,dob,join_date,manager_id,active,data)
        VALUES (:id,:name_ar,:name_en,:employer_id,:department_id,:job_title_id,:nationality,:iqama_no,:dob,:join_date,:manager_id,:active,CAST(:data AS jsonb))
        ON CONFLICT (employee_id) DO UPDATE SET name_ar=EXCLUDED.name_ar,name_en=EXCLUDED.name_en,employer_id=EXCLUDED.employer_id,
          department_id=EXCLUDED.department_id,job_title_id=EXCLUDED.job_title_id,nationality=EXCLUDED.nationality,iqama_no=EXCLUDED.iqama_no,
          dob=EXCLUDED.dob,join_date=EXCLUDED.join_date,manager_id=EXCLUDED.manager_id,active=EXCLUDED.active,data=EXCLUDED.data,updated_at=now()"""), params)
    if pending_photo:
        db.execute(text("""INSERT INTO public.ariba_documents(employee_id,document_type,file_name,mime_type,file_data,uploaded_by)
            VALUES(:e,'photo','photo',:m,:d,:by)"""), {"e": eid, "m": pending_photo[0], "d": pending_photo[1], "by": actor.get("username")})
    return {"id": eid, "created": old is None, "data": data, "old": (old or {}).get("data") or None}
