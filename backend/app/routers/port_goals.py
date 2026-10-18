"""Targets and evaluations (their sql/12, sql/16 and lib/goals.js — rows 177–180).

Who may do what (sql/12): HR (module employees), the CEO and the chairman/admin set targets and prepare evaluations
for anyone; the direct manager for his team with manage_targets / evaluate_team. The final approval of an evaluation:
admin, chairman, CEO, or the direct manager with evaluate_team — HR prepares only. The employee sees his own targets
and his approved evaluations. The overall score is computed here: round(Σ score·weight / Σ weight, 1)."""
from __future__ import annotations

import json
import re
from typing import Any

from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.database import get_db
from app.routers import canonical as c
from app.services import port_common as pc

router = APIRouter()
PT = {"annual": "سنوي", "quarterly": "ربع سنوي", "monthly": "شهري"}
MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
KEY_RE = re.compile(r"^\d{4}(-Q[1-4]|-(0[1-9]|1[0-2]))?$")


def rating_of(p: float) -> str:
    """lib/goals.js ratingOf (row 179)."""
    return "ممتاز" if p >= 90 else "جيد جداً" if p >= 75 else "جيد" if p >= 60 else "مقبول" if p >= 50 else "ضعيف"


def overall_of(items: list[dict[str, Any]]) -> float | None:
    """EvalForm calc (row 178): weighted mean of the item scores, one decimal; weight defaults to 1."""
    def f(v: Any, d: float) -> float:
        try:
            return float(v) if v not in (None, "") else d
        except (TypeError, ValueError):
            return d
    tw = sum(f(i.get("weight"), 1) or 1 for i in items)
    if not tw:
        return None
    return round(sum(f(i.get("score"), 0) * (f(i.get("weight"), 1) or 1) for i in items) / tw * 10) / 10


def key_label(t: str, k: str) -> str:
    return "سنة " + k if t == "annual" else ("الربع " + k[-1] + " / " + k[:4]) if t == "quarterly" else MONTHS[int(k[5:]) - 1] + " " + k[:4]


def _staff(db: Session, actor: dict[str, Any], need: str = "view") -> bool:
    return actor.get("role") in {"admin", "chairman", "ceo"} or pc.can(db, actor, "employees", need)


def _may_targets(db: Session, actor: dict[str, Any], employee_id: str, need: str = "view") -> None:
    if _staff(db, actor, need):
        return
    me = actor.get("employee_id")
    if pc.is_manager_of(db, me, employee_id) and pc.manager_perms(db, me)["manage_targets"]:
        return
    raise ApiError(403, "NOT_AUTHORIZED", "ليست لديك صلاحية على مستهدفات هذا الموظف")


def _may_evaluate(db: Session, actor: dict[str, Any], employee_id: str) -> None:
    if _staff(db, actor, "edit"):
        return
    me = actor.get("employee_id")
    if pc.is_manager_of(db, me, employee_id) and pc.manager_perms(db, me)["evaluate_team"]:
        return
    raise ApiError(403, "NOT_AUTHORIZED", "ليست لديك صلاحية تقييم هذا الموظف")


def _can_approve(db: Session, actor: dict[str, Any], employee_id: str) -> bool:
    if actor.get("role") in {"admin", "chairman", "ceo"}:
        return True
    me = actor.get("employee_id")
    return pc.is_manager_of(db, me, employee_id) and pc.manager_perms(db, me)["evaluate_team"]


def _target_out(r: dict[str, Any]) -> dict[str, Any]:
    out = dict(r)
    out["id"] = str(r["id"])
    for k in ("target_value", "actual_value", "weight"):
        out[k] = float(r[k]) if r[k] is not None else None
    return out


@router.get("/targets")
def list_targets(employee_id: str, year: str, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_targets_list: one employee's targets of a year (every period type)."""
    _may_targets(db, actor, employee_id)
    rows = c._rows(db, "SELECT * FROM public.ariba_targets WHERE employee_id=:e AND left(period_key,4)=:y ORDER BY period_type,period_key,created_at", e=employee_id, y=year[:4])
    return {"targets": [_target_out(r) for r in rows]}


@router.post("/targets")
def save_target(body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_target_save: add or edit a target; the employee is notified of a new one."""
    t = body.get("target") if isinstance(body.get("target"), dict) else body
    eid = str(t.get("employee_id") or "")
    _may_targets(db, actor, eid, "edit")
    ptype, pkey = str(t.get("period_type") or ""), str(t.get("period_key") or "")
    if ptype not in PT or not KEY_RE.match(pkey):
        raise ApiError(422, "BAD_PERIOD", "الفترة غير صحيحة")
    title = str(t.get("title") or "").strip()
    if not title:
        raise ApiError(422, "TITLE_REQUIRED", "اكتب عنوان المستهدف")
    num = lambda v: None if v in (None, "") else float(v)  # noqa: E731
    try:
        target_v, actual_v, weight = num(t.get("target_value")), num(t.get("actual_value")), float(t.get("weight") or 1)
    except (TypeError, ValueError) as exc:
        raise ApiError(422, "BAD_NUMBER", "قيمة غير صحيحة") from exc
    if weight <= 0:
        raise ApiError(422, "BAD_WEIGHT", "الوزن يجب أن يكون أكبر من صفر")
    params = {"e": eid, "pt": ptype, "pk": pkey, "ti": title, "de": str(t.get("description") or "") or None, "un": str(t.get("unit") or "") or None,
              "tv": target_v, "av": actual_v, "w": weight, "st": t.get("status") if t.get("status") in ("active", "done") else "active", "by": actor.get("employee_id")}
    if t.get("id"):
        row = c._row(db, """UPDATE public.ariba_targets SET period_type=:pt,period_key=:pk,title=:ti,description=:de,unit=:un,target_value=:tv,
            actual_value=:av,weight=:w,status=:st,updated_at=now() WHERE id=:id AND employee_id=:e RETURNING *""", id=t["id"], **params)
        if not row:
            raise ApiError(404, "NOT_FOUND", "المستهدف غير موجود")
    else:
        row = c._row(db, """INSERT INTO public.ariba_targets(employee_id,period_type,period_key,title,description,unit,target_value,actual_value,weight,status,created_by)
            VALUES(:e,:pt,:pk,:ti,:de,:un,:tv,:av,:w,:st,:by) RETURNING *""", **params)
        pc.notify(db, eid, None, "مستهدف جديد", f"{title} — {PT[ptype]} {key_label(ptype, pkey)}", "employee", "goal")
    c._write_audit(db, actor, request, "goals", "target_save", "target", row["id"], details={"employee_id": eid, "title": title})
    db.commit()
    return {"target": _target_out(row)}


@router.delete("/targets/{target_id}")
def delete_target(target_id: str, request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    row = c._row(db, "SELECT employee_id,title FROM public.ariba_targets WHERE id=:i", i=target_id)
    if not row:
        raise ApiError(404, "NOT_FOUND", "المستهدف غير موجود")
    _may_targets(db, actor, row["employee_id"], "edit")
    db.execute(text("DELETE FROM public.ariba_targets WHERE id=:i"), {"i": target_id})
    c._write_audit(db, actor, request, "goals", "target_delete", "target", target_id, details=row)
    db.commit()
    return {"ok": True}


def _eval_out(r: dict[str, Any] | None) -> dict[str, Any] | None:
    if not r:
        return None
    out = dict(r)
    out["id"] = str(r["id"])
    out["overall"] = float(r["overall"]) if r["overall"] is not None else None
    return out


@router.get("/evaluations/{employee_id}/{ptype}/{pkey}")
def get_eval(employee_id: str, ptype: str, pkey: str, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_eval_get: the evaluation of a period (if any) + the period's targets + whether I may approve it."""
    _may_evaluate(db, actor, employee_id)
    ev = c._row(db, "SELECT * FROM public.ariba_evaluations WHERE employee_id=:e AND period_type=:t AND period_key=:k", e=employee_id, t=ptype, k=pkey)
    targets = c._rows(db, "SELECT * FROM public.ariba_targets WHERE employee_id=:e AND period_type=:t AND period_key=:k ORDER BY created_at", e=employee_id, t=ptype, k=pkey)
    return {"evaluation": _eval_out(ev), "targets": [_target_out(t) for t in targets], "can_approve": _can_approve(db, actor, employee_id)}


@router.put("/evaluations/{employee_id}/{ptype}/{pkey}")
def save_eval(employee_id: str, ptype: str, pkey: str, body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_eval_save: draft, or submit for approval (pending); an approved evaluation is locked."""
    _may_evaluate(db, actor, employee_id)
    if ptype not in PT or not KEY_RE.match(pkey):
        raise ApiError(422, "BAD_PERIOD", "الفترة غير صحيحة")
    items = [i for i in (body.get("items") or []) if isinstance(i, dict) and str(i.get("title") or "").strip()]
    if not items:
        raise ApiError(422, "NO_ITEMS", "لا توجد بنود للتقييم")
    for i in items:
        i["score"] = max(0.0, min(100.0, float(i.get("score") or 0)))
        i["weight"] = float(i.get("weight") or 1) or 1
    old = c._row(db, "SELECT id,status FROM public.ariba_evaluations WHERE employee_id=:e AND period_type=:t AND period_key=:k", e=employee_id, t=ptype, k=pkey)
    if old and old["status"] == "approved":
        raise ApiError(409, "LOCKED", "التقييم معتمد ولا يمكن تعديله")
    overall = overall_of(items)
    status = "pending" if body.get("submit") else "draft"
    row = c._row(db, """INSERT INTO public.ariba_evaluations(employee_id,period_type,period_key,items,comments,overall,rating,status,evaluator_id,submitted_at)
        VALUES(:e,:t,:k,CAST(:i AS jsonb),:c,:o,:r,:s,:by,CASE WHEN :s='pending' THEN now() END)
        ON CONFLICT(employee_id,period_type,period_key) DO UPDATE SET items=EXCLUDED.items,comments=EXCLUDED.comments,overall=EXCLUDED.overall,
          rating=EXCLUDED.rating,status=EXCLUDED.status,evaluator_id=EXCLUDED.evaluator_id,submitted_at=EXCLUDED.submitted_at,updated_at=now() RETURNING *""",
                 e=employee_id, t=ptype, k=pkey, i=json.dumps(items, ensure_ascii=False), c=str(body.get("comments") or "") or None,
                 o=overall, r=rating_of(overall) if overall is not None else None, s=status, by=actor.get("employee_id"))
    if status == "pending":
        name = (c._row(db, "SELECT name_ar FROM public.employee_directory WHERE employee_id=:e", e=employee_id) or {}).get("name_ar")
        mgr = (c._row(db, "SELECT manager_id FROM public.employee_directory WHERE employee_id=:e", e=employee_id) or {}).get("manager_id")
        approvers = set(c._stage_people(db, "ceo")) | ({mgr} if mgr and mgr != actor.get("employee_id") else set())
        for a in approvers:
            pc.notify(db, a, None, "تقييم بانتظار اعتمادك", f"{name} — {PT[ptype]} {key_label(ptype, pkey)}", "ceo", "goal")
    c._write_audit(db, actor, request, "goals", "eval_submit" if status == "pending" else "eval_draft", "evaluation", row["id"], details={"overall": overall})
    db.commit()
    return {"evaluation": _eval_out(row)}


@router.post("/evaluations/{evaluation_id}/approve")
def approve_eval(evaluation_id: str, request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_eval_approve: final approval; the employee gets the result (notification + e-mail)."""
    ev = c._row(db, "SELECT * FROM public.ariba_evaluations WHERE id=:i", i=evaluation_id)
    if not ev:
        raise ApiError(404, "NOT_FOUND", "التقييم غير موجود")
    if not _can_approve(db, actor, ev["employee_id"]):
        raise ApiError(403, "NOT_AUTHORIZED", "الاعتماد للرئيس التنفيذي أو المدير المباشر")
    if ev["status"] != "pending":
        raise ApiError(409, "NOT_PENDING", "التقييم ليس بانتظار الاعتماد")
    row = c._row(db, "UPDATE public.ariba_evaluations SET status='approved',approved_by=:by,approved_at=now(),updated_at=now() WHERE id=:i RETURNING *",
                 i=evaluation_id, by=actor.get("username"))
    pc.notify(db, ev["employee_id"], None, "نتيجة تقييمك", f"{PT[ev['period_type']]} {key_label(ev['period_type'], ev['period_key'])}: {float(ev['overall'] or 0)}% — {ev['rating'] or ''}",
              "employee", "goal")
    c._write_audit(db, actor, request, "goals", "eval_approve", "evaluation", evaluation_id)
    db.commit()
    return {"evaluation": _eval_out(row)}


@router.get("/evaluations")
def list_evals(status: str | None = None, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_eval_list: evaluations (by status) — everyone for HR/CEO/chairman, my team for a manager."""
    rows = c._rows(db, """SELECT e.*,d.name_ar AS employee_name FROM public.ariba_evaluations e JOIN public.employee_directory d ON d.employee_id=e.employee_id
        WHERE (CAST(:s AS text) IS NULL OR e.status=:s) ORDER BY e.updated_at DESC LIMIT 500""", s=status)
    if not _staff(db, actor):
        me = actor.get("employee_id")
        rows = [r for r in rows if pc.is_manager_of(db, me, r["employee_id"])]
    return {"evaluations": [_eval_out(r) for r in rows]}


@router.get("/me/goals")
def my_goals(actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_my_goals: my targets (this year and last) + my approved evaluations."""
    eid = actor.get("employee_id")
    targets = c._rows(db, """SELECT * FROM public.ariba_targets WHERE employee_id=:e AND left(period_key,4)::int >= extract(year FROM now())::int - 1
        ORDER BY period_key DESC,created_at""", e=eid)
    evals = c._rows(db, "SELECT * FROM public.ariba_evaluations WHERE employee_id=:e AND status='approved' ORDER BY period_key DESC", e=eid)
    return {"targets": [_target_out(t) for t in targets], "evaluations": [_eval_out(e) for e in evals]}
