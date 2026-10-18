"""Fixed assets and custody (ariba_assets_list / _upsert / _delete / ariba_asset_custody — the tables we already had).
The depreciation, the yearly register and the inventory are their pure formulas, run in the page (lib/calc/assets.ts,
checked by tools/react-parity)."""
from __future__ import annotations

import json
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.database import get_db
from app.routers import canonical as c
from app.services import port_common as pc

router = APIRouter()
CATEGORIES = {"computers", "electronics", "vehicles", "furniture", "equipment", "software", "other"}
STATUSES = {"active", "sold", "disposed", "lost"}


def _out(r: dict[str, Any]) -> dict[str, Any]:
    o = dict(r)
    o["id"] = str(r["id"])
    for k in ("cost", "salvage_value", "disposal_value"):
        o[k] = float(r[k]) if r.get(k) is not None else None
    return o


@router.get("/assets")
def list_assets(actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    pc.require(db, actor, "assets|employees")
    assets = c._rows(db, """SELECT a.*,d.name_ar AS custodian_name FROM public.ariba_assets a
        LEFT JOIN public.employee_directory d ON d.employee_id=a.custodian_employee_id ORDER BY a.asset_no NULLS LAST,a.created_at""")
    log = c._rows(db, """SELECT l.*,a.asset_no,a.name AS asset_name,d.name_ar AS employee_name FROM public.ariba_asset_custody_log l
        JOIN public.ariba_assets a ON a.id=l.asset_id LEFT JOIN public.employee_directory d ON d.employee_id=l.employee_id ORDER BY l.created_at DESC LIMIT 500""")
    return {"assets": [_out(a) for a in assets], "log": [{**x, "asset_id": str(x["asset_id"])} for x in log]}


@router.post("/assets")
def upsert_asset(body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    pc.require(db, actor, "assets", "edit")
    a = body.get("asset") if isinstance(body.get("asset"), dict) else body
    name = str(a.get("name") or "").strip()
    try:
        acq = date.fromisoformat(str(a.get("acquisition_date"))[:10])
        cost, salvage = float(a.get("cost") or 0), float(a.get("salvage_value") or 0)
        life = int(a.get("useful_life_months") or 0)
        disp = date.fromisoformat(str(a["disposal_date"])[:10]) if a.get("disposal_date") else None
    except (TypeError, ValueError) as exc:
        raise ApiError(422, "validation_error", "بيانات الأصل غير صحيحة") from exc
    status = a.get("status") or "active"
    if not name or a.get("category") not in CATEGORIES or status not in STATUSES or life <= 0 or cost < 0 or salvage > cost:
        raise ApiError(422, "validation_error", "بيانات الأصل غير صحيحة")
    if status != "active" and (not disp or disp < acq):
        raise ApiError(422, "validation_error", "تاريخ الاستبعاد مطلوب ولا يسبق الشراء")
    p = {"name": name, "cat": a["category"], "sn": a.get("serial_no") or None, "model": a.get("model") or None, "loc": a.get("location") or None,
         "cond": a.get("condition") or None, "notes": a.get("notes") or None, "capz": a.get("capitalized") is not False, "acq": acq, "cost": cost,
         "salv": salvage, "life": life, "st": status, "dd": disp, "dv": float(a.get("disposal_value") or 0), "by": actor.get("username")}
    if a.get("id"):
        row = c._row(db, """UPDATE public.ariba_assets SET name=:name,category=:cat,serial_no=:sn,model=:model,location=:loc,condition=:cond,notes=:notes,
            capitalized=:capz,acquisition_date=:acq,cost=:cost,salvage_value=:salv,useful_life_months=:life,status=:st,disposal_date=:dd,disposal_value=:dv,
            updated_by=:by,updated_at=now() WHERE id=:id RETURNING *""", id=a["id"], **p)
        if not row:
            raise ApiError(404, "not_found", "الأصل غير موجود")
    else:
        n = (db.scalar(text("SELECT count(*) FROM public.ariba_assets")) or 0) + 1
        row = c._row(db, """INSERT INTO public.ariba_assets(asset_no,name,category,serial_no,model,location,condition,notes,capitalized,acquisition_date,cost,
            salvage_value,useful_life_months,status,disposal_date,disposal_value,created_by,updated_by)
            VALUES(:no,:name,:cat,:sn,:model,:loc,:cond,:notes,:capz,:acq,:cost,:salv,:life,:st,:dd,:dv,:by,:by) RETURNING *""", no=f"AST-{n:04d}", **p)
    c._write_audit(db, actor, request, "employees", "asset_save", "asset", row["id"], summary=f"أصل {row['asset_no']}: {name}")
    db.commit()
    return {"asset": _out(row)}


@router.delete("/assets/{asset_id}")
def delete_asset(asset_id: str, request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    pc.require(db, actor, "assets", "edit")
    row = c._row(db, "SELECT * FROM public.ariba_assets WHERE id=:i", i=asset_id)
    if not row:
        raise ApiError(404, "not_found", "الأصل غير موجود")
    db.execute(text("INSERT INTO public.ariba_deleted_items(kind,ref_id,snapshot,deleted_by,deleted_by_role) VALUES('asset',:i,CAST(:s AS jsonb),:by,:role)"),
               {"i": asset_id, "s": json.dumps(row, default=str, ensure_ascii=False), "by": actor.get("username"), "role": actor.get("role")})
    db.execute(text("DELETE FROM public.ariba_asset_custody_log WHERE asset_id=:i"), {"i": asset_id})
    db.execute(text("DELETE FROM public.ariba_assets WHERE id=:i"), {"i": asset_id})
    c._write_audit(db, actor, request, "employees", "asset_delete", "asset", asset_id, summary=f"حذف أصل {row['asset_no']}: {row['name']}")
    db.commit()
    return {"ok": True}


@router.post("/assets/{asset_id}/custody")
def custody(asset_id: str, body: dict[str, Any], request: Request, actor: dict[str, Any] = Depends(c.current_actor), db: Session = Depends(get_db)):
    """ariba_asset_custody: hand the asset to an employee (or take it back with an empty employee)."""
    pc.require(db, actor, "assets|employees", "edit")
    row = c._row(db, "SELECT * FROM public.ariba_assets WHERE id=:i", i=asset_id)
    if not row:
        raise ApiError(404, "not_found", "الأصل غير موجود")
    emp = str(body.get("employee_id") or "") or None
    when = str(body.get("date") or date.today().isoformat())[:10]
    if row["custodian_employee_id"] and row["custodian_employee_id"] != emp:
        db.execute(text("""INSERT INTO public.ariba_asset_custody_log(id,asset_id,employee_id,action,at_date,notes,by_employee)
            OVERRIDING SYSTEM VALUE VALUES(:id,:a,:e,'return',:d,:n,:by)"""), {"id": c._next_id(db, "ariba_asset_custody_log"), "a": asset_id, "e": row["custodian_employee_id"], "d": when, "n": body.get("notes"), "by": actor.get("employee_id")})
    if emp and emp != row["custodian_employee_id"]:
        db.execute(text("""INSERT INTO public.ariba_asset_custody_log(id,asset_id,employee_id,action,at_date,notes,by_employee)
            OVERRIDING SYSTEM VALUE VALUES(:id,:a,:e,'assign',:d,:n,:by)"""), {"id": c._next_id(db, "ariba_asset_custody_log"), "a": asset_id, "e": emp, "d": when, "n": body.get("notes"), "by": actor.get("employee_id")})
    db.execute(text("UPDATE public.ariba_assets SET custodian_employee_id=:e,custody_date=:d,updated_by=:by,updated_at=now() WHERE id=:i"),
               {"e": emp, "d": when if emp else None, "by": actor.get("username"), "i": asset_id})
    c._write_audit(db, actor, request, "employees", "asset_custody", "asset", asset_id, summary=f"تسليم/استلام عهدة (أصل {row['asset_no']})", details={"employee_id": emp})
    db.commit()
    return {"ok": True}
