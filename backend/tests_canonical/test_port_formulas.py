"""Task 3 of the React port: our backend gives their formula (docs/LOGIC_AUDIT.md section 9). The bulk comparison runs
in tools/react-parity; these pin the cases each comparison-file row is about."""
from __future__ import annotations

from datetime import date, time

from app.routers import canonical as c
from app.services import schedule

TODAY = date(2026, 10, 18)


def _emp(i: str, **data):
    return {"employee_id": i, "name_ar": "x", "name_en": None, "active": True, "data": {"empNo": i, **data}}


def _kinds(rows):
    return {(a["employee"]["id"], a["kind"]): a["days_left"] for a in c._dashboard_alerts(rows, TODAY)}


def test_alerts_use_their_v142_limits_and_no_medical_insurance():  # rows 147, 61
    got = _kinds([_emp("1", iqamaExpiry="2026-12-17", passportExpiry="2027-01-16", insuranceExpiry="2026-10-20"),
                  _emp("2", iqamaExpiry="2026-12-18", passportExpiry="2027-01-17", contractEnd="2026-12-17")])
    assert got == {("1", "iqama"): 60, ("1", "passport"): 90, ("2", "contract"): 60}


def test_contract_alert_from_join_plus_duration_with_js_month_overflow():  # row 147
    # 2025-12-31 + 10 months = new Date(2025, 21, 31) = 2026-10-31 (JS); not for an open-ended contract
    got = _kinds([_emp("1", contractJoin="2025-12-31", contractDuration=10),
                  _emp("2", contractJoin="2025-12-31", contractDuration=10, contractNature="غير محدد")])
    assert got == {("1", "contract"): 13}


def test_probation_alert_only_theirs_and_not_for_consultants():  # row 148
    got = _kinds([_emp("1", contractJoin="2026-07-25"),  # join + 90 = 2026-10-23 → 5 days
                  _emp("2", contractJoin="2026-07-25", jobTitle="استشاري أول"),
                  _emp("3", contractJoin="2026-07-10", probationEnd="2026-10-10"),  # 8 days ago: < −7
                  _emp("4", contractJoin="2025-08-01", probationEnd="2026-10-25")])  # joined > 400 days ago
    assert got == {("1", "probation"): 5}


def test_alerts_are_sorted_by_days_left():
    al = c._dashboard_alerts([_emp("1", iqamaExpiry="2026-11-30"), _emp("2", passportExpiry="2026-10-19")], TODAY)
    assert [a["days_left"] for a in al] == [1, 43]


def test_ramadan_manual_dates_win_over_the_hijri_month():  # rows 125–126
    assert schedule.is_ramadan(date(2026, 2, 18), None)  # 1 Ramadan 1447 (Umm al-Qura)
    assert not schedule.is_ramadan(date(2026, 3, 20), None)  # 1 Shawwal
    cfg = {"ramadanFrom": "2026-02-19", "ramadanTo": "2026-03-20"}
    assert not schedule.is_ramadan(date(2026, 2, 18), cfg) and schedule.is_ramadan(date(2026, 3, 20), cfg)
    assert schedule.schedule_for(date(2026, 3, 1), None)["kind"] == "ramadan"
    assert schedule.schedule_for(date(2026, 3, 1), {"ramadanAuto": False})["start"] == "08:00"


def test_ramadan_flexible_hours_replace_the_window_during_ramadan(monkeypatch):  # missing ariba_hr_set_ramadan_flex
    monkeypatch.setattr(c, "_app_setting", lambda db, key: {"enabled": True, "window_start": "10:00", "window_end": "16:00", "shift_hours": 5} if key == "ramadan_flex" else None)
    cs = {"flexible_enabled": False, "shift_duration_minutes": 480, "flex_window_start": time(8), "flex_window_end": time(17)}
    r = c._effective_cs(None, cs, date(2026, 3, 1))
    assert r["flexible_enabled"] and r["shift_duration_minutes"] == 300 and r["flex_window_end"] == time(16)
    assert c._effective_cs(None, cs, date(2026, 5, 1)) is cs


def test_session_lasts_24_hours_like_theirs():  # row 187
    assert c.SESSION_HOURS == 24 and c.SESSION_MAX_HOURS == 24
