"""Team availability, tasks and meetings — the six RPCs missing from their delivery (ariba_team_availability,
ariba_my_tasks, ariba_send_task, ariba_task_update), built from what pages/team/index.jsx expects (docs/PORT_PLAN.md
section 5, items 1–2). The screen merges consecutive leaves and computes "leave soon" (14 days) itself."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.core.scheduling import today_riyadh
from app.database import get_db
from app.routers import canonical as c
from app.services import port_common as pc

router = APIRouter()
MANAGEMENT = {"admin", "chairman", "ceo", "hr", "admin_manager"}


def _people(db: Session, actor: dict[str, Any]) -> list[str] | None:
    """Who I may see / send to: everyone for the management roles, my direct reports otherwise (None = not allowed)."""
    if actor.get("role") in MANAGEMENT:
        return [r[0] for r in db.execute(text("SELECT employee_id FROM public.employee_directory WHERE active"))]
    team = pc.team_ids(db, actor.get("employee_id"))
    return team or None


@router.get("/team/availability")
def availability(actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """Each visible employee with his approved leaves (from − to, type); `today` in Riyadh."""
    ids = _people(db, actor)
    today = today_riyadh().isoformat()
    if ids is None:
        return {"items": [], "today": today, "allowed": False}
    rows = c._rows(db, f"SELECT {c._EMPLOYEE_COLUMNS} FROM {c._EMPLOYEE_FROM} WHERE d.employee_id = ANY(:ids) AND d.active ORDER BY d.name_ar", ids=ids)
    leaves = c._rows(db, """SELECT l.employee_id,l.from_date,l.to_date,l.days,l.leave_type FROM public.leave_requests l
        JOIN public.workflow_requests w ON w.id=l.workflow_request_id
        WHERE w.status='approved' AND l.employee_id = ANY(:ids) AND l.to_date >= (CURRENT_DATE - 60) ORDER BY l.from_date""", ids=ids)
    by: dict[str, list[dict[str, Any]]] = {}
    for lv in leaves:
        by.setdefault(lv["employee_id"], []).append({"from": lv["from_date"].isoformat(), "to": lv["to_date"].isoformat(), "days": lv["days"], "type": lv["leave_type"]})
    items = [{"id": r["employee_id"], "name": r["name_ar"], "job": r.get("job_title"), "dept": r.get("department"), "leaves": by.get(r["employee_id"], [])} for r in rows]
    return {"items": items, "today": today, "allowed": True}


def _task_out(r: dict[str, Any]) -> dict[str, Any]:
    return {"id": str(r["id"]), "batch_id": str(r["batch_id"]), "kind": r["kind"], "title": r["title"], "details": r["details"], "due_date": r["due_date"],
            "start_at": r["start_at"], "end_at": r["end_at"], "location": r["location"], "status": r["status"], "response_note": r["response_note"],
            "from_id": r["created_by"], "from_name": r.get("from_name"), "to_id": r["assignee_id"], "to_name": r.get("to_name"), "created_at": r["created_at"]}


@router.get("/tasks")
def my_tasks(box: str = "inbox", actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_my_tasks: inbox (sent to me) or sent (by me)."""
    me = actor.get("employee_id")
    col = "t.assignee_id" if box == "inbox" else "t.created_by"
    rows = c._rows(db, f"""SELECT t.*,f.name_ar AS from_name,a.name_ar AS to_name FROM public.ariba_tasks t
        JOIN public.employee_directory f ON f.employee_id=t.created_by JOIN public.employee_directory a ON a.employee_id=t.assignee_id
        WHERE {col}=:me ORDER BY t.created_at DESC LIMIT 300""", me=me)
    return {"items": [_task_out(r) for r in rows]}


def _ts(v: Any) -> datetime | None:
    if not v:
        return None
    try:
        return datetime.fromisoformat(str(v))
    except ValueError as exc:
        raise ApiError(422, "BAD_TIME", "الوقت غير صحيح") from exc


@router.post("/tasks")
def send_task(body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_send_task: one task or meeting invitation to several people (one row each)."""
    me = actor.get("employee_id")
    if not me:
        raise ApiError(409, "NO_EMPLOYEE", "الحساب غير مربوط بموظف")
    allowed = set(_people(db, actor) or [])
    to = [str(x) for x in (body.get("to") or []) if str(x)]
    if not to:
        raise ApiError(422, "NO_RECIPIENTS", "اختر موظفاً على الأقل")
    if any(t not in allowed for t in to):
        raise ApiError(403, "NOT_AUTHORIZED", "ترسل لفريقك فقط")
    kind = body.get("kind") if body.get("kind") in ("task", "meeting") else "task"
    title = str(body.get("title") or "").strip()
    if not title:
        raise ApiError(422, "TITLE_REQUIRED", "اكتب العنوان")
    start, end = _ts(body.get("start")), _ts(body.get("end"))
    if kind == "meeting" and not start:
        raise ApiError(422, "START_REQUIRED", "حدد وقت الاجتماع")
    if start and end and end < start:
        raise ApiError(422, "BAD_TIME", "نهاية الاجتماع قبل بدايته")
    batch = uuid.uuid4()
    for t in to:
        db.execute(text("""INSERT INTO public.ariba_tasks(batch_id,kind,title,details,due_date,start_at,end_at,location,created_by,assignee_id)
            VALUES(:b,:k,:ti,:d,:due,:s,:e,:loc,:me,:to)"""), {"b": batch, "k": kind, "ti": title[:200], "d": str(body.get("details") or "") or None,
                                                            "due": body.get("due") or None, "s": start, "e": end, "loc": str(body.get("location") or "") or None, "me": me, "to": t})
        when = start.astimezone(UTC).isoformat()[:16].replace("T", " ") if start else (body.get("due") or "")
        pc.notify(db, t, None, ("دعوة اجتماع: " if kind == "meeting" else "مهمة جديدة: ") + title[:120], f"من {actor.get('name_ar')}" + (f" — {when}" if when else ""), "employee", "task")
    c._write_audit(db, actor, request, "requests", "send_task", "task", batch, details={"kind": kind, "to": to})
    db.commit()
    return {"sent": len(to), "batch_id": str(batch)}


@router.post("/tasks/{task_id}/update")
def update_task(task_id: str, body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_task_update: the recipient marks done / accepts / declines (with a reason); the sender cancels."""
    t = c._row(db, "SELECT * FROM public.ariba_tasks WHERE id=:i", i=task_id)
    me = actor.get("employee_id")
    if not t or me not in (t["assignee_id"], t["created_by"]):
        raise ApiError(404, "not_found", "المهمة غير موجودة")
    st = body.get("status")
    allowed = {"done", "accepted", "declined"} if me == t["assignee_id"] else {"cancelled"}
    if st not in allowed or t["status"] != "open":
        raise ApiError(409, "BAD_STATUS", "لا يمكن تغيير حالة هذه المهمة")
    note = str(body.get("note") or "").strip() or None
    db.execute(text("UPDATE public.ariba_tasks SET status=:s,response_note=:n,updated_at=now() WHERE id=:i"), {"s": st, "n": note, "i": task_id})
    other = t["created_by"] if me == t["assignee_id"] else t["assignee_id"]
    label = {"done": "أُنجزت المهمة", "accepted": "قُبلت دعوة الاجتماع", "declined": "اعتذار عن الاجتماع", "cancelled": "أُلغيت المهمة"}[st]
    pc.notify(db, other, None, f"{label}: {t['title'][:120]}", (note or "") + f" — {actor.get('name_ar')}", "employee", "task")
    c._write_audit(db, actor, request, "requests", "task_" + st, "task", task_id)
    db.commit()
    return {"ok": True, "status": st}
