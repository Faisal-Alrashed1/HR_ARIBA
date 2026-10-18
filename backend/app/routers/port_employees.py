"""Employees in their record shape (ariba_staff_employees / ariba_sync_employee / ariba_hr_delete_employee): the ported
screens read and save the stored employee record; the server recomputes the figures and keeps the normalized columns."""
from __future__ import annotations

import base64
import json
from typing import Any

from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.database import get_db
from app.routers import canonical as c
from app.services import employees_port as ep
from app.services import port_audit as pa
from app.services import port_common as pc

router = APIRouter()
SALARY_KEYS = ("salary", "housingAllowance", "transportAllowance", "projectAllowance", "otherAllowance", "extraAllowance", "otherDeductions",
               "salaryTotal", "insuranceSub", "insuranceComp", "netSalary", "netSalaryLocal", "netSalarySAR", "taxDeduct", "iban", "bank")


@router.get("/staff/employees")
def staff_employees(actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_staff_employees: every employee record (data + the normalized columns). Salary fields only for the payroll
    permission (their module 'payroll')."""
    pc.require(db, actor, "staff|employees")
    see_pay = pc.can(db, actor, "payroll")
    rows = c._rows(db, f"SELECT {c._EMPLOYEE_COLUMNS} FROM {c._EMPLOYEE_FROM} ORDER BY d.employee_id")
    out = []
    for r in rows:
        data = dict(r.get("data") or {})
        if not see_pay:
            for k in SALARY_KEYS:
                data.pop(k, None)
        out.append({"id": r["employee_id"], "employee_id": r["employee_id"], "emp_no": data.get("empNo") or r["employee_id"], "username": r.get("username"),
                    "name_ar": r["name_ar"], "name_en": r.get("name_en"), "employer": r.get("employer"), "department": r.get("department"),
                    "job_title": r.get("job_title"), "nationality": r.get("nationality"), "iqama_no": r.get("iqama_no"), "dob": r.get("dob"),
                    "join_date": r.get("join_date"), "manager_id": r.get("manager_id"), "active": r["active"], "data": data,
                    "updated_at": r.get("updated_at")})
    return {"employees": out}


@router.put("/staff/employees/{employee_id}")
def sync_employee(employee_id: str, body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_sync_employee: insert or update one record from their employee form / import."""
    pc.require(db, actor, "employees", "edit")
    emp = body.get("employee") if isinstance(body.get("employee"), dict) else body
    if str(emp.get("id") or employee_id) != employee_id:
        raise ApiError(422, "validation_error", "رقم الموظف لا يطابق")
    norm = lambda v: str(v or "").strip().lower()  # noqa: E731
    others = [x for x in ep.legacy_employees(db) if str(x["id"]) != employee_id]
    if any(norm(x.get("empNo") or x.get("id")) == norm(emp.get("empNo") or employee_id) for x in others):
        raise ApiError(409, "DUPLICATE", "يوجد موظف مسجل بنفس الرقم الوظيفي")
    for key, label in (("email", "البريد الإلكتروني"), ("iqamaNo", "رقم الهوية/الإقامة")):
        if norm(emp.get(key)) and any(norm(x.get(key)) == norm(emp.get(key)) for x in others):
            raise ApiError(409, "DUPLICATE", f"يوجد موظف مسجل بنفس {label}")
    if not pc.can(db, actor, "payroll", "edit"):
        old = c._row(db, "SELECT data FROM public.employee_directory WHERE employee_id=:e", e=employee_id)
        for k in SALARY_KEYS:  # without payroll rights the salary fields keep their stored values
            if old and k in (old["data"] or {}):
                emp[k] = old["data"][k]
    out = ep.save_employee(db, {**emp, "id": employee_id}, actor)
    action, summary, details = pa.employee_changes(out["old"], out["data"])
    if action:  # their logEmployeeSave: one entry with the changed fields, nothing when nothing changed
        c._write_audit(db, actor, request, "employees", action, "employee", employee_id, summary=pa.trim(summary, 580), details=details,
                       entity_name=pa.short_name(out["data"], employee_id))
    db.commit()
    return {"ok": True, "id": employee_id, "employee": out["data"]}


_EMP_TABLES = [  # (table, column) holding rows of one employee, child tables first
    ("ariba_leave_files", "employee_id"), ("ariba_targets", "employee_id"), ("ariba_evaluations", "employee_id"), ("ariba_delegations", "employee_id"),
    ("ariba_doc_signing", "employee_id"), ("attendance", "employee_id"), ("permissions", "employee_id"), ("leave_requests", "employee_id"),
    ("employee_payrolls", "employee_id"), ("ariba_documents", "employee_id"), ("workflow_notifications", "recipient_employee_id"),
]


@router.delete("/employees/{employee_id}")
def delete_employee(employee_id: str, request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_hr_delete_employee: the record and everything that belongs to it go to the deleted-items archive (one
    snapshot, files included), then are removed. Refused for a configured approver."""
    pc.require(db, actor, "employees_admin", "edit")
    row = c._row(db, "SELECT * FROM public.employee_directory WHERE employee_id=:e", e=employee_id)
    if not row:
        raise ApiError(404, "not_found", "الموظف غير موجود")
    if c._row(db, "SELECT 1 AS x FROM public.workflow_approvers WHERE employee_id=:e", e=employee_id):
        raise ApiError(409, "IS_APPROVER", "الموظف معتمد في سير الطلبات — غيّر المعتمد أولاً")
    snap: dict[str, Any] = {"employee": row}
    reqs = [r["id"] for r in c._rows(db, "SELECT id FROM public.workflow_requests WHERE employee_id=:e", e=employee_id)]
    for t, col in _EMP_TABLES:
        snap[t] = c._rows(db, f"SELECT * FROM public.{t} WHERE {col}=:e", e=employee_id)
    snap["workflow_requests"] = c._rows(db, "SELECT * FROM public.workflow_requests WHERE employee_id=:e", e=employee_id)
    snap["accounts"] = c._rows(db, "SELECT id,username,role,active FROM public.ariba_auth_accounts WHERE employee_id=:e", e=employee_id)
    for d in snap["ariba_documents"]:
        d["file_data"] = base64.b64encode(bytes(d["file_data"])).decode()
    for f in snap["ariba_leave_files"]:
        f["file_data"] = base64.b64encode(bytes(f["file_data"])).decode()
    db.execute(text("INSERT INTO public.ariba_deleted_items(kind,ref_id,employee_id,snapshot,deleted_by,deleted_by_role) VALUES('employee',:e,:e,CAST(:s AS jsonb),:by,:role)"),
               {"e": employee_id, "s": json.dumps(snap, default=str, ensure_ascii=False), "by": actor.get("employee_id") or actor.get("username"), "role": actor.get("role")})
    for rid in reqs:
        c._delete_request_rows(db, rid)
    for t, col in _EMP_TABLES:
        db.execute(text(f"DELETE FROM public.{t} WHERE {col}=:e"), {"e": employee_id})
    db.execute(text("DELETE FROM public.ariba_tasks WHERE assignee_id=:e OR created_by=:e"), {"e": employee_id})
    db.execute(text("UPDATE public.employee_directory SET manager_id=NULL WHERE manager_id=:e"), {"e": employee_id})
    db.execute(text("DELETE FROM public.ariba_sessions WHERE account_id IN (SELECT id FROM public.ariba_auth_accounts WHERE employee_id=:e)"), {"e": employee_id})
    db.execute(text("UPDATE public.ariba_auth_accounts SET active=false,employee_id=NULL WHERE employee_id=:e"), {"e": employee_id})
    db.execute(text("DELETE FROM public.employee_directory WHERE employee_id=:e"), {"e": employee_id})
    c._write_audit(db, actor, request, "employees", "delete", "employee", employee_id, summary=f"حذف الموظف {row['name_ar']} (محفوظ في الأرشيف)")
    db.commit()
    return {"ok": True}
