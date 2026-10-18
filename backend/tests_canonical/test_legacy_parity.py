"""Parity with the legacy system (the reference for every rule and figure).

Part 1 — golden values produced by the legacy HTML's own functions (tools/legacy-parity, `npm run fixtures`),
synthetic inputs only: contract end (addMonthsSafe) and the V130 GOSI exemption (kindOf).

Part 2 — the legacy Supabase SQL functions themselves (tools/legacy-parity/sql, schema + functions, no data) loaded
in a throw-away local database with synthetic rows, run side by side with ours: point in polygon, punch location /
remote rule, late and early minutes, the employee-app leave balance (ariba_leave_calc) and the notifications of a new
request (ariba_submit_request). Needs a local Postgres that may create databases:
    LEGACY_PARITY_PG='postgresql:///postgres?host=/tmp' .venv/bin/python -m pytest -q
"""
from __future__ import annotations

import json
import os
import random
import uuid
from contextlib import contextmanager
from datetime import date, time, timedelta
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.enums import WpsType
from app.routers import canonical as c
from app.services import canonical_data as cdata
from app.services.contracts import fixed_term_end
from app.services.gosi import exempt_kind

FIXTURES = Path(__file__).parent / "fixtures"
SQL = Path(__file__).resolve().parents[2] / "tools" / "legacy-parity" / "sql"


# --------------------------------------------------------------------------- part 1: legacy HTML golden values
def test_contract_end_matches_legacy_add_months_safe():
    rows = json.loads((FIXTURES / "legacy_add_months_safe.json").read_text())
    bad = [(s, n, want) for s, n, want in rows if fixed_term_end(date.fromisoformat(s), n).isoformat() != want]
    assert not bad, f"{len(bad)}/{len(rows)} differ, e.g. {bad[:3]}"


def test_contract_end_on_save_follows_sEmp():
    fixed = {"contractNature": "fixed", "contractJoin": "2025-03-10", "contractDuration": "24"}
    c._contract_end(fixed)
    assert fixed["contractEnd"] == fixed["ce"] == "2027-03-09"
    open_ended = {"contractNature": "indefinite", "contractJoin": "2025-03-10", "contractDuration": 24}
    c._contract_end(open_ended)
    assert open_ended["contractDuration"] == 0 and "contractEnd" not in open_ended


def test_gosi_exemption_matches_legacy_kind_of():
    rows = json.loads((FIXTURES / "legacy_ins_kind.json").read_text())
    bad = []
    for wps, job, dep, emp, typ, cat, want in rows:
        got = exempt_kind(wps_type=WpsType(wps), job_title=job, department=dep, workplace=emp, emp_type=typ, excel_category=cat)
        if got != want:
            bad.append((wps, job, dep, emp, typ, cat, want, got))
    assert not bad, f"{len(bad)}/{len(rows)} differ, e.g. {bad[:3]}"


def test_reactivation_on_save_is_theirs_not_the_legacy_auto_end():
    """Legacy V101 brought back only automatic ends; their EmpForm.jsx brings back any terminated employee whose fixed
    contract has not expired (row 66, decision 2 — docs/LOGIC_AUDIT.md section 10)."""
    future = (date.today() + timedelta(days=200)).isoformat()
    resigned = {"isTerminated": True, "terminationReason": "استقالة", "lastDay": "2026-01-31", "contractEnd": future, "contractNature": "fixed"}
    assert c._reactivate_on_save(resigned, True) and resigned["isTerminated"] is False and resigned["lastDay"] == ""
    expired = {"isTerminated": True, "terminationReason": "انتهاء العقد", "lastDay": "2026-01-31", "contractEnd": "2026-01-31", "contractNature": "fixed"}
    assert not c._reactivate_on_save(expired, True)


def test_round_half_up_is_postgres_numeric_rounding():
    assert [c._round_half_up(x) for x in (0.4, 0.5, 1.5, 2.5, 2.49, -0.5)] == [0, 1, 2, 3, 2, -1]


# --------------------------------------------------------------------------- part 2: legacy SQL functions
# This fixture is intentionally pre-normalization. Its SQL routines reference old columns such as
# attendance.emp_id/location_name, workflow_requests manager/approver fields, and leave approval flags.
# The live canonical API has Python equivalents; do not migrate this fixture to the new schema.
_LEGACY_FUNCS = ("ariba_point_in_polygon", "ariba_employee_location_ids", "ariba_punch_late", "ariba_punch_early",
                 "ariba_attendance", "ariba_leave_calc", "ariba_submit_request", "ariba_apply_forgot_punch", "ariba_workflow_action",
                 "ariba_can", "ariba_hr_override_workflow", "ariba_hr_final_approve", "ariba_delete_request")


@pytest.fixture(scope="module")
def legacy_db():
    dsn = os.environ.get("LEGACY_PARITY_PG")
    if not dsn:
        pytest.skip("set LEGACY_PARITY_PG to a local Postgres that may create databases")
    name = f"ariba_parity_{uuid.uuid4().hex[:8]}"
    admin = create_engine(make_url(dsn).set(drivername="postgresql+psycopg"), isolation_level="AUTOCOMMIT")
    with admin.connect() as cx:
        cx.execute(text(f'CREATE DATABASE "{name}"'))
    eng = create_engine(make_url(dsn).set(drivername="postgresql+psycopg", database=name))
    try:
        with eng.begin() as cx:
            raw = cx.connection.dbapi_connection
            with raw.cursor() as cur:
                cur.execute((SQL / "schema.sql").read_text())
                # keys the schema-only dump leaves out and the code relies on
                cur.execute("CREATE UNIQUE INDEX ON public.leave_requests(workflow_request_id);"
                            "ALTER TABLE public.ariba_audit_log ALTER id ADD GENERATED BY DEFAULT AS IDENTITY;"
                            "CREATE TABLE public.parity_sessions(token uuid PRIMARY KEY, account_id uuid, employee_id text, role text);"
                            "CREATE FUNCTION public.ariba_session_row(p_token uuid) RETURNS TABLE(account_id uuid, employee_id text, role text)"
                            " LANGUAGE sql AS $$ SELECT account_id, employee_id, role FROM public.parity_sessions WHERE token=p_token $$;")
                for f in _LEGACY_FUNCS:
                    cur.execute((SQL / f"{f}.sql").read_text())
        yield eng
    finally:
        eng.dispose()
        with admin.connect() as cx:
            cx.execute(text(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))
        admin.dispose()


@pytest.fixture
def db(legacy_db):
    """A session whose work (commits included) is rolled back after the test."""
    cx = legacy_db.connect()
    outer = cx.begin()
    s = Session(bind=cx, join_transaction_mode="create_savepoint")
    try:
        yield s
    finally:
        s.close()
        outer.rollback()
        cx.close()


def _exec(db: Session, sql: str, **kw: Any) -> None:
    db.execute(text(sql), kw)


def _employee(db: Session, eid: str, *, manager: str | None = None, join: date = date(2022, 1, 1), data: dict | None = None,
              employer: str = "اريبا") -> None:
    _exec(db, """INSERT INTO public.employee_directory(employee_id,username,name_ar,employer,join_date,manager_id,active,data)
        VALUES(:e,:u,:n,:er,:j,:m,true,CAST(:d AS jsonb))""", e=eid, u=f"EMP{eid}", n=f"موظف {eid}", er=employer, j=join, m=manager,
          d=json.dumps(data or {}, ensure_ascii=False))


def _session(db: Session, eid: str, role: str = "employee") -> uuid.UUID:
    tok = uuid.uuid4()
    _exec(db, "INSERT INTO public.parity_sessions VALUES(:t,:a,:e,:r)", t=tok, a=uuid.uuid4(), e=eid, r=role)
    return tok


def _legacy(db: Session, sql: str, **kw: Any) -> tuple[Any, str | None]:
    """Call a legacy function inside a savepoint; (result, None) or (None, the raised message)."""
    sp = db.begin_nested()
    try:
        out = db.execute(text(sql), kw).scalar()
        sp.rollback()
        return out, None
    except Exception as exc:  # noqa: BLE001 — the legacy function signals errors by raising
        sp.rollback()
        return None, str(getattr(exc, "orig", exc)).splitlines()[0]


def _ours(db: Session, fn) -> tuple[Any, str | None]:
    """Run one of our routes (it commits) on the same connection, then undo it: (result, None) or (None, error code)."""
    cx = db.connection()
    sp = cx.begin_nested()
    s = Session(bind=cx, join_transaction_mode="create_savepoint")
    try:
        return fn(s), None
    except c.ApiError as exc:
        return None, exc.code
    finally:
        s.close()
        sp.rollback()


def _script(name: str) -> str:
    """A docs/db-normalization script without its own BEGIN/COMMIT, so it runs inside the test's savepoint."""
    lines = (SQL.parents[2] / "docs" / "db-normalization" / name).read_text().splitlines()
    return "\n".join(x for x in lines if x.strip().upper() not in {"BEGIN;", "COMMIT;"})


_MIGRATION = None


def _normalize(db: Session) -> None:
    """Bring the seeded legacy rows to the normalized schema with the real scripts (pre-migration fixes, then the
    migration, after the keys step), as production will be. The legacy functions run before this, ours after it, on the same rows."""
    global _MIGRATION
    _MIGRATION = _MIGRATION or tuple(map(_script, ("railway_prep.sql", "pre_migration_fixes.sql", "ariba_normalization.sql")))
    for eid, role in (("40", "hr"), ("86", "ceo")):  # the configured approvers the migration requires
        if not db.execute(text("SELECT 1 FROM public.employee_directory WHERE employee_id=:e"), {"e": eid}).first():
            _employee(db, eid)
        if not db.execute(text("SELECT 1 FROM public.ariba_auth_accounts WHERE employee_id=:e"), {"e": eid}).first():
            _exec(db, "INSERT INTO public.ariba_auth_accounts(username,password_hash,role,employee_id) VALUES(:u,'x',:r,:e)", u=f"u{eid}", r=role, e=eid)
    with db.connection().connection.dbapi_connection.cursor() as cur:
        for sql in _MIGRATION:
            cur.execute(sql)


@contextmanager
def _normalized(db: Session):
    """Inside: the schema is normalized; on exit everything (migration included) is rolled back to the legacy shape."""
    sp = db.begin_nested()
    try:
        _normalize(db)
        yield
    finally:
        sp.rollback()


def _lr_state(s: Session, rid: Any) -> tuple | None:
    """The legacy leave_requests copy (status, mgr/hr/ceo status), rebuilt from the workflow like leave_requests_v."""
    row = s.execute(text("""SELECT wr.status,
        coalesce((SELECT a.action FROM public.workflow_actions a WHERE a.request_id=wr.id AND a.stage='manager' AND a.action IN ('approved','rejected') ORDER BY a.created_at DESC LIMIT 1),'pending'),
        coalesce((SELECT a.action FROM public.workflow_actions a WHERE a.request_id=wr.id AND a.stage='hr' AND a.action IN ('approved','rejected') ORDER BY a.created_at DESC LIMIT 1),'pending'),
        coalesce((SELECT a.action FROM public.workflow_actions a WHERE a.request_id=wr.id AND a.stage='ceo' AND a.action IN ('approved','rejected') ORDER BY a.created_at DESC LIMIT 1),'pending')
        FROM public.workflow_requests wr WHERE wr.id=:r AND wr.request_type<>'forgot_punch'"""), {"r": rid}).one_or_none()
    return tuple(row) if row else None


POLYGONS = [
    [[24.70, 46.60], [24.75, 46.62], [24.74, 46.70], [24.69, 46.68]],
    [[21.0, 39.0], [22.0, 39.2], [21.8, 40.1], [21.2, 39.9], [21.5, 39.5]],  # concave
    [[30.0, 31.0], [30.1, 31.0], [30.1, 31.1], [30.0, 31.1]],
]


def test_point_in_polygon_matches_legacy(db):
    rng = random.Random(5)
    bad = []
    for poly in POLYGONS:
        lats, lngs = [p[0] for p in poly], [p[1] for p in poly]
        for _ in range(700):
            lat, lng = rng.uniform(min(lats) - 0.05, max(lats) + 0.05), rng.uniform(min(lngs) - 0.05, max(lngs) + 0.05)
            want = db.execute(text("SELECT public.ariba_point_in_polygon(:a,:b,CAST(:p AS jsonb))"), {"a": lat, "b": lng, "p": json.dumps(poly)}).scalar()
            if c._point_in_polygon(lat, lng, poly) != want:
                bad.append((lat, lng))
    assert not bad, bad[:5]


_ERR = {"OUTSIDE_GEOFENCE": "outside_geofence", "REMOTE_NOT_APPROVED": "remote_not_approved"}


def test_punch_location_and_remote_rule_match_legacy_attendance(db):
    """Which location a check-in lands in (or why it is refused) — ariba_attendance V140 vs our /me/attendance/punch."""
    _exec(db, "INSERT INTO public.company_settings(id,work_start,tolerance_minutes,flexible_enabled) VALUES('default','00:00',1440,false)")
    locs = [("riyadh-hq", "project", 24.7136, 46.6753, 300, None), ("riyadh-big", "project", 24.7140, 46.6760, 2000, None),
            ("poly-1", "project", 0, 0, 200, POLYGONS[0]), ("poly-eg", "project", 0, 0, 200, POLYGONS[2]),
            ("remote", "remote", 0, 0, 200, None)]
    for lid, typ, la, ln, r, poly in locs:
        _exec(db, """INSERT INTO public.work_locations(id,name,employer,type,latitude,longitude,radius_m,active,polygon)
            VALUES(:i,:i,'all',:t,:la,:ln,:r,true,CAST(:p AS jsonb))""", i=lid, t=typ, la=la, ln=ln, r=r, p=json.dumps(poly) if poly else None)
    _employee(db, "501")
    _employee(db, "502", data={"workLocationIds": ["riyadh-hq"]})
    _employee(db, "503")
    today = c.today_riyadh().isoformat()
    _exec(db, """INSERT INTO public.workflow_requests(employee_id,request_type,payload,current_stage,status)
        VALUES('503','remote',CAST(:p AS jsonb),'completed','approved')""", p=json.dumps({"from": today, "to": today}))
    rng = random.Random(9)
    points = [(24.7136, 46.6753), (24.7200, 46.6800), (24.72, 46.65), (30.05, 31.05), (21.5, 39.2), (24.80, 46.90)]
    points += [(rng.uniform(24.65, 24.80), rng.uniform(46.55, 46.75)) for _ in range(120)]
    wants = {}
    for eid in ("501", "502", "503"):
        tok = _session(db, eid)
        for lat, lng in points:
            out, err = _legacy(db, "SELECT public.ariba_attendance(:t,'in',:a,:b)", t=tok, a=lat, b=lng)
            wants[eid, lat, lng] = (out or {}).get("location_id") if out else _ERR.get(err, err)
    bad = []
    with _normalized(db):
        for (eid, lat, lng), want in wants.items():
            res, code = _ours(db, lambda s: c.punch({"action": "in", "lat": lat, "lng": lng}, _Req(), {"employee_id": eid, "role": "employee", "account_id": None}, s))
            got = res["location_id"] if res else code
            if got != want:
                bad.append((eid, lat, lng, want, got))
    assert not bad, f"{len(bad)} differ, e.g. {bad[:5]}"


class _Req:
    """Enough of a Starlette Request for the audit log."""
    headers: dict[str, str] = {}
    client = None


@pytest.mark.parametrize("cs", [
    {"work_start": time(8), "tolerance_minutes": 15, "flexible_enabled": False},
    {"work_start": time(7, 30), "tolerance_minutes": 0, "flexible_enabled": False},
    {"tolerance_minutes": 15, "flexible_enabled": True, "shift_hours": 8, "flex_window_start": time(7), "flex_window_end": time(17)},
    {"tolerance_minutes": 10, "flexible_enabled": True, "shift_hours": 7.5, "flex_window_start": time(8), "flex_window_end": time(16, 30)},
])
def test_late_and_early_minutes_match_legacy(db, cs):
    cols = ",".join(cs)
    _exec(db, f"INSERT INTO public.company_settings(id,{cols}) VALUES('default',{','.join(':' + k for k in cs)})", **cs)
    full = {"work_start": time(8), "tolerance_minutes": 15, "flexible_enabled": False, "shift_hours": 8,
            "flex_window_start": time(8), "flex_window_end": time(17)} | cs
    full["shift_duration_minutes"] = round(float(full["shift_hours"]) * 60)  # normalized schema: shift length in minutes only
    rng = random.Random(3)
    times = [time(h, m, s) for h in range(6, 20) for m in (0, 14, 15, 16, 29, 30, 31, 59) for s in (0, 29, 30, 31)]
    bad = []
    for t in times:
        # late of the first check-in: flexible = ariba_punch_late; fixed = the inline formula of ariba_attendance
        if full["flexible_enabled"]:
            want = db.execute(text("SELECT public.ariba_punch_late(:t)"), {"t": t}).scalar()
        else:
            want = db.execute(text("SELECT greatest(0,extract(epoch from (CAST(:t AS time)-(CAST(:w AS time)+make_interval(mins=>:tol))))/60)::integer"),
                              {"t": t, "w": full["work_start"], "tol": full["tolerance_minutes"]}).scalar()
        if c._punch_late(full, t) != want:
            bad.append(("late", t, want, c._punch_late(full, t)))
        first_in, late = time(rng.randint(6, 12), rng.randint(0, 59), rng.randint(0, 59)), rng.choice([0, 0, 5])
        want = db.execute(text("SELECT public.ariba_punch_early(:i,:o,:l)"), {"i": first_in, "o": t, "l": late}).scalar()
        if c._punch_early(full, first_in, late, t) != want:
            bad.append(("early", first_in, t, late, want, c._punch_early(full, first_in, late, t)))
    assert not bad, f"{len(bad)} differ, e.g. {bad[:5]}"


@pytest.mark.skip(reason="Superseded (docs/PORT_PLAN.md decision 4): the app balance is now their React engine's current balance; checked by tools/react-parity leave suites")
def test_app_leave_balance_matches_legacy_leave_calc(db):
    """Employee-app balance (current / carried over / year end) vs ariba_leave_calc, on employees shaped like the imported
    data: every closed year has its imported override, the current year is imported (asOf snapshot), partly imported or
    plain, with approved annual leave before and after the snapshot, including future dates."""
    _exec(db, "INSERT INTO public.ariba_app_settings(key,value) VALUES('leave_carry',CAST(:v AS jsonb))", v=json.dumps({"enabled": True, "days": 10}))
    for hid, d, n in (("fitr", date(2026, 3, 19), 4), ("adha", date(2026, 5, 26), 4), ("national", date(2026, 9, 23), 1), ("founding", date(2026, 2, 22), 1)):
        _exec(db, "INSERT INTO public.public_holidays(id,name,holiday_date,days,recurring) VALUES(:i,:i,:d,:n,false)", i=hid, d=d, n=n)
    book0 = cdata.leave_book(db, date(2026, 10, 11), [])
    rng = random.Random(21)
    ids = []
    for k in range(60):
        eid = str(700 + k)
        join = rng.choice([date(2021, 4, 1), date(2023, 9, 10), date(2024, 12, 1), date(2025, 6, 15), date(2026, 2, 1)])
        ov: dict[str, dict] = {}
        carry = 0.0
        for y in range(join.year, 2026):  # imported ledger: consistent year by year, as in the real data
            ent = 21.0 if y > join.year else round(rng.uniform(1, 21), 2)
            used = rng.randint(0, 20)
            ye = round(max(0.0, carry + ent - used), 2)
            ov[str(y)] = {"entitlement": ent, "used": used, "yearEnd": ye, "carryNext": min(10.0, ye), "excess": max(0.0, ye - 10)}
            carry = min(10.0, ye)
        shape = rng.choice(["imported", "imported_carry", "entitlement", "plain"])
        cur: dict[str, Any] = {}
        if shape.startswith("imported") and join.year < 2026:
            used = rng.randint(0, 12)
            cur = {"asOf": "2026-09-22", "used": used, "yearEnd": round(max(0.0, carry + 21 - used), 2), "entitlement": 21}
            if shape == "imported_carry":
                cur["carry"] = carry
        elif shape == "entitlement":
            cur = {"entitlement": rng.choice([21, 30])}
        if cur:
            ov["2026"] = cur
        _employee(db, eid, join=join, data={"leaveYearOverrides": ov})
        for f in sorted({date(2026, rng.randint(1, 12), rng.randint(1, 28)) for _ in range(rng.randint(0, 3))}):
            if f < join or (cur.get("asOf") and f.isoformat() < cur["asOf"]):
                continue  # already inside the imported figures
            t = f + timedelta(days=rng.choice([0, 1, 4]))
            days = book0.count_workdays(f, t)
            if not days:
                continue
            rid = uuid.uuid4()
            _exec(db, """INSERT INTO public.workflow_requests(id,employee_id,request_type,payload,current_stage,status)
                VALUES(:r,:e,'annual',CAST(:p AS jsonb),'completed','approved')""", r=rid, e=eid, p=json.dumps({"from": f.isoformat(), "to": t.isoformat(), "days": days}))
            _exec(db, """INSERT INTO public.leave_requests(emp_id,type,from_date,to_date,days,status,workflow_request_id)
                VALUES(:e,'annual',:f,:t,:d,'approved',:r)""", e=eid, f=f, t=t, d=days, r=rid)
        ids.append(eid)
    days = (date(2026, 1, 15), date(2026, 9, 22), date(2026, 10, 11), date(2026, 12, 31))
    wants = {(asof, eid): db.execute(text("SELECT public.ariba_leave_calc(:e,:d)"), {"e": eid, "d": asof}).scalar() for asof in days for eid in ids}
    bad = []
    with _normalized(db):
        emps = [e for e in cdata.employees(db) if e.id in ids]
        for asof in days:
            book = cdata.leave_book(db, asof, emps)
            for e in emps:
                s = book.summary(e)
                ours = {"leaveBalance": round(book.app_current(e), 2), "leaveCarryover": s["carry"], "leaveYearEnd": round(book.app_year_end(e), 2)}
                want = wants[asof, e.id]
                for k, v in ours.items():
                    if abs(v - float(want[k])) > 0.011:
                        bad.append((asof.isoformat(), e.id, k, float(want[k]), v))
    assert len(emps) == len(ids) and not bad, f"{len(bad)} differ, e.g. {bad[:6]}"


def test_new_request_notifications_match_legacy_submit_request(db):
    """Who is notified of a new request (V115: HR hears of every request, even while it waits for the manager)."""
    _employee(db, "40")  # HR (the legacy server hard-codes 40)
    _exec(db, "INSERT INTO public.ariba_auth_accounts(username,password_hash,role,employee_id) VALUES('hr40','x','hr','40')")
    _employee(db, "86")
    _employee(db, "601", manager="86")
    _employee(db, "602", manager="40")  # HR is the manager: notified once, as manager
    _employee(db, "603")  # no manager: straight to HR
    cases = [("sick", {"from": "2026-11-01", "to": "2026-11-02", "notes": "x"}), ("advance", {"amount": 500, "notes": "x"}),
             ("forgot_punch", {"kind": "in", "date": "2026-10-08", "time": "08:00", "notes": "x"})]
    body = lambda t, p: {"type": t, **p, "from_date": p.get("from"), "to_date": p.get("to")}  # noqa: E731
    notes = lambda rid: sorted((r[0], r[1]) for r in db.execute(  # noqa: E731
        text("SELECT recipient_employee_id,stage FROM public.workflow_notifications WHERE request_id=:r"), {"r": rid}))
    wants = {}
    for eid in ("601", "602", "603"):
        tok = _session(db, eid)
        for t, p in cases:
            sp = db.begin_nested()
            out = db.execute(text("SELECT public.ariba_submit_request(:k,:t,CAST(:p AS jsonb))"), {"k": tok, "t": t, "p": json.dumps(p)}).scalar()
            wants[eid, t] = (out["current_stage"], notes(out["request_id"]))
            sp.rollback()
    bad = []
    with _normalized(db):
        for eid in ("601", "602", "603"):
            for t, p in cases:
                def submit(s: Session, t=t, p=p, eid=eid):
                    res = c.submit_request(body(t, p), _Req(), {"employee_id": eid, "role": "employee", "account_id": None}, s)
                    stage = s.execute(text("SELECT current_stage FROM public.workflow_requests WHERE id=:r"), {"r": res["id"]}).scalar()
                    return stage, sorted((r[0], r[1]) for r in s.execute(
                        text("SELECT recipient_employee_id,stage FROM public.workflow_notifications WHERE request_id=:r"), {"r": res["id"]}))
                got, err = _ours(db, submit)
                if got != wants[eid, t]:
                    bad.append((eid, t, wants[eid, t], got, err))
    assert not bad, bad


def test_approval_flow_matches_legacy_workflow_action(db):
    """Every type goes manager → HR → CEO (forgot-punch: HR only), step by step as ariba_workflow_action moves it:
    stage, status, the leave_requests copy and who is told what."""
    for eid, role in (("40", "hr"), ("86", "ceo"), ("87", "manager")):
        _employee(db, eid)
        _exec(db, "INSERT INTO public.ariba_auth_accounts(username,password_hash,role,employee_id) VALUES(:u,'x',:r,:e)", u=f"u{eid}", r=role, e=eid)
    _employee(db, "610", manager="87")
    _exec(db, "INSERT INTO public.company_settings(id) VALUES('default')")
    payloads = {"annual": {"from": "2026-11-01", "to": "2026-11-02"}, "sick": {"from": "2026-11-01", "to": "2026-11-02"},
                "permission": {"date": "2026-11-03", "time": "10:00", "dur": 2}, "early_leave": {"date": "2026-11-03", "time": "14:00", "dur": 1},
                "overtime": {"date": "2026-11-03", "hours": 2}, "mission": {"from": "2026-11-04", "to": "2026-11-05"},
                "advance": {"amount": 1000}, "forgot_punch": {"kind": "in", "date": "2026-10-08", "time": "08:00"}}
    approvers = {"manager": ("87", "manager"), "hr": ("40", "hr"), "ceo": ("86", "ceo")}

    def state(s: Session, rid: Any, legacy: bool) -> tuple:
        r = s.execute(text("SELECT current_stage,status FROM public.workflow_requests WHERE id=:r"), {"r": rid}).one()
        if legacy:
            lr = s.execute(text("SELECT status,mgr_status,hr_status,ceo_status FROM public.leave_requests WHERE workflow_request_id=:r"), {"r": rid}).one_or_none()
            lr = tuple(lr) if lr else None
        else:
            lr = _lr_state(s, rid)
        n = sorted((x[0], x[1]) for x in s.execute(text("SELECT recipient_employee_id,title FROM public.workflow_notifications WHERE request_id=:r"), {"r": rid}))
        return tuple(r), lr, n

    wants = {}
    for t, p in payloads.items():
        p = {**p, "notes": "x"}
        # legacy: submit, then approve at each stage until done (every request gets the leave_requests copy it compares)
        sp = db.begin_nested()
        rid = db.execute(text("SELECT public.ariba_submit_request(:k,:t,CAST(:p AS jsonb))"), {"k": _session(db, "610"), "t": t, "p": json.dumps(p)}).scalar()["request_id"]
        _exec(db, "INSERT INTO public.leave_requests(emp_id,type,from_date,to_date,days,status,workflow_request_id) SELECT '610',:t,'2026-11-01','2026-11-01',1,'pending',:r WHERE :t<>'forgot_punch' AND NOT EXISTS (SELECT 1 FROM public.leave_requests WHERE workflow_request_id=:r)", t=t, r=rid)
        legacy = []
        for _ in range(4):
            stage = db.execute(text("SELECT current_stage FROM public.workflow_requests WHERE id=:r"), {"r": rid}).scalar()
            if stage not in approvers:
                break
            who, role = approvers[stage]
            db.execute(text("SELECT public.ariba_workflow_action(:k,:r,'approved',NULL)"), {"k": _session(db, who, role), "r": rid})
            legacy.append((stage,) + state(db, rid, True)[:2])
        wants[t] = legacy, state(db, rid, True)[2]
        sp.rollback()

    bad = []
    with _normalized(db):
        for t, p in payloads.items():
            p = {**p, "notes": "x"}

            def ours(s: Session, t=t, p=p):
                res = c.submit_request({"type": t, **p, "from_date": p.get("from"), "to_date": p.get("to"), "on_date": p.get("date")}, _Req(),
                                       {"employee_id": "610", "role": "employee", "account_id": None}, s)
                rid = res["id"]
                steps = []
                for _ in range(4):
                    stage = s.execute(text("SELECT current_stage FROM public.workflow_requests WHERE id=:r"), {"r": rid}).scalar()
                    if stage not in approvers:
                        break
                    who, role = approvers[stage]
                    c.decide_request(rid, {"action": "approve"}, _Req(), {"employee_id": who, "role": role, "account_id": None}, s)
                    steps.append((stage,) + state(s, rid, False)[:2])
                return steps, state(s, rid, False)[2]

            legacy, legacy_notes = wants[t]
            got, err = _ours(db, ours)
            steps, notes = got or (None, None)
            if err or steps != legacy:
                bad.append((t, "steps", legacy, steps, err))
            elif notes != legacy_notes:
                bad.append((t, "notifications", legacy_notes, notes))
    assert not bad, "\n".join(map(str, bad))


def _staff(db: Session) -> None:
    for eid, role in (("40", "hr"), ("86", "ceo"), ("87", "manager")):
        _employee(db, eid)
        _exec(db, "INSERT INTO public.ariba_auth_accounts(username,password_hash,role,employee_id) VALUES(:u,'x',:r,:e)", u=f"u{eid}", r=role, e=eid)
    _exec(db, "INSERT INTO public.ariba_role_perms(role,module,level) VALUES('hr','requests','edit')")
    _employee(db, "610", manager="87")


def _wf_state(s: Session, rid: Any, legacy: bool) -> tuple:
    """Request stage/status, the leave_requests copy, notifications (read or not) and the approve/reject actions. The
    normalized schema keeps the read time only and records an HR override under the plain stage (hr_override_x -> x)."""
    r = s.execute(text("SELECT current_stage,status FROM public.workflow_requests WHERE id=:r"), {"r": rid}).one()
    if legacy:
        lr = s.execute(text("SELECT status,mgr_status,hr_status,ceo_status FROM public.leave_requests WHERE workflow_request_id=:r"), {"r": rid}).one_or_none()
        lr = tuple(lr) if lr else None
    else:
        lr = _lr_state(s, rid)
    read = "is_read" if legacy else "read_at IS NOT NULL"
    n = sorted(tuple(x) for x in s.execute(text(f"SELECT recipient_employee_id,title,body,{read} FROM public.workflow_notifications WHERE request_id=:r"), {"r": rid}))
    a = sorted((x[0].replace("hr_override_", ""), x[1]) for x in s.execute(
        text("SELECT stage,action FROM public.workflow_actions WHERE request_id=:r AND action IN ('approved','rejected')"), {"r": rid}))
    return tuple(r), lr, n, a


_FP = {"kind": "in", "date": "2026-10-08", "time": "08:00", "notes": "x"}


@pytest.mark.parametrize("final", [False, True])
def test_hr_override_and_final_approve_match_legacy(db, final):
    """HR «اعتماد نيابة» (ariba_hr_override_workflow) and «اعتماد نهائي» (ariba_hr_final_approve) from every stage.
    The attendance a forgot-punch adds is compared without location_name (dropped by the normalization)."""
    _staff(db)
    _exec(db, "INSERT INTO public.company_settings(id) VALUES('default')")
    hr_tok = _session(db, "40", "hr")
    fn = "ariba_hr_final_approve" if final else "ariba_hr_override_workflow"
    wants = {}
    for t, p in (("annual", {"from": "2026-11-01", "to": "2026-11-02"}), ("permission", {"date": "2026-11-03", "time": "10:00", "dur": 2}),
                 ("advance", {"amount": 1000}), ("forgot_punch", _FP)):
        for start in (("hr",) if t == "forgot_punch" else ("manager", "hr", "ceo")):
            rid = uuid.uuid4()
            _exec(db, """INSERT INTO public.workflow_requests(id,employee_id,request_type,payload,manager_id,current_stage,status)
                VALUES(:r,'610',:t,CAST(:p AS jsonb),'87',:s,'pending')""", r=rid, t=t, p=json.dumps({**p, "notes": "x"}), s=start)
            if t != "forgot_punch":
                _exec(db, "INSERT INTO public.leave_requests(emp_id,type,from_date,to_date,days,status,workflow_request_id) VALUES('610',:t,'2026-11-01','2026-11-01',1,'pending',:r)", t=t, r=rid)
            _exec(db, "INSERT INTO public.workflow_notifications(recipient_employee_id,request_id,title,body,stage,kind) VALUES('87',:r,'old','old',:s,'request')", r=rid, s=start)
            sp = db.begin_nested()
            db.execute(text(f"SELECT public.{fn}(:k,:r,NULL)"), {"k": hr_tok, "r": rid})
            att = db.execute(text("SELECT time_in,late_minutes,status FROM public.attendance WHERE emp_id='610'")).all()
            wants[t, start, rid] = _wf_state(db, rid, True), att
            sp.rollback()
    route = c.hr_final_approve if final else c.hr_override_request
    bad = []
    with _normalized(db):
        for (t, start, rid), want in wants.items():
            def ours(s: Session, rid=rid):
                route(rid, {}, _Req(), {"employee_id": "40", "role": "hr", "account_id": None}, s)
                return _wf_state(s, rid, False), s.execute(text("SELECT time_in,late_minutes,status FROM public.attendance WHERE employee_id='610'")).all()

            got, err = _ours(db, ours)
            if err or got != want:
                bad.append((t, start, want, got, err))
    assert not bad, "\n".join(map(str, bad))


_DAY = date(2026, 10, 8)


def _day_early(rows: list, flex: bool) -> list:
    """Correction K (normalization): with several sessions in a flexible day the early leave is the day's — first check-in
    + shift hours (capped at the window end when that check-in was late) against the last check-out — kept on the last
    session only, as the live check-out computes it. The legacy forgot-punch measured each session from its own check-in.
    rows: (time_in, time_out, status, late, early, notes)."""
    if not flex or len(rows) < 2:
        return list(rows)
    rows = sorted(rows, key=lambda r: (r[0] is None, r[0]))
    first, last = rows[0], max(rows, key=lambda r: (r[0] is not None, r[0]))
    cs = {"flexible_enabled": True, "shift_duration_minutes": 480, "flex_window_end": time(17)}
    early = c._punch_early(cs, first[0], int(first[3] or 0), last[1]) if first[0] and last[1] else 0
    return [r[:4] + ((early if r is last else 0),) + r[5:] for r in rows]


@pytest.mark.parametrize("flex", [False, True])
def test_forgot_punch_is_applied_like_legacy(db, flex):
    """Approved «نسيان بصمة» merged into that day's attendance (ariba_apply_forgot_punch) for every kind, against no record,
    an open session, a closed one, an auto-closed one and two sessions. Compared without location_name (dropped by the
    normalization): ours runs on the same rows after the migration."""
    _exec(db, "INSERT INTO public.company_settings(id,work_start,tolerance_minutes,flexible_enabled,shift_hours,shift_duration_minutes,flex_window_start,flex_window_end) VALUES('default','08:00',15,:f,8,480,'07:00','17:00')", f=flex)
    _employee(db, "620")
    existing = {
        "none": [],
        "open": [("08:40", None, 25, "late", "")],
        "closed": [("07:50", "16:10", 0, "present", "")],
        "auto": [("09:05", "23:59", 50, "late", " | إغلاق تلقائي 23:59 (نسي بصمة الخروج)")],
        "two": [("07:55", "12:00", 0, "present", ""), ("13:00", None, 0, "present", " (دخول إضافي في نفس اليوم)")],
    }
    asks = [("in", "07:30", None), ("in", "08:20", None), ("in", "09:10", None), ("out", "15:00", None), ("out", "17:30", None),
            ("both", "07:40", "16:00"), ("both", "08:50", "17:10")]
    cols = "time_in,time_out,status,late_minutes,early_minutes,notes"
    bad = []
    for name, rows in existing.items():
        for kind, t1, t2 in asks:
            sp0 = db.begin_nested()
            for i, (a, b, late, st, note) in enumerate(rows):
                _exec(db, """INSERT INTO public.attendance(emp_id,date,time_in,time_out,status,notes,late_minutes,early_minutes,created_at)
                    VALUES('620',:d,:a,:b,:st,:n,:l,0,now()+make_interval(secs=>:i))""", d=_DAY, a=a, b=b, st=st, n="GPS" + note, l=late, i=i)
            rid = uuid.uuid4()
            payload = {"kind": kind, "date": _DAY.isoformat(), "time": t1, "notes": "x"} | ({"time2": t2} if t2 else {})
            _exec(db, "INSERT INTO public.workflow_requests(id,employee_id,request_type,payload,current_stage,status) VALUES(:r,'620','forgot_punch',CAST(:p AS jsonb),'hr','pending')",
                  r=rid, p=json.dumps(payload))
            sp = db.begin_nested()
            db.execute(text("SELECT public.ariba_apply_forgot_punch(:r)"), {"r": rid})
            want = sorted(map(tuple, _day_early(db.execute(text(f"SELECT {cols} FROM public.attendance WHERE emp_id='620'")).all(), flex)), key=str)
            sp.rollback()
            with _normalized(db):
                item = dict(db.execute(text("SELECT * FROM public.workflow_requests WHERE id=:r"), {"r": rid}).mappings().one())
                c._apply_forgot_punch(db, item)
                got = sorted(map(tuple, db.execute(text(f"SELECT {cols} FROM public.attendance WHERE employee_id='620'")).all()), key=str)
            sp0.rollback()
            if got != want:
                bad.append((name, kind, t1, t2, want, got))
    assert not bad, "\n".join(map(str, bad[:6]))


def test_employee_delete_matches_legacy_delete_request(db):
    """An employee withdraws a request: archived, removed with its rows, and HR told when it was still pending."""
    _staff(db)
    tok = _session(db, "610")
    bad = []
    for status in ("pending", "rejected", "approved"):
        rid = uuid.uuid4()
        stage = {"pending": "manager", "rejected": "rejected", "approved": "completed"}[status]  # the normalized status follows the stage
        _exec(db, "INSERT INTO public.workflow_requests(id,employee_id,request_type,payload,manager_id,current_stage,status) VALUES(:r,'610','sick','{}','87',:st,:s)", r=rid, st=stage, s=status)
        _exec(db, "INSERT INTO public.leave_requests(emp_id,type,from_date,to_date,days,status,workflow_request_id) VALUES('610','sick','2026-11-01','2026-11-01',1,:s,:r)", s=status, r=rid)
        _exec(db, "INSERT INTO public.ariba_documents(employee_id,request_id,document_type,file_name,file_data) VALUES('610',:r,'Leave Attachment','a.pdf','x')", r=rid)

        def snap(s: Session, rid=rid) -> tuple:
            left = [s.execute(text(q), {"r": rid}).scalar() for q in (
                "SELECT count(*) FROM public.workflow_requests WHERE id=:r", "SELECT count(*) FROM public.leave_requests WHERE workflow_request_id=:r",
                "SELECT count(*) FROM public.ariba_documents WHERE request_id=:r",
                "SELECT count(*) FROM public.ariba_deleted_items WHERE ref_id=CAST(:r AS text) AND snapshot ? 'documents' AND snapshot ? 'leave'")]
            told = sorted((x[0], x[1].replace("🗑 ", "")) for x in s.execute(text("SELECT recipient_employee_id,title FROM public.workflow_notifications WHERE request_id IS NULL")))
            return tuple(left), told

        out, err = _legacy(db, "SELECT public.ariba_delete_request(:k,:r)", k=tok, r=rid)
        if err:
            want = ("error", "approved" if "CANNOT_DELETE_APPROVED" in err else err)
        else:
            sp = db.begin_nested()
            db.execute(text("SELECT public.ariba_delete_request(:k,:r)"), {"k": tok, "r": rid})
            want = snap(db)
            sp.rollback()
        with _normalized(db):
            got, code = _ours(db, lambda s, rid=rid: (c.delete_my_request(rid, _Req(), {"employee_id": "610", "role": "employee", "account_id": None}, s), snap(s))[1])
        if code:
            got = ("error", code)
        if got != want:
            bad.append((status, want, got))
    assert not bad, bad


# --------------------------------------------------------------------------- labour-law corrections (LOGIC_AUDIT section 4)
def test_resignation_tiers_follow_article_85():
    from decimal import Decimal

    from app.enums import TerminationArticle as A
    from app.services.end_of_service import eos_award
    base = Decimal(9000)
    e84 = lambda y: base / 2 * min(y, 5) + base * max(0, y - 5)  # noqa: E731
    assert eos_award(base, Decimal("1.99"), A.art_85) == 0
    assert eos_award(base, Decimal("4.99"), A.art_85) == (e84(Decimal("4.99")) / 3).quantize(Decimal("0.01"))
    assert eos_award(base, Decimal(5), A.art_85) == (e84(5) * 2 / 3).quantize(Decimal("0.01"))  # 5 years exactly: two thirds (theirs)
    assert eos_award(base, Decimal("5.01"), A.art_85) == (e84(Decimal("5.01")) * 2 / 3).quantize(Decimal("0.01"))
    assert eos_award(base, Decimal(10), A.art_85) == e84(10)  # 10 years: full


def test_no_law_note_on_pending_leave():
    """Notes E/F were ours only and are removed (row 153 — docs/LOGIC_AUDIT.md section 10)."""
    assert not hasattr(c, "_law_note")


def test_hr_delete_request_archives_and_removes(db):
    """HR deletes a request (with an attachment): snapshot archived in deleted_items, request and its rows removed."""
    _staff(db)
    rid = uuid.uuid4()
    _exec(db, "INSERT INTO public.workflow_requests(id,employee_id,request_type,payload,manager_id,current_stage,status) VALUES(:r,'610','sick','{}','87','hr','pending')", r=rid)
    _exec(db, "INSERT INTO public.leave_requests(emp_id,type,from_date,to_date,days,status,workflow_request_id) VALUES('610','sick','2026-11-01','2026-11-01',1,'pending',:r)", r=rid)
    _exec(db, "INSERT INTO public.ariba_documents(employee_id,request_id,document_type,file_name,file_data) VALUES('610',:r,'Leave Attachment','a.pdf','x')", r=rid)
    def delete(s: Session) -> list:
        c.hr_delete_request(rid, _Req(), {"employee_id": "40", "role": "hr", "account_id": None}, s)
        return [s.execute(text(q), {"r": rid}).scalar() for q in (
            "SELECT count(*) FROM public.workflow_requests WHERE id=:r", "SELECT count(*) FROM public.leave_requests WHERE workflow_request_id=:r",
            "SELECT count(*) FROM public.ariba_documents WHERE request_id=:r",
            "SELECT count(*) FROM public.ariba_deleted_items WHERE ref_id=CAST(:r AS text) AND jsonb_array_length(snapshot->'documents')=1")]

    with _normalized(db):
        left, err = _ours(db, delete)
    assert err is None and left == [0, 0, 0, 1]


def test_hr_delete_letter_removes_its_rows(db):
    """A sent letter (request + 'submitted' action + HTML document + notification) is deleted without a key error."""
    _staff(db)
    with _normalized(db):
        def send_and_delete(s: Session) -> list:
            hr = {"employee_id": "40", "role": "hr", "account_id": None, "username": "u40", "name_ar": "hr"}
            sent = c.send_letter({"employee_id": "610", "title": "خطاب", "html": "<p>x</p>", "type": "custom"}, _Req(), hr, s)
            c.delete_letter(sent["id"], _Req(), hr, s)
            return [s.execute(text(q), {"r": sent["id"]}).scalar() for q in (
                "SELECT count(*) FROM public.workflow_requests WHERE id=:r", "SELECT count(*) FROM public.workflow_actions WHERE request_id=:r",
                "SELECT count(*) FROM public.ariba_documents WHERE request_id=:r", "SELECT count(*) FROM public.workflow_notifications WHERE request_id=:r")]

        left, err = _ours(db, send_and_delete)
    assert err is None and left == [0, 0, 0, 0]
