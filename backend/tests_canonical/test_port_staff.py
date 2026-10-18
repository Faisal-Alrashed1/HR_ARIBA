"""The HR program's data calls in their shapes (port_staff): leaves, holidays, locations, attendance, overtime,
documents, templates, account reset, termination, payroll draft/sync/archive, the bell, attendance settings, my perms."""
from __future__ import annotations

import base64

from port_fixtures import login, sql

V1 = "/api/v1"
B64 = base64.b64encode(b"%PDF-1.4 x").decode()


def h(api, u):
    return login(api, u)


def test_my_perms_follow_the_matrix(api):
    hr = api.get(f"{V1}/me/perms", headers=h(api, "hr.test")).json()
    assert hr["ok"] and hr["role"] == "hr" and hr["perms"]["employees"] == "edit" and hr["perms"]["payroll_approve"] == "none"
    adm = api.get(f"{V1}/me/perms", headers=h(api, "admin.test")).json()
    assert all(v == "edit" for v in adm["perms"].values())


def test_hr_leave_record_update_and_delete(api, port_engine):
    body = {"employee_id": "54", "hr_leave_id": "hr-lv-1", "type": "annual", "from": "2026-11-02", "to": "2026-11-04", "days": 3, "notes": "x", "status": "approved"}
    assert api.post(f"{V1}/staff/leaves", json=body, headers=h(api, "emp.test")).status_code == 403
    assert api.post(f"{V1}/staff/leaves", json=body, headers=h(api, "hr.test")).status_code == 200
    lv = next(x for x in api.get(f"{V1}/staff/leaves", headers=h(api, "hr.test")).json()["leaves"] if x["id"] == "hr-lv-1")
    assert lv["hr"] and lv["status"] == "approved" and lv["from"] == "2026-11-02" and lv["days"] == 3
    api.post(f"{V1}/staff/leaves", json={**body, "status": "rejected"}, headers=h(api, "hr.test"))
    rows = sql(port_engine, "SELECT status FROM workflow_requests WHERE payload->>'hr_leave_id'='hr-lv-1'")
    assert rows == [{"status": "rejected"}]  # same record, new status
    assert api.delete(f"{V1}/staff/leaves/hr-lv-1", headers=h(api, "hr.test")).status_code == 200
    assert sql(port_engine, "SELECT count(*) AS n FROM workflow_requests WHERE payload->>'hr_leave_id'='hr-lv-1'")[0]["n"] == 0


def test_holidays_sync_replaces_the_list(api):
    hol = api.get(f"{V1}/staff/holidays", headers=h(api, "hr.test")).json()
    new = hol + [{"id": "h-test", "name": "عطلة تجربة", "date": "2026-12-01", "days": 2, "recurring": False}]
    assert api.put(f"{V1}/staff/holidays", json={"holidays": new}, headers=h(api, "hr.test")).json()["count"] == len(new)
    assert any(x["id"] == "h-test" and x["days"] == 2 for x in api.get(f"{V1}/staff/holidays", headers=h(api, "hr.test")).json())
    assert api.put(f"{V1}/staff/holidays", json={"holidays": hol}, headers=h(api, "hr.test")).status_code == 200


def test_locations_upsert_and_deactivate(api):
    loc = {"id": "L-test", "name": "موقع تجربة", "employer": "all", "type": "project", "latitude": 24.7, "longitude": 46.7, "radius_m": 20}
    assert api.post(f"{V1}/staff/locations", json={"location": loc}, headers=h(api, "hr.test")).status_code == 200
    got = next(x for x in api.get(f"{V1}/staff/locations", headers=h(api, "hr.test")).json()["locations"] if x["id"] == "L-test")
    assert got["radius_m"] == 50 and got["lat"] == 24.7  # radius kept within 50–5000 as their screen
    assert api.delete(f"{V1}/staff/locations/L-test", headers=h(api, "hr.test")).status_code == 200
    assert not next(x for x in api.get(f"{V1}/staff/locations", headers=h(api, "hr.test")).json()["locations"] if x["id"] == "L-test")["active"]


def test_attendance_manual_record_and_range(api):
    rec = {"employee_id": "55", "date": "2026-10-05", "time_in": "08:10", "time_out": "16:00", "status": "late"}
    assert api.put(f"{V1}/staff/attendance", json=rec, headers=h(api, "hr.test")).status_code == 200
    rows = api.get(f"{V1}/staff/attendance/range", params={"date_from": "2026-10-05", "date_to": "2026-10-05", "employee_id": "55"}, headers=h(api, "hr.test")).json()
    assert len(rows) == 1 and rows[0]["emp_id"] == "55" and rows[0]["time_in"] == "08:10:00" and rows[0]["status"] == "late"
    day = api.get(f"{V1}/staff/attendance", params={"day": "2026-10-05"}, headers=h(api, "hr.test")).json()["attendance"]
    assert any(r["employee_id"] == "55" for r in day)


def test_overtime_by_hr_goes_through_the_workflow(api, port_engine):
    r = api.post(f"{V1}/staff/overtime", json={"employee_id": "56", "payload": {"date": "2026-10-06", "hours": 2, "notes": "جرد"}}, headers=h(api, "hr.test"))
    assert r.status_code == 200, r.text
    assert r.json()["request_type"] == "overtime" and r.json()["current_stage"] in ("manager", "hr")


def test_documents_and_templates(api, port_engine):
    d = api.post(f"{V1}/staff/documents", json={"employee_id": "80", "document_type": "contract", "file_name": "c.pdf", "mime_type": "application/pdf", "base64": B64},
                 headers=h(api, "hr.test"))
    assert d.status_code == 200
    docs = api.get(f"{V1}/staff/documents/80", headers=h(api, "hr.test")).json()["documents"]
    assert any(x["id"] == d.json()["id"] for x in docs)
    content = api.get(f"{V1}/documents/{d.json()['id']}/content", headers=h(api, "hr.test")).json()
    assert base64.b64decode(content["base64"]).startswith(b"%PDF")
    html = base64.b64encode("<p>نموذج</p>".encode()).decode()
    t = api.post(f"{V1}/staff/templates", json={"employee_id": "80", "template_type": "experience", "title": "شهادة خبرة", "base64": html}, headers=h(api, "hr.test"))
    assert t.status_code == 200
    st = api.get(f"{V1}/staff/templates", headers=h(api, "hr.test")).json()
    assert any(x["template_type"] == "experience" and x["status"] == "pending" for x in st)


def test_reset_password_and_terminate(api, port_engine):
    r = api.post(f"{V1}/staff/employees/82/reset-password", headers=h(api, "hr.test"))
    assert r.status_code == 200 and r.json()["username"] and len(r.json()["temporary_password"]) == 10
    t = api.post(f"{V1}/staff/employees/82/terminate", json={"reason": "استقالة", "last_day": "2026-10-31"}, headers=h(api, "hr.test"))
    assert t.status_code == 200
    row = sql(port_engine, "SELECT active,data->>'lastDay' AS d FROM employee_directory WHERE employee_id='82'")[0]
    assert row == {"active": False, "d": "2026-10-31"}


def test_payroll_draft_sync_and_their_approval_rules(api, port_engine):
    rows = [{"id": "51", "nameAr": "موظف", "workDays": 30, "otherDeduct": 0, "idx": 1}]
    assert api.put(f"{V1}/staff/payroll/2026/8", json={"rows": rows}, headers=h(api, "hr.test")).status_code == 200
    d = api.get(f"{V1}/staff/payroll/2026/8", headers=h(api, "hr.test")).json()
    assert d["approved"] is False and d["rows"][0]["employee_id"] == "51" and d["rows"][0]["payload"]["workDays"] == 30
    rows[0]["otherDeduct"] = 150
    api.put(f"{V1}/staff/payroll/2026/8", json={"rows": rows}, headers=h(api, "hr.test"))
    log = sql(port_engine, "SELECT action,summary FROM ariba_audit_log WHERE module='payroll' ORDER BY id DESC LIMIT 1")[0]
    assert log["action"] == "تعديل يدوي في المسير" and "خصومات أخرى" in log["summary"]  # their logPayEdit, server side
    no = api.put(f"{V1}/staff/payroll/2026/8", json={"rows": rows, "approved": True}, headers=h(api, "fin.test"))
    assert no.json()["error"]["code"] == "PAYROLL_NOT_PREPARED"
    assert api.post(f"{V1}/sheets/pay_2026_08/prepare", json={}, headers=h(api, "hr.test")).status_code == 200
    assert api.put(f"{V1}/staff/payroll/2026/8", json={"rows": rows, "approved": True}, headers=h(api, "hr.test")).json()["error"]["code"] == "APPROVAL_REQUIRES_FINANCE"
    assert api.put(f"{V1}/staff/payroll/2026/8", json={"rows": rows, "approved": True}, headers=h(api, "fin.test")).json()["approved"] is True
    assert api.put(f"{V1}/staff/payroll/2026/8", json={"rows": rows}, headers=h(api, "hr.test")).json()["error"]["code"] == "PAYROLL_APPROVED_LOCKED"
    arch = api.get(f"{V1}/staff/payroll-archive", params={"year": 2026, "month": 8}, headers=h(api, "fin.test")).json()["archives"]
    assert len(arch) == 1 and arch[0]["rows"][0]["otherDeduct"] == 150


def test_bell_and_attendance_settings(api):
    n = api.get(f"{V1}/staff/notifications", headers=h(api, "hr.test")).json()
    assert {"items", "unread"} <= set(n)
    assert api.put(f"{V1}/staff/attendance-settings", json={"work_start": "08:30:00", "tolerance_minutes": 10, "remote_days_per_year": 12},
                   headers=h(api, "hr.test")).status_code == 200
    s = api.get(f"{V1}/settings/attendance", headers=h(api, "hr.test")).json()
    assert str(s["work_start"]).startswith("08:30") and s["tolerance_minutes"] == 10 and s["remote_days_per_year"] == 12
    assert api.put(f"{V1}/staff/flexible-hours", json={"enabled": True, "shift_hours": 8, "window_start": "07:00:00", "window_end": "18:00:00"},
                   headers=h(api, "hr.test")).status_code == 200
    assert api.put(f"{V1}/staff/flexible-hours", json={"enabled": True, "shift_hours": 8, "window_start": "18:00", "window_end": "07:00"},
                   headers=h(api, "hr.test")).status_code == 422
