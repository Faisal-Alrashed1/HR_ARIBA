"""Read the canonical Supabase tables into the shapes the pure calculation services expect.

The calc engines (leave ledger, punch rules) were verified number-for-number against the legacy app; here they
are fed from `employee_directory` (+ its `data` JSONB), `public_holidays` and `workflow_requests` instead of the
retired ORM tables. Nothing here writes.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.leave import HolidayCalendar, LeaveBook


def _d(v: Any) -> date | None:
    if not v:
        return None
    if isinstance(v, date):
        return v
    try:
        return date.fromisoformat(str(v)[:10])
    except ValueError:
        return None


@dataclass(frozen=True)
class EmpView:
    """The fields the leave engine reads, taken from one employee_directory row."""

    id: str
    name_ar: str
    join_date: date | None
    termination_date: date | None
    annual_leave_days: float
    data: dict

    @property
    def is_terminated(self) -> bool:
        return self.termination_date is not None


def emp_view(row: dict[str, Any]) -> EmpView:
    d = dict(row.get("data") or {})
    terminated = not row.get("active", True) or d.get("isTerminated") or d.get("term")
    end = _d(d.get("terminationDate")) or _d(d.get("lastDay")) if terminated else None
    if terminated and end is None:
        end = _d(row.get("updated_at")) or date.today()
    try:
        annual = float(d.get("leaveDaysContract") or 21)
    except (TypeError, ValueError):
        annual = 21.0
    return EmpView(
        id=str(row["employee_id"]),
        name_ar=row.get("name_ar") or d.get("nameAr") or d.get("name_ar") or str(row["employee_id"]),
        join_date=_d(row.get("join_date")) or _d(d.get("contractJoin")) or _d(d.get("join_date")),
        termination_date=end,
        annual_leave_days=annual,
        data=d,
    )


def employees(db: Session, *, active_only: bool = False, employee_id: str | None = None) -> list[EmpView]:
    sql = "SELECT employee_id,name_ar,join_date,active,data,updated_at FROM public.employee_directory"
    params: dict[str, Any] = {}
    if employee_id is not None:
        sql += " WHERE employee_id=:eid"
        params["eid"] = employee_id
    elif active_only:
        sql += " WHERE active"
    rows = [dict(r) for r in db.execute(text(sql + " ORDER BY name_ar"), params).mappings()]
    return [emp_view(r) for r in rows]


def holidays(db: Session) -> HolidayCalendar:
    rows = db.execute(text("SELECT DISTINCT holiday_date,days,recurring FROM public.public_holidays")).all()
    return HolidayCalendar([(r[0], int(r[1] or 1), bool(r[2])) for r in rows if r[0]])


LEAVE_TYPES = ("annual", "sick", "emergency", "death", "marriage", "maternity", "paternity", "umrah", "hajj", "remote", "unpaid")


def approved_annual(db: Session) -> dict[str, list[tuple[date, date]]]:
    """Approved annual leave per employee from workflow_requests (payload from/to), each period once."""
    out: dict[str, set[tuple[date, date]]] = {}
    for lv in leaves(db):
        if lv["type"] == "annual" and lv["status"] == "approved":
            f, t = _d(lv["from"]), _d(lv["to"])
            if f:
                out.setdefault(lv["empId"], set()).add((f, t or f))
    return {k: sorted(v) for k, v in out.items()}


def leaves(db: Session) -> list[dict[str, Any]]:
    """Every leave request in their engine's shape (rt.leaves): {id, empId, type, from, to, status}."""
    out: list[dict[str, Any]] = []
    seen: set[tuple] = set()
    for rid, eid, typ, status, payload in db.execute(text(
        "SELECT id,employee_id,request_type,status,payload FROM public.workflow_requests WHERE request_type = ANY(:t)"
    ), {"t": list(LEAVE_TYPES)}).all():
        p = payload or {}
        f, t = _d(p.get("from") or p.get("from_date") or p.get("date")), _d(p.get("to") or p.get("to_date"))
        if not f:
            continue
        key = (str(eid), typ, f, t or f, status)
        if key in seen:
            continue
        seen.add(key)
        out.append({"id": str(rid), "empId": str(eid), "type": typ, "from": f.isoformat(), "to": (t or f).isoformat(), "status": str(status or "pending")})
    return out


def setting(db: Session, key: str) -> Any:
    return db.execute(text("SELECT value FROM public.ariba_app_settings WHERE key=:k"), {"k": key}).scalar()


def leave_settings(db: Session) -> dict[str, Any]:
    """Accrual method, carry cap and country, as their runtimePatchFromSettings reads them."""
    acc = setting(db, "leave_accrual_method")
    method = acc.get("method") if isinstance(acc, dict) and acc.get("method") in ("calendar", "workdays", "monthly") else "calendar"
    carry = setting(db, "leave_carry")
    carry = {"enabled": carry.get("enabled") is not False, "days": carry.get("days")} if isinstance(carry, dict) else None
    from app.services.country import mode_of
    country, eg_rules = mode_of(setting(db, "country_system"))
    return {"method": method, "carry": carry, "country": country, "eg_rules": eg_rules}


def leave_book(db: Session, today: date, emps: list[EmpView] | None = None) -> LeaveBook:
    """LeaveBook fed like their engine: employee data (leaveYearOverrides, leaveUsed<year>, leaveHistoryByYear) from
    employee_directory, every leave request, holidays and the leave settings."""
    cfg = leave_settings(db)
    return LeaveBook(holidays=holidays(db), leaves=leaves(db), adjustments=[], today=today, method=cfg["method"],
                     carry=cfg["carry"], country=cfg["country"], eg_rules=cfg["eg_rules"])
