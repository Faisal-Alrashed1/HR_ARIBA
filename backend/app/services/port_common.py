"""Shared rules of the features ported from the React system (docs/PORT_PLAN.md section 2).

- Permissions: their `ariba_can(role, modules, need)` over ariba_role_perms (admin and chairman always full).
- Workflow configuration (sql/10 `ariba_hr_get_wf_config`): manager/CEO wait days, salary-advance cap, extra HR
  e-mails, the final approver per request type.
- Direct-manager permissions (sql/10 `ariba_mgr_perm`): approve_requests, manage_targets and evaluate_team default on.
- Notifications: one row per recipient (workflow_notifications); the scheduler e-mails them (emailed_at) and the app
  receives a push when the recipient has a device registered.
"""
from __future__ import annotations

import json
import logging
import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.errors import ApiError

log = logging.getLogger(__name__)

# ---------------------------------------------------------------- permissions (their PermsCard / ariba_can)
MODULES = ["staff", "employees", "employees_admin", "attachments", "attendance", "locations", "leaves", "requests",
           "payroll", "payroll_prepare", "payroll_approve", "settlement", "documents", "forms", "reports", "settings",
           "permissions", "audit", "assets"]
ROLES = ["employee", "hr", "admin_manager", "finance", "ceo", "chairman", "admin"]
FULL_ROLES = {"admin", "chairman"}
LEVEL = {"none": 0, "view": 1, "edit": 2}


def role_level(db: Session, role: str | None, module: str) -> str:
    if role in FULL_ROLES:
        return "edit"
    row = db.execute(text("SELECT level FROM public.ariba_role_perms WHERE role=:r AND module=:m"), {"r": role, "m": module}).first()
    return row[0] if row else "none"


def can(db: Session, actor: dict[str, Any], modules: str, need: str = "view") -> bool:
    """`modules` may list alternatives separated by '|' (as ariba_can)."""
    want = LEVEL.get(need, 1)
    return any(LEVEL.get(role_level(db, actor.get("role"), m), 0) >= want for m in modules.split("|"))


def require(db: Session, actor: dict[str, Any], modules: str, need: str = "view") -> None:
    if not can(db, actor, modules, need):
        raise ApiError(403, "NOT_AUTHORIZED", "ليست لديك صلاحية")


def perms_of(db: Session, role: str | None) -> dict[str, str]:
    return {m: role_level(db, role, m) for m in MODULES}


# ---------------------------------------------------------------- key/value settings
def get_setting(db: Session, key: str) -> Any:
    row = db.execute(text("SELECT value FROM public.ariba_app_settings WHERE key=:k ORDER BY updated_at DESC LIMIT 1"), {"k": key}).first()
    return row[0] if row else None


def set_setting(db: Session, key: str, value: Any, by: str | None) -> None:
    params = {"k": key, "v": json.dumps(value, ensure_ascii=False), "by": by}
    done = db.execute(text("UPDATE public.ariba_app_settings SET value=CAST(:v AS jsonb),updated_at=now(),updated_by=:by WHERE key=:k"), params)
    if not done.rowcount:
        db.execute(text("INSERT INTO public.ariba_app_settings(key,value,updated_at,updated_by) VALUES(:k,CAST(:v AS jsonb),now(),:by)"), params)


def get_flag(db: Session, key: str) -> str | None:
    row = db.execute(text("SELECT value FROM public.ariba_security_flags WHERE key=:k ORDER BY updated_at DESC LIMIT 1"), {"k": key}).first()
    return row[0] if row else None


def set_flag(db: Session, key: str, value: str, by: str | None) -> None:
    params = {"k": key, "v": value, "by": by}
    done = db.execute(text("UPDATE public.ariba_security_flags SET value=:v,updated_at=now(),updated_by=:by WHERE key=:k"), params)
    if not done.rowcount:
        db.execute(text("INSERT INTO public.ariba_security_flags(key,value,updated_at,updated_by) VALUES(:k,:v,now(),:by)"), params)


# ---------------------------------------------------------------- workflow configuration (sql/10)
WF_DEFAULT = {"manager_wait_days": 3, "ceo_wait_days": 3, "advance_max_percent": 100, "extra_hr_emails": [],
              "final_by_type": {"unpaid": "hr", "salary_advance": "hr", "iban_change": "hr", "profile_edit": "hr", "document": "hr"}}
# Requests that go straight to HR (no direct manager): forgot punch, profile edit, document upload.
HR_DIRECT = {"forgot_punch", "profile_edit", "document"}


def wf_config(db: Session) -> dict[str, Any]:
    v = get_setting(db, "workflow_config")
    v = v if isinstance(v, dict) else {}
    out = {**WF_DEFAULT, **v}
    out["final_by_type"] = {**WF_DEFAULT["final_by_type"], **(v.get("final_by_type") or {})}
    return out


def stages_for(db: Session, req_type: str, has_manager: bool) -> list[str]:
    """Their sql/10 workflow: [direct manager] → HR → [CEO]. The manager is skipped for HR-direct types and for an
    employee without a manager; the CEO only when the type's final approver is the CEO (every type except the five
    HR-final ones)."""
    if req_type == "forgot_punch":
        return ["hr"]
    final = wf_config(db)["final_by_type"].get(req_type, "ceo")
    return (["manager"] if has_manager and req_type not in HR_DIRECT else []) + ["hr"] + (["ceo"] if final == "ceo" else [])


# ---------------------------------------------------------------- direct-manager permissions (sql/10, sql/16)
MGR_PERM_KEYS = ["approve_requests", "view_team", "view_team_data", "view_team_leaves", "view_team_requests",
                 "view_team_attendance", "view_team_salary", "manage_targets", "evaluate_team", "submit_for_team"]
MGR_DEFAULT_ON = {"approve_requests", "manage_targets", "evaluate_team"}


def manager_perms(db: Session, manager_id: str | None) -> dict[str, bool]:
    row = db.execute(text("SELECT perms FROM public.ariba_manager_perms WHERE manager_id=:m"), {"m": manager_id}).first() if manager_id else None
    stored = (row[0] if row else None) or {}
    return {k: bool(stored[k]) if k in stored else k in MGR_DEFAULT_ON for k in MGR_PERM_KEYS}


def is_manager_of(db: Session, manager_id: str | None, employee_id: str) -> bool:
    if not manager_id:
        return False
    row = db.execute(text("SELECT manager_id FROM public.employee_directory WHERE employee_id=:e"), {"e": employee_id}).first()
    return bool(row and row[0] == manager_id)


def team_ids(db: Session, manager_id: str | None) -> list[str]:
    if not manager_id:
        return []
    return [r[0] for r in db.execute(text("SELECT employee_id FROM public.employee_directory WHERE manager_id=:m AND active ORDER BY name_ar"), {"m": manager_id})]


def require_manager_perm(db: Session, actor: dict[str, Any], employee_id: str, perm: str) -> None:
    me = actor.get("employee_id")
    if not is_manager_of(db, me, employee_id) or not manager_perms(db, me).get(perm):
        raise ApiError(403, "NOT_AUTHORIZED", "ليست لديك صلاحية على هذا الموظف")


# ---------------------------------------------------------------- notifications (+ push)
def notify(db: Session, employee_id: str | None, request_id: Any, title: str, body: str, stage: str = "employee", kind: str = "info") -> None:
    """One in-app notification; the scheduler e-mails it (emailed_at is null) and pushes it to the recipient's devices
    (pushed_at is null) — both only once the request's transaction has committed."""
    if not employee_id:
        return
    db.execute(text("""INSERT INTO public.workflow_notifications(recipient_employee_id,request_id,title,body,stage,kind)
        VALUES(:e,:r,:t,:b,:s,:k)"""), {"e": employee_id, "r": request_id, "t": title, "b": body, "s": stage, "k": kind})


def hr_people(db: Session) -> list[str]:
    """Who receives HR notifications: the configured HR approver(s) and every active HR account."""
    ids = [r[0] for r in db.execute(text("SELECT employee_id FROM public.workflow_approvers WHERE stage='hr'"))]
    ids += [r[0] for r in db.execute(text("""SELECT DISTINCT a.employee_id FROM public.ariba_auth_accounts a
        JOIN public.employee_directory e ON e.employee_id=a.employee_id WHERE a.active AND e.active AND a.role='hr'"""))]
    seen: list[str] = []
    for i in ids:
        if i and i not in seen:
            seen.append(i)
    return seen


def new_id() -> uuid.UUID:
    return uuid.uuid4()
