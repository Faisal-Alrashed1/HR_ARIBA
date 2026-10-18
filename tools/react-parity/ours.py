"""Runs OUR backend formulas on the cases the parity run generated (python -I ours.py in.json out.json).

Each task names a suite; the inputs are the same synthetic records the reference (their React engines) received, in
the stored legacy `data` shape both systems share. Only real backend code is called here — the adapter maps shapes,
it never re-implements a rule.
"""
from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from app.routers import canonical as c  # noqa: E402
from app.services import canonical_data as cdata  # noqa: E402
from app.services import employee_map as emap  # noqa: E402
from app.services import gosi as gosi_calc  # noqa: E402
from app.services.leave import HolidayCalendar, LeaveBook  # noqa: E402

D = date.fromisoformat


def _gosi_settings():
    return getattr(c, "GOSI_DEFAULT")


def suite_rates(cases):
    c._gosi_settings = lambda db: _gosi_settings()  # the production copy has no stored GOSI settings
    out = []
    for x in cases:
        r = c.gosi_rates(on=D(x["date"]), actor={"role": "admin"}, db=None)
        out.append({k: round(v * 100, 4) if isinstance(v, float) and k not in ("cap",) else v for k, v in r.items()})
    return out


def suite_figures(cases):
    rules = gosi_calc.rules_from_settings(_gosi_settings())
    out = []
    for x in cases:
        data = x["data"]
        f = emap.figures(data, saudi=emap.is_saudi(data, data.get("nationality")), rules=rules,
                         birth=emap.d(data.get("dob")), on=D(x["on"]), job=data.get("jobTitle"), dept=data.get("department"),
                         employer=data.get("employer"))
        out.append({"total": float(f["total"]), "gosi_employee": float(f["gosi_employee"]), "gosi_employer": float(f["gosi_employer"]),
                    "net": float(f["net"])})
    return out


def _book(x):
    today = D(x["today"])
    rows = [{"employee_id": str(e["id"]), "name_ar": e.get("nameAr"), "join_date": e.get("contractJoin"),
             "active": not e.get("isTerminated"), "data": e, "updated_at": None} for e in x["employees"]]
    emps = [cdata.emp_view(r) for r in rows]
    data = {}
    for e in emps:
        d = e.data
        entry = {}
        if isinstance(d.get("leaveYearOverrides"), dict):
            entry["years"] = d["leaveYearOverrides"]
        if isinstance(d.get("leaveHistoryByYear"), dict):
            entry["used_history"] = d["leaveHistoryByYear"]
        if float(d.get("leaveEosExcess") or 0):
            entry["eos_excess"] = float(d["leaveEosExcess"])
        if entry:
            data[e.id] = entry
    hol = HolidayCalendar([(D(h["date"]), int(h.get("days") or 1), bool(h.get("recurring"))) for h in x["holidays"]])
    approved = {}
    for lv in x["leaves"]:
        if lv["type"] == "annual" and lv["status"] == "approved":
            approved.setdefault(str(lv["empId"]), []).append((D(lv["from"]), D(lv["to"])))
    adjustments = [{"employee_id": str(a["empId"]), "date": a["date"], "delta": a["delta"]} for a in x["adjustments"]]
    return LeaveBook(holidays=hol, data=data, adjustments=adjustments, approved_annual=approved, today=today), emps, today


def suite_leave(cases):
    out = []
    for x in cases:
        book, emps, today = _book(x)
        res = {}
        for e in emps:
            y = today.year
            res[e.id] = {
                "current": book.current(e),
                "app_current": book.app_current(e),
                "app_year_end": book.app_year_end(e),
                "year_end": book.year_closing(e, y),
                "carry": book.carry_forward(e, y),
                "acc_eos": book.accumulated_eos(e, y),
                "cum_accrued": book.cumulative_accrued(e),
                "cum_used": book.cumulative_used(e),
                "used_through": book.used_through(e, D(x["usedEnd"][e.id])) if x["usedEnd"].get(e.id) else None,
                "closes": {str(yy): book.year_closing(e, yy) for yy in range(book.start_year(e), y)},
                "summary_current": book.summary(e)["current"],
            }
        out.append(res)
    return out


def suite_alerts(cases):
    out = []
    for x in cases:
        rows = [{"employee_id": str(e["id"]), "name_ar": e.get("nameAr"), "name_en": None, "data": e} for e in x["employees"]]
        al = c._dashboard_alerts(rows, D(x["today"]))
        out.append([{"id": a["employee"]["id"], "kind": a["kind"], "n": a["days_left"]} for a in al])
    return out


SUITES = {"rates": suite_rates, "figures": suite_figures, "leave": suite_leave, "alerts": suite_alerts}

if __name__ == "__main__":
    tasks = json.loads(Path(sys.argv[1]).read_text())
    result = {name: SUITES[name](cases) for name, cases in tasks.items()}
    Path(sys.argv[2]).write_text(json.dumps(result, ensure_ascii=False, default=str))
