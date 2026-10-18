"""Country layer: Saudi Arabia (default) or Egypt — port of ARIBA_HR_React/src/engines/country.js (their V171).

The setting `country_system` = {mode: 'SA'|'EG', rules: {...overrides of DEF}} switches every engine that asks.
"""

from __future__ import annotations

import copy
import math
import re
from datetime import date, timedelta
from typing import Any, Callable

DEF: dict[str, Any] = {
    "insEmp": 11, "insEr": 18.75,
    "insLimits": {"2020": [1000, 7000], "2021": [1200, 8100], "2022": [1400, 9400], "2023": [1700, 10900], "2024": [2000, 12600],
                  "2025": [2300, 14500], "2026": [2700, 16700], "2027": [3200, 19300]},
    "taxExempt": 20000,
    "taxBrackets": [[0, 40000, 0], [40000, 55000, 10], [55000, 70000, 15], [70000, 200000, 20], [200000, 400000, 22.5],
                    [400000, 1200000, 25], [1200000, None, 27.5]],
    "martyrs": 0.05,
    "leaveFirst": 15, "leaveStd": 21, "leaveSenior": 30, "seniorYears": 10, "seniorAge": 50, "casualDays": 7,
    "eosEnabled": True, "eosFirstYears": 5, "eosFirstRate": 0.5, "eosNextRate": 1,
    "resignTiers": [[2, 0], [5, 1 / 3], [10, 2 / 3], [None, 1]],
    "arbComp": True, "arbMonths": 2,
    "weekend": "fri_sat",
}


def _num(v) -> float:
    try:
        n = float(v)
    except (TypeError, ValueError):
        return 0.0
    return n if math.isfinite(n) else 0.0


def r2(n) -> float:
    """JS Math.round((Number(n)||0)*100)/100 (round half up on the binary value)."""
    return math.floor(_num(n) * 100 + 0.5) / 100


def rules(overrides: dict | None = None) -> dict:
    r = copy.deepcopy(DEF)
    if isinstance(overrides, dict):
        for k, v in overrides.items():
            if v is not None:
                r[k] = v
    return r


def mode_of(setting: Any) -> tuple[str, dict | None]:
    """(country, egRules) from the stored `country_system` setting."""
    if isinstance(setting, dict):
        return ("EG" if setting.get("mode") == "EG" else "SA"), (setting.get("rules") or None)
    return "SA", None


def limits_for(year: int, eg_rules: dict | None = None) -> list[float]:
    lim = rules(eg_rules)["insLimits"]
    ys = sorted(int(y) for y in lim)
    y = int(year)
    y = min(max(y, ys[0]), ys[-1])
    return lim[str(y)]


def is_egyptian(nat) -> bool:
    s = str(nat or "").strip()
    return s.startswith("مصر") or bool(re.match(r"egypt", s, re.I))


def insured(emp: dict) -> bool:
    if emp.get("insSystem") in ("none", "exempt"):
        return False
    if emp.get("insSystem") == "eg":
        return True
    if (emp.get("excelCategory") or "") == "consultant" or "استشاري" in str(emp.get("jobTitle") or "") or "مهمة محددة" in str(emp.get("empType") or ""):
        return False
    return is_egyptian(emp.get("nationality"))


def ins_text(emp: dict) -> str:
    return "خاضع" if insured(emp) else "غير خاضع"


def tax_annual(a: float, eg_rules: dict | None = None) -> float:
    t, a = 0.0, max(0.0, _num(a))
    for lo, hi, pct in rules(eg_rules)["taxBrackets"]:
        lo_v, hi_v = _num(lo), (math.inf if hi is None else _num(hi))
        if a > lo_v:
            t += (min(a, hi_v) - lo_v) * _num(pct) / 100
    return t


def tax_monthly(taxable_monthly: float, eg_rules: dict | None = None) -> float:
    R = rules(eg_rules)
    return tax_annual(max(0.0, _num(taxable_monthly) * 12 - _num(R["taxExempt"])), eg_rules) / 12


def taxes(gross: float, ins_emp: float, eg_rules: dict | None = None) -> dict:
    R, g = rules(eg_rules), _num(gross)
    return {"tax": r2(tax_monthly(g - _num(ins_emp), eg_rules)), "mf": r2(g * _num(R["martyrs"]) / 100)}


def calc_ins_eg(emp: dict, wd: float, md: float, as_of: date, eg_rules: dict | None = None) -> dict:
    R = rules(eg_rules)
    wage = sum(_num(emp.get(k)) for k in ("salary", "housingAllowance", "transportAllowance", "projectAllowance", "otherAllowance"))
    gross = wage + _num(emp.get("extraAllowance"))
    frac = max(0.0, min(1.0, wd / md)) if md > 0 else 1.0
    ok = insured(emp) and wage > 0
    ins = ins_er = base = 0.0
    if ok:
        lo, hi = limits_for(as_of.year, eg_rules)
        base = min(hi, max(lo, wage)) * frac
        ins, ins_er = base * R["insEmp"] / 100, base * R["insEr"] / 100
    g = gross * frac
    tx = tax_monthly((g - ins) / (frac or 1), eg_rules) * frac if g > 0 else 0.0
    mf = g * _num(R["martyrs"]) / 100
    ins, tx, mf = r2(ins), r2(tx), r2(mf)
    return {"base": r2(base), "empAmt": r2(ins + tx + mf), "insOnly": ins, "taxAmt": tx, "mfAmt": mf, "erAmt": r2(ins_er),
            "status": "خاضع" if ok else "غير خاضع", "empRate": R["insEmp"] / 100 if ok else 0, "erRate": R["insEr"] / 100 if ok else 0}


def _add_years(d: date, n: int) -> date:
    try:
        return date(d.year + n, d.month, d.day)
    except ValueError:  # 29 Feb → JS rolls to the last day of the month
        return date(d.year + n, d.month + 1, 1) - timedelta(days=1)


def _age_at(dob: date, d: date) -> int:
    a = d.year - dob.year
    if (d.month, d.day) < (dob.month, dob.day):
        a -= 1
    return a


def _rate_for(idx: int, start: date, dob: date | None, eg_rules: dict | None) -> float:
    R = rules(eg_rules)
    if idx >= R["seniorYears"] or (dob and _age_at(dob, start) >= R["seniorAge"]):
        return R["leaveSenior"]
    return R["leaveFirst"] if idx == 0 else R["leaveStd"]


def leave_cum(join: date | None, end: date | None, dob: date | None, eg_rules: dict | None = None) -> float:
    if not join or not end or end <= join:
        return 0.0
    tot = 0.0
    for j in range(80):
        s = _add_years(join, j)
        if s >= end:
            break
        e = min(_add_years(join, j + 1), end)
        frac = (e - s).days / (_add_years(join, j + 1) - s).days
        tot += _rate_for(j, s, dob, eg_rules) * frac
    return tot


def _d(v) -> date | None:
    try:
        return date.fromisoformat(str(v)[:10]) if v else None
    except ValueError:
        return None


def annual_days(e: dict, at: date, eg_rules: dict | None = None) -> float:
    s = _d(e.get("contractJoin") or e.get("joinDate") or e.get("startDate"))
    if not s:
        return rules(eg_rules)["leaveStd"]
    idx = max(0, math.floor((at - s).days / 365.25))
    return _rate_for(idx, at, _d(e.get("dob") or e.get("birthDate")), eg_rules)


def accrued(e: dict, start: date, end: date, full_year_workdays: int, count_workdays: Callable[[date, date], int], eg_rules: dict | None = None) -> float:
    join, dob, R = _d(e.get("contractJoin") or e.get("joinDate") or e.get("startDate")), _d(e.get("dob") or e.get("birthDate")), rules(eg_rules)
    if not join:
        return min(R["leaveStd"], R["leaveStd"] * (count_workdays(start, end) / full_year_workdays))
    cuts = []
    for k in range(81):
        a = _add_years(join, k)
        if start < a <= end:
            cuts.append(a)
        if a > end:
            break
    segs, cur = [], start
    for c in cuts:
        segs.append((cur, c - timedelta(days=1)))
        cur = c
    segs.append((cur, end))
    tot = 0.0
    for a, b in segs:
        if b < a:
            continue
        idx = max(0, math.floor((a - join).days / 365.25))
        tot += _rate_for(idx, a, dob, eg_rules) * (count_workdays(a, b) / full_year_workdays)
    return tot


def is_workday_eg(js_day: int, eg_rules: dict | None = None) -> bool:
    """js_day = JS getDay() (Sunday 0 … Saturday 6)."""
    w = rules(eg_rules)["weekend"]
    return js_day != 5 if w == "fri" else js_day not in (5, 6)


def resign_factor(K: float, eg_rules: dict | None = None) -> float:
    T = rules(eg_rules)["resignTiers"]
    for i, (lim, f) in enumerate(T):
        if lim is None or K < lim or (K == lim and i == len(T) - 1):
            return _num(f)
    return 1.0
