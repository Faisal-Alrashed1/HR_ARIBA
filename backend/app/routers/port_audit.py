"""Audit log (ariba_audit_list) and deleting an old month with Finance approval (ariba_audit_purge_info / _request /
_decide, their V154). Entries are written by the server on every write (decision 9)."""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.database import get_db
from app.routers import canonical as c
from app.services import port_common as pc

router = APIRouter()
_MONTH_SQL = "to_char(at AT TIME ZONE 'Asia/Riyadh','YYYY-MM')"


def _can_see(db: Session, actor: dict[str, Any], modules: list[str]) -> bool:
    """The full log needs the audit permission; a page's own log (SectionAudit) is open to who can view that page."""
    if pc.can(db, actor, "audit"):
        return True
    alias = {"security": "permissions", "eos": "settlement", "insurance": "payroll"}
    return bool(modules) and all(pc.can(db, actor, alias.get(m, m)) for m in modules)


@router.post("/audit/list")
def audit_list(body: dict[str, Any], actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """Filters: modules[], actor (username), from/to (ISO timestamps), q (text), limit (≤ 1000). Newest first, with the total."""
    modules = [str(m) for m in (body.get("modules") or []) if m]
    if not _can_see(db, actor, modules):
        raise ApiError(403, "NOT_AUTHORIZED", "ليست لديك صلاحية")
    where, p = ["true"], {}
    if modules:
        where.append("module = ANY(:mods)")
        p["mods"] = modules
    if body.get("actor"):
        where.append("actor_username = :u")
        p["u"] = str(body["actor"])
    for k, op in (("from", ">="), ("to", "<")):
        if body.get(k):
            try:
                p[k] = datetime.fromisoformat(str(body[k]).replace("Z", "+00:00"))
            except ValueError as exc:
                raise ApiError(422, "validation_error", "تاريخ غير صحيح") from exc
            where.append(f"at {op} :{k}")
    if str(body.get("q") or "").strip():
        where.append("(coalesce(summary,'')||' '||coalesce(action,'')||' '||coalesce(entity_name,'')||' '||coalesce(actor_name,'')||' '||coalesce(actor_username,'')) ILIKE :q")
        p["q"] = "%" + str(body["q"]).strip() + "%"
    limit = max(1, min(int(body.get("limit") or 300), 1000))
    w = " AND ".join(where)
    total = db.scalar(text(f"SELECT count(*) FROM public.ariba_audit_log WHERE {w}"), p) or 0
    rows = c._rows(db, f"""SELECT id,at,actor_employee_id,actor_username,actor_name,actor_role,module,action,entity_type,entity_id,entity_name,summary,details
        FROM public.ariba_audit_log WHERE {w} ORDER BY at DESC, id DESC LIMIT {limit}""", **p)
    return {"rows": rows, "total": total}


def _purgeable(db: Session) -> list[dict[str, Any]]:
    """Months whose last day is more than 30 days ago (Riyadh), with their entry counts, newest first."""
    rows = c._rows(db, f"SELECT {_MONTH_SQL} AS month, count(*) AS count FROM public.ariba_audit_log GROUP BY 1 ORDER BY 1 DESC")
    return [r for r in rows if _month_old_enough(r["month"])]


def _month_old_enough(month: str) -> bool:
    y, m = int(month[:4]), int(month[5:7])
    nxt = date(y + (m == 12), m % 12 + 1, 1)
    return nxt <= date.today() - timedelta(days=30)


def _finance_ids(db: Session) -> list[str]:
    return [r[0] for r in db.execute(text("""SELECT DISTINCT a.employee_id FROM public.ariba_auth_accounts a
        JOIN public.employee_directory e ON e.employee_id=a.employee_id WHERE a.active AND e.active AND a.role='finance'"""))]


@router.get("/audit/purge")
def purge_info(actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    pc.require(db, actor, "audit")
    reqs = c._rows(db, """SELECT id,month,requester_name,requester_role,status,created_at,decided_name,decided_at,deleted_count
        FROM public.ariba_audit_purge_requests ORDER BY created_at DESC LIMIT 30""")
    return {"is_finance": actor.get("role") == "finance", "months": _purgeable(db), "requests": [{**r, "id": str(r["id"])} for r in reqs]}


@router.post("/audit/purge")
def purge_request(body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    pc.require(db, actor, "audit", "edit")
    month = str(body.get("month") or "")
    if not any(m["month"] == month for m in _purgeable(db)):
        raise ApiError(422, "MONTH_NOT_ALLOWED", "مسموح فقط للشهور الأقدم من 30 يوم")
    if db.scalar(text("SELECT 1 FROM public.ariba_audit_purge_requests WHERE month=:m AND status IN ('pending','approved')"), {"m": month}):
        raise ApiError(409, "ALREADY_REQUESTED", "يوجد طلب قائم لهذا الشهر")
    rid = db.scalar(text("""INSERT INTO public.ariba_audit_purge_requests(month,requested_by,requester_name,requester_role)
        VALUES(:m,:a,:n,:r) RETURNING id"""), {"m": month, "a": actor["account_id"], "n": actor.get("name_ar") or actor.get("username"), "r": actor.get("role")})
    fin = _finance_ids(db)
    for e in fin:
        pc.notify(db, e, None, "طلب حذف شهر من سجل التعديلات", f"{actor.get('name_ar') or actor.get('username')} يطلب حذف سجل شهر {month}", "finance", "audit_purge")
    c._write_audit(db, actor, request, "security", "طلب حذف شهر من سجل التعديلات", "audit_purge", rid, summary=f"طلب حذف سجل شهر {month}")
    db.commit()
    return {"id": str(rid), "notified": len(fin)}


@router.post("/audit/purge/{purge_id}/decide")
def purge_decide(purge_id: str, body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """Finance only. Approving deletes that month's entries at once (status executed, with the count)."""
    if actor.get("role") != "finance":
        raise ApiError(403, "NOT_AUTHORIZED", "الموافقة للمالية فقط")
    row = c._row(db, "SELECT * FROM public.ariba_audit_purge_requests WHERE id=:i FOR UPDATE", i=purge_id)
    if not row or row["status"] != "pending":
        raise ApiError(409, "NOT_PENDING", "الطلب غير قائم")
    by = {"a": actor["account_id"], "n": actor.get("name_ar") or actor.get("username"), "i": purge_id}
    if not body.get("approve"):
        db.execute(text("UPDATE public.ariba_audit_purge_requests SET status='rejected',decided_by=:a,decided_name=:n,decided_at=now() WHERE id=:i"), by)
        c._write_audit(db, actor, request, "security", "رفض حذف شهر من سجل التعديلات", "audit_purge", purge_id, summary=f"رفض حذف سجل شهر {row['month']}")
        db.commit()
        return {"status": "rejected"}
    n = db.execute(text(f"DELETE FROM public.ariba_audit_log WHERE {_MONTH_SQL}=:m"), {"m": row["month"]}).rowcount
    db.execute(text("UPDATE public.ariba_audit_purge_requests SET status='executed',decided_by=:a,decided_name=:n,decided_at=now(),deleted_count=:c WHERE id=:i"), {**by, "c": n})
    c._write_audit(db, actor, request, "security", "حذف شهر من سجل التعديلات", "audit_purge", purge_id, summary=f"حذف سجل شهر {row['month']} ({n} تعديل)")
    db.commit()
    return {"status": "executed", "deleted": n}
