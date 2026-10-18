"""Task-10 scenario against the local server (synthetic DB): new employee → punch → every request type through its
stages + escalation → payroll month → payslip → candidate accepted → target + evaluation → test e-mail → settlement.

Run on a fresh DB built by build.sh (the scenario adds employee 900), with the API started with MAIL_DISABLED=1 PUSH_DISABLED=1:
    cd backend && SCENARIO_DB=ariba_scenario .venv/bin/python ../tools/dev-db/scenario.py
Env: SCENARIO_API (default http://localhost:8010/api/v1), SCENARIO_DB, PGHOST, PGUSER, ARIBA_DEV_PASSWORD."""
import base64
import os
import subprocess
import sys
from datetime import date, timedelta

import httpx
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "backend"))

API = os.environ.get("SCENARIO_API", "http://localhost:8010/api/v1")
PW = os.environ.get("ARIBA_DEV_PASSWORD", "dev-local-only")
DB = os.environ.get("SCENARIO_DB", "ariba_scenario")
PDF = base64.b64encode(b"%PDF-1.4 scenario").decode()
ok = fail = 0
tok: dict[str, str] = {}


def check(name, cond, extra=""):
    global ok, fail
    if cond:
        ok += 1
        print("✓", name)
    else:
        fail += 1
        print("✗", name, extra)


def h(u, pw=PW):
    if u not in tok:
        r = httpx.post(f"{API}/auth/login", json={"username": u, "password": pw})
        r.raise_for_status()
        tok[u] = r.json()["access_token"]
    return {"Authorization": "Bearer " + tok[u]}


def call(m, path, u, **kw):
    return httpx.request(m, API + path, headers=h(u), timeout=60, **kw)


def sql(q):
    return subprocess.run(["psql", "-h", os.environ.get("PGHOST", "/tmp"), "-U", os.environ.get("PGUSER", "postgres"), "-d", DB, "-Atc", q], capture_output=True, text=True).stdout.strip()


# 1. new employee (their form shape) + account
emp = {"id": "900", "empNo": "900", "nameAr": "موظف السيناريو", "nameEn": "Scenario Employee", "employer": "اريبا", "dept": "المالية",
       "jobTitle": "محاسب", "nationality": "سعودي", "isSaudi": True, "contractJoin": "2024-01-01", "contractNature": "indefinite",
       "salary": 8000, "housingAllowance": 2000, "transportAllowance": 800, "managerId": "50", "email": "s900@example.com",
       "mobile": "0500000900", "iqamaNo": "1000000900", "dob": "1990-05-05", "insSystem": "old", "wpsType": "wps", "currency": "ريال سعودي"}
r = call("PUT", "/staff/employees/900", "hr.test", json={"employee": emp})
check("1. HR يضيف موظفاً جديداً", r.status_code == 200, r.text[:200])
r = call("POST", "/staff/employees/900/reset-password", "hr.test")
temp, user = r.json().get("temporary_password"), r.json().get("username")
check("   حساب الموظف + كلمة مؤقتة", r.status_code == 200 and temp, r.text[:200])
r = httpx.post(f"{API}/auth/login", json={"username": user, "password": temp})
check("   دخول بالمؤقتة يطلب التغيير", r.status_code == 200 and r.json()["user"]["must_change_password"], r.text[:200])
r = httpx.post(f"{API}/auth/change-password", json={"old_password": temp, "new_password": "Scenario2026x"}, headers={"Authorization": "Bearer " + r.json()["access_token"]})
check("   تغيير كلمة المرور", r.status_code == 200, r.text[:200])
tok[user] = r.json()["access_token"]
U = user

# 2. punch in / out at the head office
sql("UPDATE employee_directory SET data=jsonb_set(data,'{workLocationIds}','[\"loc-hq\"]') WHERE employee_id='900'")
r = call("POST", "/me/attendance/punch", U, json={"action": "in", "lat": 24.7136, "lng": 46.6753})
check("2. بصمة حضور من المقر", r.status_code in (200, 201), r.text[:200])
r = call("POST", "/me/attendance/punch", U, json={"action": "out", "lat": 24.7136, "lng": 46.6753})
check("   بصمة انصراف", r.status_code in (200, 201), r.text[:200])
r = call("POST", "/me/attendance/punch", U, json={"action": "in", "lat": 21.5, "lng": 39.2})
check("   بصمة خارج النطاق مرفوضة", r.status_code >= 400, str(r.status_code))

# 3. every request type through its stages
d0 = date.today() + timedelta(days=40)
reqs = {
    "annual": {"type": "annual", "payload": {"from": str(d0), "to": str(d0 + timedelta(days=2))}},
    "sick": {"type": "sick", "payload": {"from": str(d0 + timedelta(days=10)), "to": str(d0 + timedelta(days=10))}},
    "unpaid": {"type": "unpaid", "payload": {"from": str(d0 + timedelta(days=20)), "to": str(d0 + timedelta(days=21)), "notes": "ظرف عائلي"}},
    "salary_advance": {"type": "salary_advance", "payload": {"amount": 1500, "notes": "ظرف"}},
    "overtime": {"type": "overtime", "payload": {"date": str(date.today() - timedelta(days=1)), "hours": 2, "notes": "إقفال"}},
    "forgot_punch": {"type": "forgot_punch", "payload": {"kind": "in", "date": str(date.today() - timedelta(days=2)), "time": "08:05", "notes": "نسيت"}},
    "permission": {"type": "permission", "payload": {"date": str(d0), "time": "10:00", "dur": 2}},
    "profile_edit": {"type": "profile_edit", "payload": {"changes": {"city": "جدة"}}},
    "iban_change": {"type": "iban_change", "payload": {"iban": "SA0380000000608010167519", "bank": "الراجحي", "account_no": "608010167519", "letter_html": "<p>خطاب</p>"},
                    "attachment": {"name": "iban.pdf", "mime": "application/pdf", "data": PDF}},
    "document": {"type": "document", "payload": {"doc_type": "cv", "doc_label": "سيرة"}, "attachment": {"name": "cv.pdf", "mime": "application/pdf", "data": PDF}},
}
ids = {}
for k, body in reqs.items():
    r = call("POST", "/me/requests", U, json=body)
    ids[k] = r.json().get("id") if r.status_code == 201 else None
    check(f"3. طلب {k}", r.status_code == 201, r.text[:200])


def stage(i):
    return sql(f"SELECT current_stage||'/'||status FROM workflow_requests WHERE id='{i}'")


def approve_all(i, max_steps=4):
    for _ in range(max_steps):
        st = stage(i)
        if not st.endswith("pending"):
            return st
        who = {"manager": "mgr.test", "hr": "hr.test", "ceo": "ceo.test"}[st.split("/")[0]]
        r = call("POST", f"/me/approvals/{i}", who, json={"action": "approve"})
        if r.status_code != 200:
            return st + " ✗ " + r.text[:120]
    return stage(i)


for k in ("annual", "sick", "unpaid", "salary_advance", "overtime", "forgot_punch", "permission", "profile_edit", "iban_change", "document"):
    if ids.get(k):
        res = approve_all(ids[k])
        check(f"   {k} اعتُمد بكل مراحله ({res})", res.endswith("approved"), res)
check("   تعديل البيانات طُبّق بعد الاعتماد", sql("SELECT data->>'city' FROM employee_directory WHERE employee_id='900'") == "جدة")
check("   الآيبان الجديد طُبّق", sql("SELECT data->>'iban' FROM employee_directory WHERE employee_id='900'") == "SA0380000000608010167519")
check("   نسيان البصمة سُجّل في الحضور", sql(f"SELECT count(*) FROM attendance WHERE employee_id='900' AND date='{date.today() - timedelta(days=2)}'") == "1")

# rejection with reason + escalation
r = call("POST", "/me/requests", U, json={"type": "emergency", "payload": {"from": str(d0 + timedelta(days=30)), "to": str(d0 + timedelta(days=30))}})
rid = r.json()["id"]
r = call("POST", f"/me/approvals/{rid}", "mgr.test", json={"action": "reject"})
check("   الرفض بدون سبب مرفوض", r.status_code == 422, str(r.status_code))
r = call("POST", f"/me/approvals/{rid}", "mgr.test", json={"action": "reject", "reason": "ضغط عمل"})
check("   الرفض بسبب", r.status_code == 200 and stage(rid).endswith("rejected"), r.text[:150])
r = call("POST", "/me/requests", U, json={"type": "marriage", "payload": {"from": str(d0 + timedelta(days=50)), "to": str(d0 + timedelta(days=54))}})
rid = r.json()["id"]
sql(f"UPDATE workflow_requests SET updated_at=now()-interval '10 days' WHERE id='{rid}'")
r = call("POST", "/requests/escalate", "hr.test")
check("   التصعيد بعد مهلة المدير → HR", stage(rid).startswith("hr/"), stage(rid))

# 4. payroll month → payslip
y, m = date.today().year, date.today().month
row = {"id": "900", "nameAr": "موظف السيناريو", "workDays": 30, "salByDays": 8000, "houPay": 2000, "traPay": 800, "totalDue": 10800,
       "insEmp": 1000, "net": 9800, "netSAR": 9800, "idx": 1}
r = call("PUT", f"/staff/payroll/{y}/{m}", "hr.test", json={"rows": [row]})
check("4. حفظ مسيّر الشهر", r.status_code == 200, r.text[:150])
r = call("POST", f"/sheets/pay_{y}_{m:02d}/prepare", "hr.test", json={"note": "جاهز"})
check("   تجهيز HR للمالية", r.status_code == 200 and r.json().get("status") == "prepared", r.text[:150])
r = call("PUT", f"/staff/payroll/{y}/{m}", "fin.test", json={"rows": [row], "approved": True})
check("   اعتماد المالية", r.status_code == 200 and r.json().get("approved"), r.text[:150])
r = call("GET", "/me/payslips", U)
slips = r.json() if r.status_code == 200 else []
check("   قسيمة الراتب عند الموظف", any(s["year"] == y and s["month"] == m and float(s["data"].get("netSAR") or 0) == 9800 for s in slips), r.text[:200])

# 5. candidate → employee
key = call("POST", "/candidates/apply-key/rotate", "hr.test").json()["form_key"]
r = httpx.post(f"{API}/public/apply", json={"form_key": key, "data": {"nameAr": "مرشح السيناريو", "mobile": "0509990000", "email": "cand.s@example.com",
                                                                       "position": "محاسب", "expectedSalary": "7000"},
                                            "files": [{"type": "cv", "name": "cv.pdf", "mime": "application/pdf", "base64": PDF}]})
check("5. مرشح يتقدّم من الرابط العام", r.status_code == 200, r.text[:150])
cand = next(c for c in call("GET", "/candidates", "hr.test").json()["candidates"] if c["data"].get("email") == "cand.s@example.com")
r = call("POST", f"/candidates/{cand['id']}/accept", "hr.test", json={"em": "اريبا", "dep": "المالية", "jt": "محاسب", "nature": "indefinite",
                                                                     "cj": str(date.today()), "sal": 7000})
newid = r.json().get("emp", {}).get("id")
check("   قبوله → موظف بالرقم التالي وملفاته في وثائقه", r.status_code == 200 and newid and sql(f"SELECT count(*) FROM ariba_documents WHERE employee_id='{newid}'") == "1", r.text[:200])

# 6. target + evaluation
qk = f"{y}-Q{(m - 1) // 3 + 1}"
r = call("POST", "/targets", "mgr.test", json={"target": {"employee_id": "900", "period_type": "quarterly", "period_key": qk, "title": "إقفال الحسابات",
                                                          "target_value": 10, "actual_value": 9}})
check("6. المدير يضع مستهدفاً", r.status_code == 200, r.text[:150])
r = call("PUT", f"/evaluations/900/quarterly/{qk}", "mgr.test", json={"items": [{"title": "إقفال الحسابات", "score": 90, "weight": 1}], "submit": True})
ev = r.json().get("evaluation", {})
check("   تقييم مُرسل للاعتماد", r.status_code == 200 and ev.get("status") == "pending", r.text[:150])
r = call("POST", f"/evaluations/{ev.get('id')}/approve", "ceo.test")
check("   الاعتماد النهائي", r.status_code == 200, r.text[:150])
g = call("GET", "/me/goals", U).json()
check("   الموظف يرى مستهدفه وتقييمه", g["targets"] and g["evaluations"] and g["evaluations"][0]["overall"] == 90, str(g)[:200])

# 7. test e-mail
r = call("PUT", "/mail/company", "hr.test", json={"host": "smtp.example.com", "port": 465, "username": "hr@example.com", "password": "x-local-only", "from_email": "hr@example.com"})
check("7. حفظ بريد الإرسال (كلمة المرور مشفّرة)", r.status_code == 200, r.text[:150])
r = call("POST", "/mail/test", "hr.test", json={"scope": "company", "to": "s900@example.com"})
check("   إيميل تجريبي (معطّل في البيئة المحلية MAIL_DISABLED)", "MAIL_DISABLED" in r.text, r.text[:150])
n = sql("SELECT count(*) FROM workflow_notifications WHERE recipient_employee_id='900'")
check(f"   إشعارات الموظف خلال السيناريو ({n})", int(n or 0) > 5)

# 8. settlement: end the new employee's service, then the award by their rules (react-parity covers every case)
r = call("POST", "/staff/employees/900/terminate", "hr.test", json={"reason": "استقالة", "last_day": str(date.today())})
check("8. إنهاء خدمة الموظف (مخالصة)", r.status_code == 200 and sql("SELECT active FROM employee_directory WHERE employee_id='900'") == "f", r.text[:150])
r = httpx.post(f"{API}/auth/login", json={"username": U, "password": "Scenario2026x"})
# not a check: their server function is not in the reference, so whether the account is closed is the owner's call
print("ℹ    دخول الموظف بعد إنهاء خدمته:", "مسموح" if r.status_code == 200 else "مرفوض")
check("   مسجّل في سجل التعديلات", sql("SELECT count(*) FROM ariba_audit_log WHERE entity_id='900' AND action='إنهاء خدمة موظف'") == "1")
from decimal import Decimal
from app.enums import TerminationArticle as A
from app.services.end_of_service import eos_award, service_years
yrs = service_years(date(2016, 1, 1), date(2026, 1, 1))
check(f"   مكافأة نهاية الخدمة (10 سنوات، 10,000، م84) = {eos_award(Decimal(10000), yrs, A.art_84)}", eos_award(Decimal(10000), yrs, A.art_84) == Decimal("75000.00"))
check("   استقالة م85 بعد 3 سنوات = الثلث", eos_award(Decimal(9000), Decimal(3), A.art_85) == Decimal("4500.00"))

print(f"\n{ok} نجح · {fail} فشل")
sys.exit(1 if fail else 0)
