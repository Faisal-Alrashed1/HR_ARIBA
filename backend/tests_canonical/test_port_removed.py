"""Task 4 of the React port: every rule only we had (🟣 in the comparison file) is gone and the behaviour is theirs.
The site-side items (A/B/C/D/G/J in the EOS page, settlement and PAYX) are proven by tools/legacy-parity
("تصحيحات نظام العمل (أُلغيت)") and tools/react-parity; docs/LOGIC_AUDIT.md section 10 lists each item."""
from __future__ import annotations

import uuid
from datetime import date, datetime, time
from decimal import Decimal
from types import SimpleNamespace

import pytest

from app.enums import TerminationArticle as A
from app.routers import canonical as c
from app.services import contracts
from app.services.end_of_service import eos_award
from app.services.leave import HolidayCalendar, LeaveBook


class DB:
    def __init__(self):
        self.statements = []

    def execute(self, statement, params=None):
        self.statements.append((str(statement), params or {}))
        return SimpleNamespace(rowcount=1)

    def scalar(self, statement, params=None):
        self.statements.append((str(statement), params or {}))
        return 1

    def commit(self):
        pass


# ---- row 66: no automatic termination; saving brings a terminated employee back unless the fixed contract expired
def test_no_automatic_contract_termination_exists():
    assert not hasattr(contracts, "apply_auto_terminations")
    assert not hasattr(c, "_reactivate_if_renewed")


@pytest.mark.parametrize("data,back", [
    ({"contractNature": "fixed", "contractEnd": "2099-01-01", "terminationReason": "استقالة", "lastDay": "2026-01-01"}, True),
    ({"contractNature": "indefinite", "terminationReason": "فصل"}, True),
    ({"contractNature": "fixed", "contractEnd": "2020-01-01", "terminationReason": "انتهاء مدة العقد"}, False),
])
def test_save_reactivates_like_their_employee_form(data, back):
    d = {**data, "isTerminated": True, "term": True}
    assert c._reactivate_on_save(d, True) is back
    assert d["isTerminated"] is (not back)
    if back:
        assert d["terminationReason"] == "" and d["lastDay"] == ""


def test_save_of_an_active_employee_changes_nothing():
    d = {"contractNature": "fixed", "contractEnd": "2020-01-01"}
    assert c._reactivate_on_save(d, False) is False and "isTerminated" not in d


# ---- row 69/A in the backend award: exactly 5 years of resignation = two thirds (theirs)
def test_resignation_at_exactly_five_years_is_two_thirds():
    assert eos_award(Decimal(10000), Decimal(5), A.art_85) == Decimal("16666.67")
    assert eos_award(Decimal(10000), Decimal("4.99"), A.art_85) == Decimal("8316.67")


# ---- rows 100 / 114: the leave engine has no 2024 carry rule and no frozen balance for a terminated employee
def _book(today=date(2026, 10, 18)):
    return LeaveBook(holidays=HolidayCalendar([]), leaves=[], adjustments=[], today=today, method="calendar", carry={"enabled": True, "days": 10})


def test_carry_into_2024_is_the_normal_cap():
    book, e = _book(), {"id": "1", "contractJoin": "2019-01-01", "leaveDaysContract": 30}
    assert book.carry_forward(e, 2024) == min(10, book.year_closing(e, 2023))


def test_terminated_employee_balance_is_not_frozen():
    book = _book()
    active = {"id": "1", "contractJoin": "2022-01-01", "leaveDaysContract": 21, "isTerminated": False}
    ended = {**active, "id": "2", "isTerminated": True, "terminationDate": "2025-06-30", "lastDay": "2025-06-30"}
    assert book.current(ended) == book.current(active)


# ---- row 137 (K): a second check-in no longer clears the previous session's early-leave minutes
def test_second_check_in_keeps_the_previous_session_early_minutes(monkeypatch):
    db = DB()
    first = {"id": uuid.uuid4(), "time_in": time(8), "time_out": time(10), "late_minutes": 0, "status": "present"}
    inserted = {"id": uuid.uuid4(), "time_in": time(11), "time_out": None}

    def fake_row(_db, sql, **_kw):
        if "FROM public.employee_directory d" in sql:
            return {"employee_id": "e1", "active": True, "employer_id": None, "data": {}}
        if "FROM public.company_settings" in sql:
            return {"flexible_enabled": True, "shift_duration_minutes": 480, "flex_window_start": time(7), "flex_window_end": time(17), "tolerance_minutes": 15}
        if "time_out IS NULL ORDER BY created_at DESC" in sql:
            return None
        if "ORDER BY time_in ASC" in sql:
            return first
        if "INSERT INTO public.attendance" in sql:
            return inserted
        return None

    monkeypatch.setattr(c, "_row", fake_row)
    monkeypatch.setattr(c, "_rows", lambda *_a, **_k: [{"id": "loc", "type": "project", "polygon": None, "latitude": 0, "longitude": 0, "radius_m": 200}])
    monkeypatch.setattr(c, "_app_setting", lambda *_a, **_k: None)
    monkeypatch.setattr(c, "_write_audit", lambda *_a, **_k: None)
    monkeypatch.setattr(c, "_attendance_row", lambda _db, r: r)
    c.punch({"action": "in", "lat": 0, "lng": 0}, request=None, actor={"employee_id": "e1"}, db=db)
    assert not any("early_minutes=0 WHERE id=" in sql for sql, _ in db.statements)


# ---- row 153 (E/F): no labour-law note on requests
def test_requests_carry_no_law_note(monkeypatch):
    monkeypatch.setattr(c, "_row", lambda *_a, **_k: None)
    out = c._workflow_out(None, {"id": uuid.uuid4(), "employee_id": "e1", "request_type": "sick", "status": "pending",
                                 "current_stage": "hr", "payload": {"from": "2026-10-01", "to": "2026-12-30", "days": 91},
                                 "created_at": datetime(2026, 10, 1)})
    assert "law_note" not in out and not hasattr(c, "_law_note")


# ---- row 188: no lock-out after failed sign-ins (and the attempts table is not read)
def test_failed_sign_ins_never_lock_the_account(monkeypatch):
    db = DB()
    monkeypatch.setattr(c, "_row", lambda _db, sql, **_k: (_ for _ in ()).throw(AssertionError(sql)) if "login_attempts" in sql else None)
    monkeypatch.setattr(c, "_write_audit", lambda *_a, **_k: None)
    for _ in range(60):
        with pytest.raises(c.ApiError) as err:
            c.login({"username": "someone", "password": "wrong"}, request=SimpleNamespace(client=None), db=db)
        assert err.value.status == 401
    assert not any("login_attempts" in sql for sql, _ in db.statements)
