"""The other ported routes on a real database (tools/dev-db): candidates and the public apply page, employees (with the
audit diff), targets and evaluations, leave files, mail, tasks, assets, the audit log and month purge, settings,
permissions, payroll prepare → approve → reopen, password recovery, push tokens and WebAuthn options."""
from __future__ import annotations

import base64

import pytest
from sqlalchemy import text

from port_fixtures import login, sql

V1 = "/api/v1"
PDF = base64.b64encode(b"%PDF-1.4 test").decode()


def h(api, user):
    return login(api, user)


# ---------------------------------------------------------------- candidates / public apply
def _apply(api, **kw):
    body = {"data": {"nameAr": "مرشح تجريبي", "mobile": "0500000099", "email": kw.pop("email", "cand@example.com"), "position": "محاسب",
                     "website": kw.pop("website", "")},
            "files": [{"type": "cv", "name": "cv.pdf", "mime": "application/pdf", "base64": PDF}], **kw}
    return api.post(f"{V1}/public/apply", json=body)


def test_public_apply_needs_the_form_key_then_hr_accepts(api, port_engine):
    assert _apply(api).json()["error"]["code"] == "FORM_CLOSED"
    key = api.post(f"{V1}/candidates/apply-key/rotate", headers=h(api, "hr.test")).json()["form_key"]
    n = sql(port_engine, "SELECT count(*) AS n FROM ariba_candidates")[0]["n"]
    honeypot = _apply(api, form_key=key, email="bot@example.com", website="http://spam")
    assert honeypot.status_code == 200 and honeypot.json()["ok"]  # answered as if it worked, nothing stored
    assert sql(port_engine, "SELECT count(*) AS n FROM ariba_candidates")[0]["n"] == n
    r = _apply(api, form_key=key)
    assert r.status_code == 200, r.text
    assert _apply(api, form_key=key).status_code == 429  # same e-mail within 10 minutes
    assert api.get(f"{V1}/candidates", headers=h(api, "emp.test")).status_code == 403
    items = api.get(f"{V1}/candidates", headers=h(api, "hr.test")).json()
    cand = next(x for x in items["candidates"] if x["ref"] == r.json()["ref"])
    assert cand["files"][0]["type"] == "cv"
    acc = api.post(f"{V1}/candidates/{cand['id']}/accept", json={"em": "شركة تجريبية", "join": "2026-11-01", "sal": 5000},
                   headers=h(api, "hr.test"))
    assert acc.status_code == 200, acc.text
    eid = acc.json()["emp"]["id"]
    assert sql(port_engine, "SELECT name_ar FROM employee_directory WHERE employee_id=:e", e=eid)[0]["name_ar"] == "مرشح تجريبي"
    assert sql(port_engine, "SELECT count(*) AS n FROM ariba_documents WHERE employee_id=:e", e=eid)[0]["n"] >= 1


def test_invite_link_is_single_use(api):
    inv = api.post(f"{V1}/candidates/invites", json={"name": "مدعو", "hours": 24}, headers=h(api, "hr.test"))
    assert inv.status_code == 200, inv.text
    token = inv.json()["token"]
    assert api.get(f"{V1}/public/apply/invite/{token}").json()["status"] == "ok"
    assert _apply(api, invite=token, email="invited@example.com").status_code == 200
    assert api.get(f"{V1}/public/apply/invite/{token}").json()["status"] == "used"
    assert _apply(api, invite=token, email="again@example.com").json()["error"]["code"] == "INVITE_USED"


# ---------------------------------------------------------------- employees + audit diff
def test_employee_save_writes_field_changes_to_the_audit_log(api, port_engine):
    emp = api.get(f"{V1}/staff/employees", headers=h(api, "hr.test")).json()["employees"]
    e = next(x for x in emp if x["id"] == "53")["data"]
    r = api.put(f"{V1}/staff/employees/53", json={"employee": {**e, "mobile": "0555555555"}}, headers=h(api, "hr.test"))
    assert r.status_code == 200, r.text
    log = sql(port_engine, "SELECT action,summary,details FROM ariba_audit_log WHERE entity_id='53' ORDER BY id DESC LIMIT 1")[0]
    assert log["action"] == "تعديل بيانات موظف" and "الجوال" in log["summary"]
    assert any(c["field"] == "mobile" and c["new"] == "0555555555" for c in log["details"]["changes"])
    # saving the same record again writes nothing
    n = sql(port_engine, "SELECT count(*) AS n FROM ariba_audit_log")[0]["n"]
    api.put(f"{V1}/staff/employees/53", json={"employee": {**e, "mobile": "0555555555"}}, headers=h(api, "hr.test"))
    assert sql(port_engine, "SELECT count(*) AS n FROM ariba_audit_log")[0]["n"] == n


def test_employee_cannot_edit_records(api):
    assert api.put(f"{V1}/staff/employees/51", json={"employee": {"id": "51", "nameAr": "x"}}, headers=h(api, "emp.test")).status_code == 403


# ---------------------------------------------------------------- targets and evaluations
def test_manager_sets_targets_and_evaluates(api, port_engine):
    t = api.post(f"{V1}/targets", json={"employee_id": "54", "period_type": "annual", "period_key": "2026", "title": "مبيعات",
                                        "target_value": 100, "actual_value": 80}, headers=h(api, "mgr.test"))
    assert t.status_code == 200, t.text
    assert api.post(f"{V1}/targets", json={"employee_id": "40", "period_type": "annual", "period_key": "2026", "title": "x"},
                    headers=h(api, "mgr.test")).status_code == 403  # not his team
    goals = api.get(f"{V1}/me/goals", headers=h(api, "emp54.test")).json()
    assert any(x["title"] == "مبيعات" for x in goals["targets"])
    ev = api.put(f"{V1}/evaluations/54/annual/2026", json={"items": [{"title": "مبيعات", "score": 80, "weight": 1}], "submit": True},
                 headers=h(api, "mgr.test"))
    assert ev.status_code == 200, ev.text
    assert ev.json()["evaluation"]["status"] == "pending"
    ok = api.post(f"{V1}/evaluations/{ev.json()['evaluation']['id']}/approve", headers=h(api, "ceo.test"))
    assert ok.status_code == 200, ok.text
    locked = api.put(f"{V1}/evaluations/54/annual/2026", json={"items": [{"title": "a", "score": 1}]}, headers=h(api, "mgr.test"))
    assert locked.status_code == 409


# ---------------------------------------------------------------- leave files
def test_leave_files(api):
    r = api.post(f"{V1}/leave-files", json={"employee_id": "51", "leave_id": "L-1", "file_name": "a.pdf", "mime_type": "application/pdf",
                                            "base64": PDF}, headers=h(api, "hr.test"))
    assert r.status_code == 200, r.text
    lst = api.get(f"{V1}/leave-files", params={"leave_id": "L-1"}, headers=h(api, "hr.test")).json()
    assert len(lst["items"] if isinstance(lst, dict) else lst) == 1
    assert api.get(f"{V1}/leave-files/{r.json()['id']}", headers=h(api, "emp52.test")).status_code in (403, 404)
    assert api.delete(f"{V1}/leave-files", params={"leave_id": "L-1"}, headers=h(api, "hr.test")).status_code == 200


# ---------------------------------------------------------------- mail (sending disabled in tests)
def test_mail_account_password_is_encrypted(api, port_engine):
    body = {"host": "smtp.example.com", "port": 465, "username": "hr@example.com", "password": "not-a-real-pass", "from_email": "hr@example.com"}
    assert api.put(f"{V1}/mail/company", json=body, headers=h(api, "emp.test")).status_code == 403
    r = api.put(f"{V1}/mail/company", json=body, headers=h(api, "hr.test"))
    assert r.status_code == 200, r.text
    assert "password" not in r.text or "not-a-real-pass" not in r.text
    raw = sql(port_engine, "SELECT password_enc FROM ariba_mail_accounts WHERE owner='company'")[0]["password_enc"]
    assert b"not-a-real-pass" not in bytes(raw)
    t = api.post(f"{V1}/mail/test", json={"scope": "company", "to": "x@example.com"}, headers=h(api, "hr.test"))
    assert t.status_code in (200, 502) and "MAIL_DISABLED" in t.text


# ---------------------------------------------------------------- tasks
def test_tasks_between_manager_and_team(api, port_engine):
    r = api.post(f"{V1}/tasks", json={"to": ["55"], "kind": "task", "title": "تقرير"}, headers=h(api, "mgr.test"))
    assert r.status_code == 200, r.text
    assert api.post(f"{V1}/tasks", json={"to": ["40"], "title": "x"}, headers=h(api, "mgr.test")).status_code == 403
    inbox = api.get(f"{V1}/tasks", params={"box": "inbox"}, headers=h(api, "emp55.test")).json()["items"]
    tid = inbox[0]["id"]
    assert api.post(f"{V1}/tasks/{tid}/update", json={"status": "cancelled"}, headers=h(api, "emp55.test")).status_code == 409
    assert api.post(f"{V1}/tasks/{tid}/update", json={"status": "done"}, headers=h(api, "emp55.test")).json()["status"] == "done"
    avail = api.get(f"{V1}/team/availability", headers=h(api, "mgr.test")).json()
    assert avail["allowed"] and {x["id"] for x in avail["items"]} >= {"55"}


# ---------------------------------------------------------------- assets
def test_assets_custody_and_archive(api, port_engine):
    a = {"name": "لابتوب", "category": "computers", "acquisition_date": "2026-01-01", "cost": 5000, "salvage_value": 500, "useful_life_months": 36}
    r = api.post(f"{V1}/assets", json=a, headers=h(api, "adm.test"))
    assert r.status_code == 200, r.text
    aid = r.json()["asset"]["id"]
    assert api.post(f"{V1}/assets/{aid}/custody", json={"employee_id": "51"}, headers=h(api, "adm.test")).status_code == 200
    assert api.post(f"{V1}/assets/{aid}/custody", json={"employee_id": ""}, headers=h(api, "adm.test")).status_code == 200
    actions = [x["action"] for x in sql(port_engine, "SELECT action FROM ariba_asset_custody_log WHERE asset_id=:a ORDER BY id", a=aid)]
    assert actions == ["assign", "return"]
    assert api.delete(f"{V1}/assets/{aid}", headers=h(api, "adm.test")).status_code == 200
    assert sql(port_engine, "SELECT count(*) AS n FROM ariba_deleted_items WHERE kind='asset' AND ref_id=:a", a=aid)[0]["n"] == 1


# ---------------------------------------------------------------- audit log and month purge
def test_audit_list_filters_and_purge_with_finance(api, port_engine):
    sql(port_engine, """INSERT INTO ariba_audit_log(id,at,actor_username,module,action,summary)
        OVERRIDING SYSTEM VALUE VALUES ((SELECT coalesce(max(id),0)+1 FROM ariba_audit_log),'2025-01-15T10:00:00+03','old.user','payroll','قديم','سجل قديم')""")
    r = api.post(f"{V1}/audit/list", json={"modules": ["payroll"], "q": "قديم"}, headers=h(api, "hr.test"))
    assert r.status_code == 200, r.text
    assert r.json()["total"] >= 1 and all(x["module"] == "payroll" for x in r.json()["rows"])
    assert api.post(f"{V1}/audit/list", json={}, headers=h(api, "emp.test")).status_code == 403
    info = api.get(f"{V1}/audit/purge", headers=h(api, "hr.test")).json()
    assert any(m["month"] == "2025-01" for m in info["months"]) and not info["is_finance"]
    rq = api.post(f"{V1}/audit/purge", json={"month": "2025-01"}, headers=h(api, "admin.test"))
    assert rq.status_code == 200, rq.text
    this_month = api.post(f"{V1}/audit/purge", json={"month": "2026-10"}, headers=h(api, "admin.test"))
    assert this_month.status_code == 422
    assert api.post(f"{V1}/audit/purge/{rq.json()['id']}/decide", json={"approve": True}, headers=h(api, "hr.test")).status_code == 403
    d = api.post(f"{V1}/audit/purge/{rq.json()['id']}/decide", json={"approve": True}, headers=h(api, "fin.test"))
    assert d.status_code == 200 and d.json()["deleted"] >= 1
    assert sql(port_engine, "SELECT count(*) AS n FROM ariba_audit_log WHERE action='قديم'")[0]["n"] == 0


# ---------------------------------------------------------------- settings, permissions, roles
def test_kv_settings_whitelist_and_permissions(api, port_engine):
    assert api.put(f"{V1}/settings/kv/brand_colors", json={"value": {"p": "#123456", "s": "#FFFFFF"}}, headers=h(api, "emp.test")).status_code == 403
    assert api.put(f"{V1}/settings/kv/brand_colors", json={"value": {"p": "#123456", "s": "#FFFFFF"}}, headers=h(api, "hr.test")).status_code == 200
    assert api.get(f"{V1}/settings/kv/brand_colors", headers=h(api, "fin.test")).json()["value"]["p"] == "#123456"
    assert api.get(f"{V1}/settings/kv/jwt_secret", headers=h(api, "hr.test")).status_code == 404
    assert api.get(f"{V1}/public/brand").json()["brand"]["p"] == "#123456"
    assert sql(port_engine, "SELECT action FROM ariba_audit_log ORDER BY id DESC LIMIT 1")[0]["action"] == "تعديل ألوان الهوية"


def test_permissions_matrix_and_roles(api):
    m = api.get(f"{V1}/settings/permissions", headers=h(api, "admin.test")).json()
    assert "admin" not in m["roles"] and "audit" in m["modules"] and m["can_edit"]
    assert api.put(f"{V1}/settings/permissions", json={"role": "employee", "module": "assets", "level": "view"}, headers=h(api, "admin.test")).status_code == 200
    assert api.get(f"{V1}/settings/permissions", headers=h(api, "admin.test")).json()["matrix"]["employee.assets"] == "view"
    assert api.put(f"{V1}/settings/permissions", json={"role": "admin", "module": "assets", "level": "none"}, headers=h(api, "admin.test")).status_code == 422
    assert api.put(f"{V1}/settings/permissions", json={"role": "employee", "module": "assets", "level": "none"}, headers=h(api, "admin.test")).status_code == 200
    assert api.put(f"{V1}/settings/roles", json={"employee_id": "57", "role": "admin"}, headers=h(api, "hr.test")).status_code == 403
    roles = api.get(f"{V1}/settings/roles", headers=h(api, "admin.test")).json()
    assert any(r["username"] == "emp.test" for r in roles)
    d = api.get(f"{V1}/auth/users/default-passwords", headers=h(api, "admin.test"))
    assert d.status_code == 200 and isinstance(d.json()["accounts"], list)


# ---------------------------------------------------------------- payroll prepare → approve → reopen
def test_payroll_flow(api, port_engine):
    key = "pay_2026_09"
    assert api.post(f"{V1}/sheets/{key}/prepare", json={}, headers=h(api, "hr.test")).json()["error"]["code"] == "PAYROLL_NOT_SAVED"
    assert api.put(f"{V1}/sheets/{key}", json={"data": [{"id": "51", "nameAr": "x", "totalDue": 1000}]}, headers=h(api, "hr.test")).status_code == 200
    assert api.post(f"{V1}/sheets/{key}/approve", headers=h(api, "hr.test")).json()["error"]["code"] == "APPROVAL_REQUIRES_FINANCE"
    assert api.post(f"{V1}/sheets/{key}/approve", headers=h(api, "fin.test")).json()["error"]["code"] == "PAYROLL_NOT_PREPARED"
    p = api.post(f"{V1}/sheets/{key}/prepare", json={"note": "جاهز"}, headers=h(api, "hr.test"))
    assert p.status_code == 200 and p.json()["status"] == "prepared", p.text
    assert api.post(f"{V1}/sheets/{key}/approve", headers=h(api, "fin.test")).json()["approved"] is True
    assert api.get(f"{V1}/sheets/{key}/status", headers=h(api, "fin.test")).json()["status"] == "approved"
    assert api.post(f"{V1}/sheets/{key}/unapprove", json={"reason": "خطأ"}, headers=h(api, "fin.test")).json()["error"]["code"] == "REASON_REQUIRED"
    assert api.post(f"{V1}/sheets/{key}/unapprove", json={"reason": "تصحيح خصم"}, headers=h(api, "hr.test")).status_code == 403
    assert api.post(f"{V1}/sheets/{key}/unapprove", json={"reason": "تصحيح خصم"}, headers=h(api, "fin.test")).status_code == 200
    st = api.get(f"{V1}/sheets/{key}/status", headers=h(api, "hr.test")).json()
    assert st["status"] == "reopened" and st["reopen_reason"] == "تصحيح خصم"


# ---------------------------------------------------------------- password recovery
def test_password_recovery_keeps_the_old_password_until_the_temporary_one_is_used(api, port_engine, monkeypatch):
    from app.services import mailer
    sent = {}
    monkeypatch.setattr(mailer, "send", lambda acc, m: sent.update(html=m.html, to=m.to) or {"ok": True})
    sql(port_engine, "UPDATE employee_directory SET data=jsonb_set(data,'{email}','\"emp58@example.com\"') WHERE employee_id='58'")
    r = api.post(f"{V1}/auth/password-recovery", json={"username": "emp58.test"})
    assert r.status_code == 200 and r.json()["sent_to"].endswith("@example.com")
    assert api.post(f"{V1}/auth/password-recovery", json={"username": "nobody"}).json()["ok"]  # same answer for unknown users
    import re
    temp = re.search(r"كلمة المرور المؤقتة: <b dir='ltr'>([a-z0-9]+)</b>", sent["html"]).group(1)
    from port_fixtures import PASSWORD
    assert api.post(f"{V1}/auth/login", json={"username": "emp58.test", "password": PASSWORD}).status_code == 200  # old one still works
    r = api.post(f"{V1}/auth/login", json={"username": "emp58.test", "password": temp})
    assert r.status_code == 200 and r.json()["user"]["must_change_password"] is True
    assert api.post(f"{V1}/auth/login", json={"username": "emp58.test", "password": temp}).status_code == 200  # now the account password
    assert api.post(f"{V1}/auth/login", json={"username": "emp58.test", "password": PASSWORD}).status_code == 401


# ---------------------------------------------------------------- push tokens, WebAuthn options, brand extraction
def test_push_tokens_and_sending(api, port_engine):
    bad = api.post(f"{V1}/me/push-token", json={"token": "nope"}, headers=h(api, "emp57.test"))
    assert bad.status_code == 422
    tok = "ExponentPushToken[test-57]"
    assert api.post(f"{V1}/me/push-token", json={"token": tok}, headers=h(api, "emp57.test")).status_code == 200
    sql(port_engine, "UPDATE workflow_notifications SET pushed_at=now() WHERE pushed_at IS NULL")
    sql(port_engine, "INSERT INTO workflow_notifications(recipient_employee_id,title,body) VALUES('57','عنوان','نص')")
    from app.services import push
    from sqlalchemy.orm import Session
    seen = []
    import os
    os.environ.pop("PUSH_DISABLED", None)
    try:
        with Session(bind=port_engine) as db:
            out = push.send_pending(db, post=lambda msgs: seen.extend(msgs) or [{"status": "error", "details": {"error": "DeviceNotRegistered"}}])
    finally:
        os.environ["PUSH_DISABLED"] = "1"
    assert seen[0]["to"] == tok and out["gone"] == 1
    assert sql(port_engine, "SELECT count(*) AS n FROM ariba_push_tokens WHERE token=:t", t=tok)[0]["n"] == 0
    assert sql(port_engine, "SELECT count(*) AS n FROM workflow_notifications WHERE pushed_at IS NULL")[0]["n"] == 0


def test_webauthn_options(api):
    r = api.post(f"{V1}/auth/webauthn/register/options", headers=h(api, "emp.test"))
    assert r.status_code == 200 and r.json()["options"]["challenge"] and r.json()["state"]
    bad = api.post(f"{V1}/auth/webauthn/register", json={"state": r.json()["state"], "credential": {}}, headers=h(api, "emp.test"))
    assert bad.status_code == 400
    lo = api.post(f"{V1}/auth/webauthn/login/options", json={"username": "emp.test"})
    assert lo.status_code == 200
    assert api.post(f"{V1}/auth/webauthn/login", json={"state": lo.json()["state"], "credential": {"id": "x"}}).status_code == 401
    assert api.post(f"{V1}/auth/webauthn/login", json={"state": r.json()["state"], "credential": {"id": "x"}}).status_code == 400  # wrong kind


def test_brand_colors_from_html_and_private_urls_refused(api):
    from app.routers.port_settings import extract_colors
    out = extract_colors('<meta name="theme-color" content="#014d3d"><style>a{color:#29b35e}b{color:#29B35E}c{color:#fff}</style>')
    assert out["theme_color"] == "#014D3D" and out["colors"][0] == {"color": "#29B35E", "count": 2}
    for url in ("http://127.0.0.1/", "http://localhost:8010/", "file:///etc/passwd", "http://169.254.169.254/"):
        r = api.post(f"{V1}/settings/brand/extract", json={"url": url}, headers=h(api, "admin.test"))
        assert r.status_code in (422, 429), (url, r.text)


@pytest.mark.parametrize("path", ["/staff/employees", "/assets", "/candidates", "/audit/purge", "/settings/permissions"])
def test_employee_role_is_refused(api, path):
    assert api.get(V1 + path, headers=h(api, "emp.test")).status_code == 403


def test_scheduler_jobs_run_once_under_the_advisory_lock(port_engine):
    from sqlalchemy.orm import Session

    from app.services import scheduler
    calls = []
    factory = lambda: Session(bind=port_engine)  # noqa: E731
    assert scheduler.run_job(factory, 7_340_999, "probe", lambda db: calls.append(1) or "ran") == "ran"
    holder = Session(bind=port_engine)
    try:
        holder.execute(text("SELECT pg_advisory_lock(7340999)"))
        assert scheduler.run_job(factory, 7_340_999, "probe", lambda db: calls.append(2)) is None  # another instance holds it
    finally:
        holder.execute(text("SELECT pg_advisory_unlock(7340999)"))
        holder.close()
    assert calls == [1]
    for name, _every, fn in scheduler.JOBS:  # every real job runs against the database without error
        assert scheduler.run_job(factory, 7_340_900, name, fn) is not None or name == "candidates"
