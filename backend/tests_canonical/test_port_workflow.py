"""Workflow of their sql/10 on a real database (tools/dev-db): new request types, stages per type, manager
permissions, delegation and on-behalf, HR return/reject, escalation, settings."""
from __future__ import annotations

import base64
from datetime import UTC, datetime, timedelta

from port_fixtures import login, sql

PDF = base64.b64encode(b"%PDF-1.4 test").decode()


def _submit(api, user, body):
    return api.post("/api/v1/me/requests", json=body, headers=login(api, user))


def test_unpaid_leave_needs_a_reason_and_ends_at_hr(api, port_engine):
    r = _submit(api, "emp.test", {"type": "unpaid", "from_date": "2026-12-01", "to_date": "2026-12-03"})
    assert r.status_code == 422 and "سبب" in r.text
    r = _submit(api, "emp.test", {"type": "unpaid", "from_date": "2026-12-01", "to_date": "2026-12-03", "notes": "سفر"})
    assert r.status_code == 201, r.text
    rid = r.json()["id"]
    row = sql(port_engine, "SELECT current_stage,payload FROM workflow_requests WHERE id=:i", i=rid)[0]
    assert row["current_stage"] == "manager" and row["payload"]["days"] == 3  # calendar days
    # manager approves → HR (final for unpaid: no CEO stage)
    assert api.post(f"/api/v1/me/approvals/{rid}", json={"action": "approve"}, headers=login(api, "mgr.test")).status_code == 200
    assert sql(port_engine, "SELECT current_stage FROM workflow_requests WHERE id=:i", i=rid)[0]["current_stage"] == "hr"
    r = api.post(f"/api/v1/me/approvals/{rid}", json={"action": "approve"}, headers=login(api, "hr.test"))
    assert r.status_code == 200, r.text
    assert sql(port_engine, "SELECT status FROM workflow_requests WHERE id=:i", i=rid)[0]["status"] == "approved"


def test_salary_advance_is_capped_and_one_at_a_time(api, port_engine):
    total = sql(port_engine, "SELECT (data->>'salaryTotal')::numeric AS t FROM employee_directory WHERE employee_id='51'")[0]["t"]
    r = _submit(api, "emp.test", {"type": "salary_advance", "amount": float(total) + 1, "notes": "ظرف"})
    assert r.status_code == 422 and r.json()["error"]["code"] == "ADVANCE_OVER_LIMIT"
    assert _submit(api, "emp.test", {"type": "salary_advance", "amount": 500, "notes": "ظرف"}).status_code == 201
    r = _submit(api, "emp.test", {"type": "salary_advance", "amount": 300, "notes": "ظرف"})
    assert r.status_code == 409


def test_profile_edit_goes_to_hr_and_applies_on_approval(api, port_engine):
    r = _submit(api, "emp.test", {"type": "profile_edit", "payload": {"changes": {"mobile": "0500000001", "salary": "999999"}}})
    assert r.status_code == 201, r.text
    rid = r.json()["id"]
    row = sql(port_engine, "SELECT current_stage,payload FROM workflow_requests WHERE id=:i", i=rid)[0]
    assert row["current_stage"] == "hr" and row["payload"]["changes"] == {"mobile": "0500000001"}  # only allowed fields
    assert api.post(f"/api/v1/requests/{rid}/override", json={}, headers=login(api, "hr.test")).status_code == 200
    assert sql(port_engine, "SELECT data->>'mobile' AS m FROM employee_directory WHERE employee_id='51'")[0]["m"] == "0500000001"


def test_iban_change_requires_certificate_and_updates_the_employee(api, port_engine):
    base = {"type": "iban_change", "payload": {"iban": "SA4420000001234567891234", "bank": "الأهلي", "account_no": "123", "letter_html": "<p>خطاب</p>"}}
    assert _submit(api, "emp52.test", base).status_code == 422
    r = _submit(api, "emp52.test", {**base, "attachment": {"name": "cert.pdf", "mime": "application/pdf", "data": PDF}})
    assert r.status_code == 201, r.text
    rid = r.json()["id"]
    assert sql(port_engine, "SELECT count(*) AS n FROM ariba_documents WHERE request_id=:i AND document_type='iban_certificate'", i=rid)[0]["n"] == 1
    assert api.post(f"/api/v1/requests/{rid}/final-approve", json={}, headers=login(api, "hr.test")).status_code == 200
    e = sql(port_engine, "SELECT data->>'iban' AS iban, data->>'accountNo' AS acc FROM employee_directory WHERE employee_id='52'")[0]
    assert e == {"iban": "SA4420000001234567891234", "acc": "123"}
    assert sql(port_engine, "SELECT count(*) AS n FROM ariba_documents WHERE request_id=:i AND document_type='iban_letter'", i=rid)[0]["n"] == 1


def test_document_upload_goes_to_hr_with_its_file(api, port_engine):
    r = _submit(api, "emp53.test", {"type": "document", "payload": {"doc_type": "passport", "doc_label": "جواز السفر"},
                                    "attachment": {"name": "p.pdf", "mime": "application/pdf", "data": PDF}})
    assert r.status_code == 201, r.text
    row = sql(port_engine, "SELECT current_stage FROM workflow_requests WHERE id=:i", i=r.json()["id"])[0]
    assert row["current_stage"] == "hr"


def test_manager_without_approve_permission_cannot_act(api, port_engine):
    rid = _submit(api, "emp54.test", {"type": "sick", "from_date": "2026-11-10", "to_date": "2026-11-10"}).json()["id"]
    assert api.put("/api/v1/settings/manager-perms/50", json={"perms": {"approve_requests": False}}, headers=login(api, "emp.test")).status_code == 403
    assert api.put("/api/v1/settings/manager-perms/50", json={"perms": {"approve_requests": False}}, headers=login(api, "hr.test")).status_code == 200
    assert api.post(f"/api/v1/me/approvals/{rid}", json={"action": "approve"}, headers=login(api, "mgr.test")).status_code == 403
    assert api.put("/api/v1/settings/manager-perms/50", json={"perms": {"approve_requests": True, "view_team": True, "submit_for_team": True,
                                                                         "view_team_requests": True, "view_team_leaves": True}},
                   headers=login(api, "admin.test")).status_code == 200
    assert api.post(f"/api/v1/me/approvals/{rid}", json={"action": "approve"}, headers=login(api, "mgr.test")).status_code == 200


def test_submit_on_behalf_needs_the_employee_delegation(api, port_engine):
    body = {"type": "sick", "from_date": "2026-11-20", "to_date": "2026-11-21", "notes": "مرض"}
    r = api.post("/api/v1/me/team/55/requests", json=body, headers=login(api, "mgr.test"))
    assert r.status_code == 403 and r.json()["error"]["code"] == "NOT_DELEGATED"
    assert api.put("/api/v1/me/delegation", json={"active": True}, headers=login(api, "emp55.test")).json() == {"active": True}
    assert api.get("/api/v1/me/delegation", headers=login(api, "emp55.test")).json()["active"] is True
    r = api.post("/api/v1/me/team/55/requests", json=body, headers=login(api, "mgr.test"))
    assert r.status_code == 201, r.text
    row = sql(port_engine, "SELECT current_stage,submitted_by_employee_id AS by,payload FROM workflow_requests WHERE id=:i", i=r.json()["id"])[0]
    assert row["current_stage"] == "hr" and row["by"] == "50" and row["payload"]["submitted_by_manager"] == "50"
    assert api.post("/api/v1/me/team/63/requests", json=body, headers=login(api, "mgr.test")).status_code == 403  # not his team


def test_team_view_and_requests_follow_the_permissions(api):
    team = api.get("/api/v1/me/team", headers=login(api, "mgr.test")).json()
    assert {m["id"] for m in team} >= {"51", "52"} and "leave_balance" in team[0] and "salary_total" not in team[0]
    assert api.get("/api/v1/me/manager-perms", headers=login(api, "mgr.test")).json()["is_manager"] is True
    assert api.get("/api/v1/me/manager-perms", headers=login(api, "emp.test")).json()["is_manager"] is False
    assert api.get("/api/v1/me/team/requests", headers=login(api, "mgr.test")).status_code == 200


def test_hr_return_and_reject_with_reason(api, port_engine):
    rid = _submit(api, "emp56.test", {"type": "emergency", "from_date": "2026-11-25", "to_date": "2026-11-25"}).json()["id"]
    api.post(f"/api/v1/me/approvals/{rid}", json={"action": "approve"}, headers=login(api, "mgr.test"))
    assert api.post(f"/api/v1/requests/{rid}/return", json={"note": "x"}, headers=login(api, "hr.test")).status_code == 422
    r = api.post(f"/api/v1/requests/{rid}/return", json={"note": "راجع التواريخ"}, headers=login(api, "hr.test"))
    assert r.status_code == 200 and r.json()["current_stage"] == "manager" and r.json()["return_note"] == "راجع التواريخ"
    assert api.post(f"/api/v1/requests/{rid}/reject", json={}, headers=login(api, "hr.test")).status_code == 422
    r = api.post(f"/api/v1/requests/{rid}/reject", json={"reason": "غير مكتمل"}, headers=login(api, "hr.test"))
    assert r.status_code == 200 and r.json()["status"] == "rejected"


def test_escalation_moves_old_manager_requests_to_hr(api, port_engine):
    rid = _submit(api, "emp57.test", {"type": "marriage", "from_date": "2026-12-10", "to_date": "2026-12-14"}).json()["id"]
    sql(port_engine, "UPDATE workflow_requests SET updated_at=:t WHERE id=:i", t=datetime.now(UTC) - timedelta(days=4), i=rid)
    r = api.post("/api/v1/requests/escalate", headers=login(api, "hr.test"))
    assert r.status_code == 200 and r.json()["escalated"] >= 1
    row = sql(port_engine, "SELECT current_stage,escalated_from FROM workflow_requests WHERE id=:i", i=rid)[0]
    assert row == {"current_stage": "hr", "escalated_from": "manager"}


def test_workflow_settings_round_trip_and_validation(api):
    h = login(api, "hr.test")
    cfg = api.get("/api/v1/settings/workflow", headers=h).json()["config"]
    assert cfg["manager_wait_days"] == 3 and cfg["final_by_type"]["unpaid"] == "hr"
    assert api.put("/api/v1/settings/workflow", json={"extra_hr_emails": ["bad"]}, headers=h).status_code == 422
    r = api.put("/api/v1/settings/workflow", json={"manager_wait_days": 5, "extra_hr_emails": ["hr2@example.com"]}, headers=h)
    assert r.status_code == 200 and r.json()["config"]["manager_wait_days"] == 5
    api.put("/api/v1/settings/workflow", json={"manager_wait_days": 3}, headers=h)


def test_staff_queue_and_requests_lists(api):
    q = api.get("/api/v1/staff/queue", headers=login(api, "hr.test")).json()["queue"]
    assert q and {"request_type", "payload", "current_stage"} <= set(q[0]["request"]) and q[0]["employee"].get("nameAr")
    assert api.get("/api/v1/staff/requests", headers=login(api, "emp.test")).status_code == 403
