"""Synthetic data for a local test database (tools/dev-db/build.sh). Deterministic (seeded); no real names or numbers.

Accounts (password = $ARIBA_DEV_PASSWORD, never committed): admin.test (admin), hr.test (40, hr), ceo.test (86, ceo),
fin.test (60, finance), mgr.test (50, manager of 51–58), emp.test (51, employee), chair.test (61, chairman),
adm.test (62, admin_manager), plus emp<id>.test for every other employee.
"""
from __future__ import annotations

import json
import os
import random
import sys
import uuid
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))
os.environ.setdefault("ENV", "development")

import psycopg  # noqa: E402
from argon2 import PasswordHasher  # noqa: E402

from app.services import employee_map as emap  # noqa: E402
from app.services import gosi  # noqa: E402

DB = sys.argv[1] if len(sys.argv) > 1 else "ariba_dev"
PASSWORD = os.environ.get("ARIBA_DEV_PASSWORD")
if not PASSWORD:
    sys.exit("set ARIBA_DEV_PASSWORD (a local test password; it is not stored anywhere in the repo)")
TODAY = date.today()
r = random.Random(20261018)

FIRST_M = ["محمد", "أحمد", "خالد", "عبدالله", "فهد", "سعد", "يوسف", "عمر", "ماجد", "سلمان"]
FIRST_F = ["سارة", "نورة", "ريم", "منى", "هيا", "لينا", "روان", "فاطمة"]
LAST = ["التجريبي", "الاختباري", "النموذجي", "المثالي", "الافتراضي"]
EMPLOYERS = ["أريبا", "الجيوميكانية", "أوبتيموم", "برنامج تمهير"]
DEPTS = ["المالية", "الموارد البشرية", "المشاريع", "تقنية المعلومات", "التشغيل", "الإدارة"]
JOBS = ["محاسب", "مهندس مدني", "مدير مشروع", "أخصائي موارد بشرية", "مطور برمجيات", "سكرتير", "استشاري أول", "متدرب"]
NATS = ["سعودي", "سعودي", "سعودي", "مصري", "أردني", "سوداني", "هندي"]


def employee(eid: str, *, name: str | None = None, female: bool | None = None, employer=None, dept=None, job=None, manager=None,
             join: date | None = None, salary: float | None = None, nat: str | None = None, terminated: bool = False) -> dict:
    female = r.random() < 0.3 if female is None else female
    nat = nat or r.choice(NATS)
    saudi = nat == "سعودي"
    join = join or date(r.randint(2014, 2025), r.randint(1, 12), r.randint(1, 28))
    sal = salary or round(r.randint(40, 300)) * 100
    fixed = r.random() < 0.5
    data = {
        "empNo": eid, "nameAr": name or f"{r.choice(FIRST_F if female else FIRST_M)} {r.choice(LAST)}", "nameEn": f"Test Employee {eid}",
        "gender": "أنثى" if female else "ذكر", "nationality": nat, "isSaudi": saudi, "dob": date(r.randint(1965, 2001), r.randint(1, 12), r.randint(1, 28)).isoformat(),
        "employer": employer or r.choice(EMPLOYERS[:3]), "dept": dept or r.choice(DEPTS), "jobTitle": job or r.choice(JOBS),
        "insSystem": ("new" if r.random() < 0.5 else "old") if saudi else "expat", "wpsType": "wps", "currency": "ريال سعودي", "payMethod": "مدد",
        "salary": sal, "housingAllowance": round(sal * 0.25), "transportAllowance": round(sal * 0.1), "projectAllowance": 0, "otherAllowance": 0,
        "extraAllowance": 0, "otherDeductions": 0, "contractJoin": join.isoformat(), "contractNature": "fixed" if fixed else "indefinite",
        "contractDuration": 24 if fixed else "", "leaveDaysContract": r.choice([21, 21, 21, 30]),
        "iqamaNo": ("1" if saudi else "2") + "".join(str(r.randint(0, 9)) for _ in range(9)),
        "iqamaExpiry": (TODAY + timedelta(days=r.randint(-10, 700))).isoformat(),
        "passportNo": "T" + str(r.randint(1000000, 9999999)), "passportExpiry": (TODAY + timedelta(days=r.randint(20, 1500))).isoformat(),
        "mobile": "05" + "".join(str(r.randint(0, 9)) for _ in range(8)), "email": f"emp{eid}@example.com",
        "iban": "SA" + "".join(str(r.randint(0, 9)) for _ in range(22)), "bank": r.choice(["الراجحي", "الأهلي", "الرياض"]),
        "isTerminated": terminated,
    }
    if fixed:
        from app.services.contracts import fixed_term_end
        data["contractEnd"] = fixed_term_end(join, 24).isoformat()
    if terminated:
        last = TODAY - timedelta(days=r.randint(5, 200))
        data.update({"terminationDate": last.isoformat(), "lastDay": last.isoformat(), "terminationReason": "استقالة", "term": True})
    if manager:
        data["managerId"] = manager
    f = emap.figures(data, saudi=saudi, rules=gosi.ins_settings(None, TODAY), birth=date.fromisoformat(data["dob"]), on=TODAY,
                     job=data["jobTitle"], dept=data["dept"], employer=data["employer"], override={"nationality": nat})
    data.update({"salaryTotal": float(f["total"]), "insuranceSub": float(f["gosi_employee"]), "netSalary": float(f["net"]), "netSalaryLocal": float(f["net"])})
    return data


def main() -> None:
    hasher = PasswordHasher()
    pw = hasher.hash(PASSWORD)
    with psycopg.connect(f"dbname={DB} host={os.environ.get('PGHOST', '/tmp')} user={os.environ.get('PGUSER', 'postgres')}") as cx, cx.cursor() as cur:
        def lookup(table: str, name: str) -> int:
            cur.execute(f"INSERT INTO public.{table}(name) VALUES(%s) ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING id", (name,))
            return cur.fetchone()[0]

        def upsert(eid: str, data: dict, active: bool = True) -> None:
            cur.execute("""INSERT INTO public.employee_directory(employee_id,name_ar,name_en,nationality,iqama_no,dob,join_date,manager_id,active,data,employer_id,department_id,job_title_id)
                VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT(employee_id) DO UPDATE SET name_ar=EXCLUDED.name_ar,data=EXCLUDED.data,manager_id=EXCLUDED.manager_id,active=EXCLUDED.active,
                  employer_id=EXCLUDED.employer_id,department_id=EXCLUDED.department_id,job_title_id=EXCLUDED.job_title_id""",
                        (eid, data["nameAr"], data["nameEn"], data["nationality"], data["iqamaNo"], data["dob"], data["contractJoin"], data.get("managerId"),
                         active, json.dumps(data, ensure_ascii=False), lookup("employers", data["employer"]), lookup("departments", data["dept"]), lookup("job_titles", data["jobTitle"])))

        def account(username: str, role: str, eid: str | None) -> None:
            cur.execute("""INSERT INTO public.ariba_auth_accounts(username,password_hash,role,employee_id,active,must_change) VALUES(%s,%s,%s,%s,true,false)
                ON CONFLICT(username) DO UPDATE SET password_hash=EXCLUDED.password_hash,role=EXCLUDED.role,employee_id=EXCLUDED.employee_id,active=true""",
                        (username, pw, role, eid))

        upsert("40", employee("40", name="هند الاختبار", female=True, employer="أريبا", dept="الموارد البشرية", job="أخصائي موارد بشرية", join=date(2019, 2, 1), salary=12000, nat="سعودي"))
        upsert("86", employee("86", name="خالد الاختبار", female=False, employer="أريبا", dept="الإدارة", job="الرئيس التنفيذي", join=date(2015, 1, 4), salary=40000, nat="سعودي"))
        upsert("50", employee("50", name="ماجد المدير", female=False, employer="أريبا", dept="المشاريع", job="مدير مشروع", join=date(2017, 5, 1), salary=25000, nat="سعودي"))
        upsert("60", employee("60", name="ريم المالية", female=True, employer="أريبا", dept="المالية", job="محاسب", join=date(2020, 9, 1), salary=14000, nat="سعودي"))
        upsert("61", employee("61", name="سلمان الرئيس", female=False, employer="أريبا", dept="الإدارة", job="رئيس مجلس الإدارة", join=date(2014, 1, 1), salary=50000, nat="سعودي"))
        upsert("62", employee("62", name="لينا الإدارية", female=True, employer="أريبا", dept="الإدارة", job="مدير إداري", join=date(2018, 3, 1), salary=20000, nat="سعودي"))
        for i in range(51, 59):
            upsert(str(i), employee(str(i), manager="50", dept="المشاريع", join=TODAY - timedelta(days=r.randint(30, 3000)) if i != 52 else TODAY - timedelta(days=75)))
        for i in range(63, 85):
            upsert(str(i), employee(str(i), manager=r.choice(["50", "62", None]), terminated=i in (83, 84)), active=i not in (83, 84))
        upsert("85", employee("85", job="متدرب", employer="برنامج تمهير"))
        for user, role, eid in [("admin.test", "admin", None), ("hr.test", "hr", "40"), ("ceo.test", "ceo", "86"), ("fin.test", "finance", "60"),
                                ("mgr.test", "manager", "50"), ("emp.test", "employee", "51"), ("chair.test", "chairman", "61"), ("adm.test", "admin_manager", "62")]:
            account(user, role, eid)
        cur.execute("SELECT employee_id FROM public.employee_directory WHERE employee_id NOT IN (SELECT employee_id FROM public.ariba_auth_accounts WHERE employee_id IS NOT NULL)")
        for (eid,) in cur.fetchall():
            account(f"emp{eid}.test", "employee", eid)

        cur.execute("""INSERT INTO public.work_locations(id,name,name_en,type,latitude,longitude,radius_m,active) VALUES
            ('loc-hq','المقر الرئيسي','Head office','office',24.7136,46.6753,300,true),('loc-remote','عن بعد','Remote','remote',24.7136,46.6753,50,true)
            ON CONFLICT(id) DO NOTHING""")
        for hid, name, d, days, rec in [("h-found", "يوم التأسيس", "2026-02-22", 1, True), ("h-nat", "اليوم الوطني", "2026-09-23", 1, True),
                                        ("h-fitr26", "عيد الفطر", "2026-03-19", 4, False), ("h-adha26", "عيد الأضحى", "2026-05-26", 5, False)]:
            cur.execute("INSERT INTO public.public_holidays(id,name,holiday_date,days,recurring) VALUES(%s,%s,%s,%s,%s) ON CONFLICT(id) DO NOTHING", (hid, name, d, days, rec))
        cur.execute("""INSERT INTO public.ariba_app_settings(key,value,updated_by) SELECT 'company_names','{"coAr":"شركة اختبار للخدمات","coEn":"Test Services Co."}'::jsonb,'seed'
            WHERE NOT EXISTS (SELECT 1 FROM public.ariba_app_settings WHERE key='company_names')""")
        cur.execute("""INSERT INTO public.ariba_app_settings(key,value,updated_by) SELECT 'leave_carry','{"days":10,"enabled":true}'::jsonb,'seed'
            WHERE NOT EXISTS (SELECT 1 FROM public.ariba_app_settings WHERE key='leave_carry')""")

        # approved annual leave for a few employees (workflow request + manager/HR/CEO actions + leave row)
        cur.execute("SELECT id FROM public.ariba_auth_accounts WHERE username='hr.test'")
        hr_acc = cur.fetchone()[0]
        for eid in ("51", "53", "64", "70"):
            f = TODAY - timedelta(days=r.randint(20, 200))
            t = f + timedelta(days=r.randint(2, 6))
            rid = uuid.uuid4()
            cur.execute("""INSERT INTO public.workflow_requests(id,employee_id,request_type,payload,current_stage,completed_at)
                VALUES(%s,%s,'annual',%s,'completed',now())""", (rid, eid, json.dumps({"from": f.isoformat(), "to": t.isoformat(), "days": (t - f).days + 1})))
            for st in ("manager", "hr", "ceo"):
                cur.execute("INSERT INTO public.workflow_actions(request_id,actor_account_id,stage,action,comment) VALUES(%s,%s,%s,'approved','seed')", (rid, hr_acc, st))
            cur.execute("""INSERT INTO public.leave_requests(employee_id,leave_type,from_date,to_date,days,workflow_request_id) VALUES(%s,'annual',%s,%s,%s,%s)""",
                        (eid, f, t, (t - f).days + 1, rid))
        # a little attendance for the last 10 days
        for eid in ("51", "52", "53", "54"):
            for k in range(1, 11):
                d = TODAY - timedelta(days=k)
                if d.weekday() in (4, 5):
                    continue
                cur.execute("""INSERT INTO public.attendance(employee_id,date,time_in,time_out,location_id,status,late_minutes,early_minutes,notes)
                    VALUES(%s,%s,%s,%s,'loc-hq',%s,%s,0,'seed')""", (eid, d, f"08:{r.randint(0, 40):02d}:00", f"16:{r.randint(0, 59):02d}:00", "present", 0))
        cx.commit()
    print(f"seeded {DB}")


if __name__ == "__main__":
    main()
