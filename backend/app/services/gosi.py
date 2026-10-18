"""GOSI (التأمينات الاجتماعية) contributions from effective-dated rules.

    base     = min(wage_cap / month_days x work_days, basic + housing)
    employee = base x employee_rate%   (55+ uses the senior rate)
    employer = base x employer_rate%

Exempt (V130, see `exempt_kind`): consultants, tamheer, trainees (by WPS type, category, or words in the
job title / department / workplace) and anyone not on WPS pay no GOSI.
"""

import re
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from app.enums import EmployeeCategory, GosiSystem, WpsType

CENT = Decimal("0.01")
DEFAULT_AGE = 30  # prototype default when the birth date is missing


@dataclass(frozen=True)
class GosiRule:
    """One effective-dated rate set for one system (rates in percent)."""

    effective_from: date
    system: GosiSystem
    employee_rate: Decimal
    employer_rate: Decimal
    employee_rate_senior: Decimal
    employer_rate_senior: Decimal
    senior_age: int
    wage_cap: Decimal


@dataclass(frozen=True)
class GosiResult:
    base: Decimal
    employee: Decimal
    employer: Decimal
    employee_rate: Decimal
    employer_rate: Decimal

    @classmethod
    def zero(cls) -> "GosiResult":
        z = Decimal("0.00")
        return cls(z, z, z, Decimal("0"), Decimal("0"))


def age_on(birth_date: date | None, on: date) -> int:
    if birth_date is None:
        return DEFAULT_AGE
    years = on.year - birth_date.year
    if (on.month, on.day) < (birth_date.month, birth_date.day):
        years -= 1
    return years


def rule_for(rules: list[GosiRule], system: GosiSystem, on: date) -> GosiRule | None:
    """The rule in force on `on`: the latest effective_from <= on for the system."""
    candidates = [r for r in rules if r.system == system and r.effective_from <= on]
    return max(candidates, key=lambda r: r.effective_from) if candidates else None


_EXEMPT_WPS = {WpsType.consultant: "consultant", WpsType.tamheer: "tamheer", WpsType.trainee: "trainee"}


def exempt_kind(
    *,
    wps_type: WpsType,
    category: EmployeeCategory | None = None,
    job_title: str | None = None,
    department: str | None = None,
    workplace: str | None = None,
    emp_type: str | None = None,
    excel_category: str | None = None,
) -> str:
    """V130 (legacy js/payroll/114-ariba-v130-insurance-exempt.js `kindOf`), exactly: '' when the employee pays GOSI,
    otherwise why not. Explicit WPS type first, then words in the job title / department / workplace, the Excel
    category 'consultant' and the Arabic employment-type text (مهمة محددة / متدرب). `category` is not used: the
    legacy rule never looks at the English empType codes."""
    if wps_type in _EXEMPT_WPS:
        return _EXEMPT_WPS[wps_type]
    if wps_type != WpsType.wps:
        return wps_type.value  # external / no_wps / remote: not subject either (prototype rule)
    job, dep, emp, typ = job_title or "", department or "", workplace or "", emp_type or ""
    if "تمهير" in emp or "تمهير" in job or "تمهير" in dep:
        return "tamheer"
    if re.search("استشاري|مستشار|استشاريه|استشارية", job) or (excel_category or "") == "consultant" or "مهمة محددة" in typ:
        return "consultant"
    if re.search("متدرب|تدريب|trainee|intern", job, re.I) or re.fullmatch(r"\s*تدريب\s*", dep) or "تدريب" in emp or "متدرب" in typ:
        return "trainee"
    return ""


def calculate(
    *,
    rules: list[GosiRule],
    system: GosiSystem,
    wps_type: WpsType,
    category: EmployeeCategory,
    basic: Decimal,
    housing: Decimal,
    birth_date: date | None,
    on: date,
    month_days: int = 30,
    work_days: Decimal | int = 30,
    job_title: str | None = None,
    department: str | None = None,
    workplace: str | None = None,
    emp_type: str | None = None,
    excel_category: str | None = None,
) -> GosiResult:
    if exempt_kind(wps_type=wps_type, category=category, job_title=job_title, department=department, workplace=workplace,
                   emp_type=emp_type, excel_category=excel_category):
        return GosiResult.zero()
    rule = rule_for(rules, system, on)
    if rule is None:
        return GosiResult.zero()
    senior = age_on(birth_date, on) >= rule.senior_age
    ee_rate = rule.employee_rate_senior if senior else rule.employee_rate
    er_rate = rule.employer_rate_senior if senior else rule.employer_rate
    cap = Decimal(rule.wage_cap) / Decimal(month_days) * Decimal(work_days)
    base = min(cap, Decimal(basic) + Decimal(housing)).quantize(CENT, ROUND_HALF_UP)
    return GosiResult(
        base=base,
        employee=(base * Decimal(ee_rate) / 100).quantize(CENT, ROUND_HALF_UP),
        employer=(base * Decimal(er_rate) / 100).quantize(CENT, ROUND_HALF_UP),
        employee_rate=Decimal(ee_rate),
        employer_rate=Decimal(er_rate),
    )


def rules_from_settings(settings: dict) -> list["GosiRule"]:
    """GOSI rules from the legacy settings shape (wageCap, ageThreshold, effectiveRules[] in percent)."""
    cap, age = Decimal(str(settings.get("wageCap") or 45000)), int(settings.get("ageThreshold") or 55)
    out: list[GosiRule] = []
    for p in settings.get("effectiveRules") or []:
        on = date.fromisoformat(str(p["date"])[:10])
        d = lambda k: Decimal(str(p.get(k) or 0))  # noqa: E731
        out += [
            GosiRule(on, GosiSystem.matching, d("matchEmp"), d("matchEr"), d("matchEmp55"), d("matchEr55"), age, cap),
            GosiRule(on, GosiSystem.non_matching, d("noMatchEmp"), d("noMatchEr"), d("noMatchEmp55"), d("noMatchEr55"), age, cap),
            GosiRule(on, GosiSystem.non_saudi, Decimal(0), d("nonSaudiEr"), Decimal(0), d("nonSaudiEr"), age, cap),
        ]
    return out


# --------------------------------------------------------------------------- their engine (engines/insurance.js)
# The HR department's React engine generates the statutory GOSI table itself (ARIBA_GOSI_AUTO): the new system
# 10.25/12.25 % from 1 Jul 2025, +0.5 every 1 July up to 11.75/13.75; the old system fixed at 9.75/11.75; 55+ pays
# 0.25 less (new) / 0.75 less (old). Stored periods that equal the two legacy defaults are dropped, and every
# automatic date that is not stored is added. Checked by tools/react-parity.
import math as _math  # noqa: E402

INS_RULES_DEFAULT = {"wageCap": 45000, "ageThreshold": 55, "effectiveRules": [
    {"date": "2026-01-01", "matchEmp": 10.75, "matchEmp55": 10.50, "matchEr": 12.75, "matchEr55": 12.50, "noMatchEmp": 9.75, "noMatchEmp55": 9.00,
     "noMatchEr": 11.75, "noMatchEr55": 11.00, "nonSaudiEr": 2.00},
    {"date": "2027-07-01", "matchEmp": 11.25, "matchEmp55": 11.00, "matchEr": 13.25, "matchEr55": 13.00, "noMatchEmp": 10.25, "noMatchEmp55": 9.50,
     "noMatchEr": 12.25, "noMatchEr55": 11.50, "nonSaudiEr": 2.00}]}
RULE_KEYS = ("matchEmp", "matchEmp55", "matchEr", "matchEr55", "noMatchEmp", "noMatchEmp55", "noMatchEr", "noMatchEr55", "nonSaudiEr")


def js_round2(x: float) -> float:
    """JS Math.round(x * 100) / 100."""
    return _math.floor(float(x) * 100 + 0.5) / 100


def _f(v) -> float:
    try:
        n = float(v)
    except (TypeError, ValueError):
        return 0.0
    return n if _math.isfinite(n) else 0.0


def auto_rate(on: date, system: str) -> dict:
    y, mo = on.year, on.month
    if system != "new" or y < 2025 or (y == 2025 and mo < 7):
        return {"emp": 9.75, "er": 11.75, "n": -1, "from": ""}
    n = y - 2025 - (1 if mo < 7 else 0)
    return {"emp": min(11.75, 10.25 + 0.5 * n), "er": min(13.75, 12.25 + 0.5 * n), "n": n, "from": f"1/7/{2025 + n}"}


def auto_rule(day: str, non_saudi_er: float | None = None) -> dict:
    on = date.fromisoformat(day)
    nw, od = auto_rate(on, "new"), auto_rate(on, "old")
    r = {"date": day, "matchEmp": nw["emp"], "matchEmp55": js_round2(nw["emp"] - 0.25), "matchEr": nw["er"], "matchEr55": js_round2(nw["er"] - 0.25),
         "noMatchEmp": od["emp"], "noMatchEmp55": js_round2(od["emp"] - 0.75), "noMatchEr": od["er"], "noMatchEr55": js_round2(od["er"] - 0.75),
         "nonSaudiEr": 2 if non_saudi_er is None else non_saudi_er}
    if day == "2000-01-01":
        r["matchEmp55"], r["matchEr55"] = 9.5, 11.5
    return r


def _same(a: dict, b: dict) -> bool:
    return all(abs(_f(a.get(k)) - _f(b.get(k))) < 1e-9 for k in RULE_KEYS)


def auto_dates(today: date) -> list[str]:
    last = max(today.year + 1, 2028)
    return ["2000-01-01", "2025-07-01"] + [f"{k}-07-01" for k in range(2026, last + 1)]


def ins_settings(stored: dict | None, today: date) -> dict:
    """getInsSettings: the stored settings (or the legacy default) with the automatic statutory periods merged in."""
    import copy
    s = copy.deepcopy(stored) if isinstance(stored, dict) and isinstance(stored.get("effectiveRules"), list) and stored["effectiveRules"] else copy.deepcopy(INS_RULES_DEFAULT)
    s["wageCap"] = _f(s.get("wageCap")) or 45000
    s["ageThreshold"] = _f(s.get("ageThreshold")) or 55
    legacy = INS_RULES_DEFAULT["effectiveRules"]
    rules = [r for r in s["effectiveRules"] if not any(lv["date"] == r.get("date") and _same(lv, r) for lv in legacy)]
    have = {r.get("date") for r in rules}
    ns = rules[0]["nonSaudiEr"] if rules and rules[0].get("nonSaudiEr") is not None else 2
    for d in auto_dates(today):
        if d not in have:
            rules.append(auto_rule(d, ns))
    rules.sort(key=lambda r: str(r.get("date")))
    s["effectiveRules"] = rules
    return s


def rule_on(settings: dict, on: date) -> dict:
    """gosiRuleFor: the latest period whose date ≤ on (the first one when none is)."""
    rules = sorted(settings["effectiveRules"], key=lambda r: str(r.get("date")))
    chosen = rules[0]
    for r in rules:
        if str(r.get("date")) <= on.isoformat():
            chosen = r
    return chosen


def react_calc_ins(emp: dict, wd: float, md: float, settings: dict, today: date, on: date | None = None, country: str = "SA", eg_rules: dict | None = None) -> dict:
    """calcIns(emp, wd, md, asOf) of their engine (insurance.js), JS rounding included."""
    from app.services.country import calc_ins_eg
    if react_kind(emp):
        return {"base": 0, "empAmt": 0, "erAmt": 0, "status": "غير خاضع"}
    if country == "EG":
        return calc_ins_eg(emp, wd, md, on or today, eg_rules)
    consultant = (emp.get("excelCategory") or "") == "consultant" or "استشاري" in str(emp.get("jobTitle") or "") or "مهمة محددة" in str(emp.get("empType") or "")
    sal, hou = _f(emp.get("salary")), _f(emp.get("housingAllowance"))
    if consultant or react_ins_exempt(emp):
        return {"base": 0, "empAmt": 0, "erAmt": 0, "status": "لا يطبق"}
    r = rule_on(settings, on or today)
    if not emp.get("isSaudi"):
        emp_rate, er_rate = 0.0, _f(r.get("nonSaudiEr")) / 100
    else:
        dob = None
        try:
            dob = date.fromisoformat(str(emp.get("dob"))[:10]) if emp.get("dob") else None
        except ValueError:
            dob = None
        old_age = age_on(dob, today) >= settings["ageThreshold"]
        if (emp.get("insSystem") or "old") == "new":
            emp_rate, er_rate = _f(r["matchEmp55" if old_age else "matchEmp"]) / 100, _f(r["matchEr55" if old_age else "matchEr"]) / 100
        else:
            emp_rate, er_rate = _f(r["noMatchEmp55" if old_age else "noMatchEmp"]) / 100, _f(r["noMatchEr55" if old_age else "noMatchEr"]) / 100
    base = min((settings["wageCap"] / md) * wd, sal + hou)
    return {"base": js_round2(base), "empAmt": js_round2(base * emp_rate), "erAmt": js_round2(base * er_rate), "empRate": emp_rate, "erRate": er_rate}


def react_kind(e: dict) -> str:
    """kindOf (engines/empkind.js)."""
    w = str(e.get("wpsType") or e.get("wps") or "wps")
    if w in ("consultant", "tamheer", "trainee"):
        return w
    if w != "wps":
        return w
    job = str(e.get("jobTitle") or e.get("job") or e.get("jt") or "")
    dep = str(e.get("department") or e.get("dept") or e.get("dep") or "")
    emp = str(e.get("employer") or e.get("em") or "")
    typ, cat = str(e.get("empType") or ""), str(e.get("excelCategory") or "")
    if "تمهير" in emp or "تمهير" in job or "تمهير" in dep:
        return "tamheer"
    if re.search("استشاري|مستشار|استشاريه|استشارية", job) or cat == "consultant" or "مهمة محددة" in typ:
        return "consultant"
    if re.search("متدرب|تدريب|trainee|intern", job, re.I) or re.fullmatch(r"\s*تدريب\s*", dep) or "تدريب" in emp or "متدرب" in typ:
        return "trainee"
    return ""


def react_no_eos(e: dict) -> bool:
    return bool(react_kind(e))


def react_ins_exempt(e: dict) -> bool:
    return e.get("insSystem") == "exempt" or react_no_eos(e)
