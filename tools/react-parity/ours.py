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


c._app_setting = lambda db, key: None  # the production copy stores no GOSI / country settings


def suite_rates(cases):
    out = []
    for x in cases:
        r = c.gosi_rates(on=D(x["date"]), actor={"role": "admin"}, db=None)
        out.append({k: round(v * 100, 4) if isinstance(v, float) and k not in ("cap",) else v for k, v in r.items()})
    return out


def suite_figures(cases):
    out = []
    for x in cases:
        data, on = x["data"], D(x["on"])
        c.today_riyadh = lambda on=on: on
        f = emap.figures(data, saudi=emap.is_saudi(data, data.get("nationality")), rules=c._gosi_settings(None),
                         birth=emap.d(data.get("dob")), on=on, job=data.get("jobTitle"), dept=data.get("department"),
                         employer=data.get("employer"), override={"nationality": data.get("nationality")}, **c._country(None))
        out.append({"total": float(f["total"]), "gosi_employee": float(f["gosi_employee"]), "gosi_employer": float(f["gosi_employer"]),
                    "net": float(f["net"])})
    return out


def _book(x, method):
    today = D(x["today"])
    rows = [{"employee_id": str(e["id"]), "name_ar": e.get("nameAr"), "join_date": e.get("contractJoin"),
             "active": not e.get("isTerminated"), "data": e, "updated_at": None} for e in x["employees"]]
    emps = [cdata.emp_view(r) for r in rows]
    hol = HolidayCalendar([(D(h["date"]), int(h.get("days") or 1), bool(h.get("recurring"))) for h in x["holidays"]])
    book = LeaveBook(holidays=hol, leaves=x["leaves"], adjustments=x["adjustments"], today=today, method=method,
                     carry={"enabled": True, "days": 10})
    return book, emps, today


def suite_leave(cases):
    out = []
    for x in cases:
      for method in ("calendar", "monthly", "workdays"):
        book, emps, today = _book(x, method)
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
