"""Annual leave ledger — a line-for-line port of the HR department's React engine
(ARIBA_HR_React/src/engines/leave.js, tools/react-parity/reference/engines/leave.js), checked by tools/react-parity.

Rules (as in their engine):
- Workday = not Friday/Saturday (Egypt: the configured weekend) and not an official holiday.
- Accrual for a year, by the chosen method (`leave_accrual_method`, default calendar):
  calendar = annual × calendar days elapsed ÷ days in the year · monthly = annual ÷ 12 per month (partial months
  pro rata) · workdays = annual × workdays elapsed ÷ workdays in the year; always ≤ annual, from max(join, 1 Jan).
- Used = baseline (override.used with asOf, else max(leaveUsed<year>, leaveHistoryByYear, override.used)) + approved
  annual requests that start in the year (after override.asOf), minus the workdays covered by an approved
  sick/emergency/death/marriage/paternity/maternity/hajj/umrah/unpaid leave (INTERRUPT_TYPES — those days return).
- Carry into a year: override.carry → 0 in the join year → previous override.carryNext → min(cap, close(previous)).
  The cap is the `leave_carry` setting ({enabled, days}, default 10; disabled = no cap).
- Close = override.yearEnd − used after it (only when the override also has carry), else
  max(0, opening + entitlement + adjustment − used). EOS excess per year = close − cap (override.eos wins), summed
  from the first year of service (the old leaveEosExcess field is not added: it was counted twice).
- Current = override.current − used after it + accrual since its date, else carry + accrued(today) + manual − used.
Override keys count when present (JS `!== undefined`), whatever their value.
Floats on purpose: their engine runs on JS numbers and rounds only for display.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any, Callable

from app.services import country as C

INTERRUPT_TYPES = ("sick", "emergency", "death", "marriage", "paternity", "maternity", "hajj", "umrah", "unpaid")
ACCRUAL_METHODS = ("calendar", "monthly", "workdays")
DEFAULT_CARRY = {"enabled": True, "days": 10}


def _d(v) -> date | None:
    if not v:
        return None
    if isinstance(v, date):
        return v
    try:
        return date.fromisoformat(str(v)[:10])
    except ValueError:
        return None


def _num(v) -> float:
    """JS Number(v) || 0 for the values the engine reads (None, '', bad text → 0)."""
    try:
        n = float(v)
    except (TypeError, ValueError):
        return 0.0
    return n if math.isfinite(n) else 0.0


def _has(o: dict | None, k: str) -> bool:
    return o is not None and k in o


@dataclass
class HolidayCalendar:
    rows: list[tuple[date, int, bool]]  # (start, days, recurring)
    _cache: dict[int, frozenset[date]] = field(default_factory=dict)

    def for_year(self, y: int) -> frozenset[date]:
        if y not in self._cache:
            out: set[date] = set()
            for base, days, recurring in self.rows:
                if recurring:
                    try:
                        start = date(y, base.month, base.day)
                    except ValueError:  # 29 Feb in a non-leap year: JS rolls over to 1 Mar
                        start = date(y, 3, 1)
                elif base.year != y:
                    continue
                else:
                    start = base
                for i in range(max(1, int(days or 1))):
                    out.add(start + timedelta(days=i))
            self._cache[y] = frozenset(out)
        return self._cache[y]

    def is_holiday(self, d: date) -> bool:
        return d in self.for_year(d.year)


def is_workday(d: date, country: str = "SA", eg_rules: dict | None = None) -> bool:
    # JS getDay(): Friday = 5, Saturday = 6. Python weekday(): Friday = 4, Saturday = 5.
    if country == "EG":
        return C.is_workday_eg((d.weekday() + 1) % 7, eg_rules)
    return d.weekday() not in (4, 5)


def legacy_employee(emp) -> dict:
    """The employee as their engine reads it (data JSONB + id + contractJoin + isTerminated), from an EmpView."""
    d = dict(getattr(emp, "data", None) or {})
    d["id"] = str(emp.id)
    join = d.get("contractJoin") or d.get("joinDate") or (emp.join_date.isoformat() if getattr(emp, "join_date", None) else "")
    d["contractJoin"] = join
    d["isTerminated"] = bool(getattr(emp, "is_terminated", False))
    return d


class LeaveBook:
    """Everything the ledger needs, loaded once. `today` is injectable for tests.

    leaves: every leave request [{empId, type, from, to, status}] (their rt.leaves); adjustments: [{empId, date, delta}].
    """

    def __init__(self, *, holidays: HolidayCalendar, leaves: list[dict] | None = None, adjustments: list[dict] | None = None,
                 today: date, method: str = "calendar", carry: dict | None = None, country: str = "SA", eg_rules: dict | None = None,
                 data: dict | None = None, approved_annual: dict | None = None):
        self.holidays = holidays
        self.leaves = list(leaves or [])
        if approved_annual:  # older callers: approved annual periods only
            for eid, periods in approved_annual.items():
                for f, t in periods:
                    self.leaves.append({"empId": str(eid), "type": "annual", "from": f.isoformat(), "to": t.isoformat(), "status": "approved"})
        self.adjustments = list(adjustments or [])
        self.today = today
        self.method = method if method in ACCRUAL_METHODS else "calendar"
        c = carry if isinstance(carry, dict) else DEFAULT_CARRY
        self.carry_setting = {"enabled": c.get("enabled", True) is not False, "days": _num(c.get("days"))} if carry is not None else dict(DEFAULT_CARRY)
        self.country = country
        self.eg_rules = eg_rules
        self._memo: dict = {}
        self._by_emp: dict[str, list[dict]] = {}
        for lv in self.leaves:
            self._by_emp.setdefault(str(lv.get("empId", lv.get("emp_id", ""))), []).append(lv)

    # ------------------------------------------------------------------ helpers
    def _e(self, emp) -> dict:
        return emp if isinstance(emp, dict) else legacy_employee(emp)

    def _memo_get(self, key, fn: Callable[[], Any]):
        if key not in self._memo:
            self._memo[key] = fn()
        return self._memo[key]

    def is_workday(self, d: date) -> bool:
        return is_workday(d, self.country, self.eg_rules)

    def count_workdays(self, start: date | None, end: date | None) -> int:
        if not start or not end or start > end:
            return 0
        key = ("wd", start, end)
        if key not in self._memo:
            n, d = 0, start
            while d <= end:
                if self.is_workday(d) and not self.holidays.is_holiday(d):
                    n += 1
                d += timedelta(days=1)
            self._memo[key] = n
        return self._memo[key]

    def workdays_in_year(self, y: int) -> int:
        return self.count_workdays(date(y, 1, 1), date(y, 12, 31))

    @staticmethod
    def emp_start(e: dict) -> date | None:
        return _d(e.get("contractJoin") or e.get("joinDate") or e.get("startDate"))

    def start_year(self, emp) -> int:
        d = self.emp_start(self._e(emp))
        return d.year if d else self.today.year

    def annual(self, emp, at: date | None = None) -> float:
        e = self._e(emp)
        if self.country == "EG":
            return C.annual_days(e, at or self.today, self.eg_rules)
        return max(0.0, _num(e.get("leaveDaysContract") or e.get("ldc") or 21) or 21.0)

    def override(self, emp, y: int) -> dict | None:
        o = (self._e(emp).get("leaveYearOverrides") or {}).get(str(int(y)))
        return o if isinstance(o, dict) else None

    # ------------------------------------------------------------------ accrual
    # Their engine parses 'YYYY-MM-DD' with new Date(), i.e. UTC midnight = 03:00 in Riyadh, and compares it with
    # local-midnight dates and with "now". Same-day comparisons therefore depend on the time of day; `flag` keeps
    # that order: 0 = local midnight (year/month bounds), 1 = a parsed date string (join date, override dates),
    # 2 = now. (Example: an employee who joins on 31 Dec accrues nothing that year in their engine.)
    NOW, PARSED, MIDNIGHT = 2, 1, 0

    def accrued(self, emp, y: int, to: date | None = None, flag: int | None = None) -> float:
        e = self._e(emp)
        end0 = to or date(y, 12, 31)
        f = flag if flag is not None else (self.NOW if to is not None and to == self.today else self.MIDNIGHT)
        key = ("accrued", e.get("id"), y, end0, f)
        return self._memo_get(key, lambda: self._accrued(e, y, (end0, f)))

    def _accrued(self, e: dict, y: int, end0: tuple[date, int]) -> float:
        y_start, y_end = (date(y, 1, 1), 0), (date(y, 12, 31), 0)
        annual, j = self.annual(e), self.emp_start(e)
        join = (j, self.PARSED) if j else None
        if join and join > y_end:
            return 0.0
        start = join if join and join > y_start else y_start
        end = min(end0, y_end)
        if end < start:
            return 0.0
        full = self.workdays_in_year(y)
        if full <= 0:
            return 0.0
        sd, ed = start[0], end[0]
        if self.country == "EG":
            return max(0.0, C.accrued(e, sd, ed, full, self.count_workdays, self.eg_rules))
        if self.method == "calendar":
            in_year = (date(y + 1, 1, 1) - date(y, 1, 1)).days
            return min(annual, max(0.0, annual * (((ed - sd).days + 1) / in_year)))
        if self.method == "monthly":
            m = 0.0
            for mo in range(1, 13):
                ms = (date(y, mo, 1), 0)
                me = (date(y, 12, 31) if mo == 12 else date(y, mo + 1, 1) - timedelta(days=1), 0)
                a, b = max(start, ms), min(end, me)
                if b >= a:
                    m += ((b[0] - a[0]).days + 1) / me[0].day
            return min(annual, max(0.0, (annual / 12) * m))
        return min(annual, max(0.0, annual * (self.count_workdays(sd, ed) / full)))

    def manual_net(self, emp, y: int, to: date | None = None) -> float:
        e = self._e(emp)
        end = to or date(y, 12, 31)
        eid = str(e.get("id", ""))
        total = 0.0
        for a in self.adjustments:
            if str(a.get("empId", a.get("emp_id", a.get("employee_id", "")))) != eid:
                continue
            d = _d(a.get("date") or a.get("createdAt"))
            if d and d.year == y and d <= end:
                total += _num(a.get("delta"))
        return total

    # ------------------------------------------------------------------ interrupted annual leave
    def _approved(self, lv: dict) -> bool:
        return str(lv.get("status") or "").lower() == "approved"

    @staticmethod
    def _type(lv: dict) -> str:
        return lv.get("type") or lv.get("leave_type") or "annual"

    @staticmethod
    def _from(lv: dict) -> date | None:
        return _d(lv.get("from") or lv.get("from_date") or lv.get("date"))

    def _to(self, lv: dict) -> date | None:
        return _d(lv.get("to") or lv.get("to_date") or lv.get("date")) or self._from(lv)

    def cover_map(self, eid: str) -> dict[date, str]:
        def build():
            m: dict[date, str] = {}
            for lv in self._by_emp.get(eid, []):
                if not self._approved(lv) or self._type(lv) not in INTERRUPT_TYPES:
                    continue
                f, t = self._from(lv), self._to(lv)
                if not f or not t:
                    continue
                d = f
                while d <= t:
                    m.setdefault(d, self._type(lv))
                    d += timedelta(days=1)
            return m
        return self._memo_get(("cover", eid), build)

    def annual_net_days(self, lv: dict, up_to: date | None = None) -> dict:
        eid = str(lv.get("empId", lv.get("emp_id", "")))
        f, t = self._from(lv), self._to(lv)
        if up_to and t and t > up_to:
            t = up_to
        cover = self.cover_map(eid)
        days = refunded = 0
        by_type: dict[str, int] = {}
        if f and t:
            d = f
            while d <= t:
                if self.is_workday(d) and not self.holidays.is_holiday(d):
                    c = cover.get(d)
                    if c:
                        refunded += 1
                        by_type[c] = by_type.get(c, 0) + 1
                    else:
                        days += 1
                d += timedelta(days=1)
        return {"days": days, "refunded": refunded, "byType": by_type}

    def overlap_with_annual(self, eid: str, type_: str, f: date | None, t: date | None) -> int:
        """Workdays of a new (non-annual) leave that fall inside an approved annual leave — they return to the balance."""
        if type_ not in INTERRUPT_TYPES or not f or not t:
            return 0
        want = set()
        d = f
        while d <= t:
            if self.is_workday(d) and not self.holidays.is_holiday(d):
                want.add(d)
            d += timedelta(days=1)
        cover, n = self.cover_map(str(eid)), 0
        for lv in self._by_emp.get(str(eid), []):
            if self._type(lv) != "annual" or not self._approved(lv):
                continue
            a, b = self._from(lv), self._to(lv)
            d = a
            while a and b and d <= b:
                if d in want and d not in cover:
                    n += 1
                d += timedelta(days=1)
        return n

    # ------------------------------------------------------------------ used
    def default_used(self, emp, y: int, to: date | None = None) -> float:
        e = self._e(emp)
        end = to or date(y, 12, 31)
        return self._memo_get(("used", e.get("id"), y, end), lambda: self._default_used(e, y, end))

    def _default_used(self, e: dict, y: int, end: date) -> float:
        eid = str(e.get("id", ""))
        ov = (e.get("leaveYearOverrides") or {}).get(str(y))
        ov = ov if isinstance(ov, dict) else None
        snap = _d(ov.get("asOf")) if ov and ov.get("asOf") else None
        req = 0
        for lv in self._by_emp.get(eid, []):
            if self._type(lv) != "annual" or not self._approved(lv):
                continue
            f, t = self._from(lv), self._to(lv)
            if not f or not t or f.year != y or f > end:
                continue
            if snap and f < snap:
                continue
            req += self.annual_net_days(lv, end if t > end else None)["days"]
        if ov and ov.get("asOf") and "used" in ov:
            baseline = max(0.0, _num(ov.get("used")))
        else:
            hist = e.get("leaveHistoryByYear") if isinstance(e.get("leaveHistoryByYear"), dict) else {}
            baseline = max(_num(e.get("leaveUsed" + str(y))), _num(hist.get(str(y))), _num((ov or {}).get("used")))
        return baseline + req

    def used_for(self, emp, y: int, end: date) -> float:
        o, cy = self.override(emp, y), self.today.year
        if _has(o, "used") and y < cy and not o.get("asOf"):
            return max(0.0, _num(o["used"]))
        return self.default_used(emp, y, end)

    def used_delta(self, emp, y: int, end: date) -> float:
        o = self.override(emp, y)
        if not _has(o, "used"):
            return 0.0
        return max(0.0, self.used_for(emp, y, end) - _num(o["used"]))

    # ------------------------------------------------------------------ carry / ledger
    def carry_cap(self) -> float:
        c = self.carry_setting
        return max(0.0, _num(c.get("days"))) if c.get("enabled") else math.inf

    def eos_of(self, close: float) -> float:
        cap = self.carry_cap()
        return 0.0 if cap == math.inf else max(0.0, _num(close) - cap)

    def carry_forward(self, emp, y: int) -> float:
        o = self.override(emp, y)
        if _has(o, "carry"):
            return max(0.0, _num(o["carry"]))
        if y == self.start_year(emp):
            return 0.0
        po = self.override(emp, y - 1)
        if _has(po, "carryNext"):
            return max(0.0, _num(po["carryNext"]))
        return min(self.carry_cap(), max(0.0, self.year_closing(emp, y - 1)))

    def ledger(self, emp, y: int) -> dict:
        e = self._e(emp)
        return self._memo_get(("ledger", e.get("id"), y), lambda: self._ledger(e, y))

    def _ledger(self, e: dict, y: int) -> dict:
        y_end = date(y, 12, 31)
        o = self.override(e, y)
        opening = self.carry_forward(e, y)
        entitlement = max(0.0, _num(o["entitlement"])) if _has(o, "entitlement") else self.accrued(e, y, y_end, self.MIDNIGHT)
        used = self.used_for(e, y, y_end)
        adjustment = _num(o["adjustment"]) if _has(o, "adjustment") else self.manual_net(e, y)
        if _has(o, "yearEnd") and _has(o, "carry"):
            close = max(0.0, _num(o["yearEnd"]) - self.used_delta(e, y, y_end))
        else:
            close = max(0.0, opening + entitlement + adjustment - used)
        carry = max(0.0, _num(o["carryNext"])) if _has(o, "carryNext") else min(self.carry_cap(), max(0.0, close))
        eos = max(0.0, _num(o["eos"])) if _has(o, "eos") else self.eos_of(close)
        return {"year": y, "opening": opening, "entitlement": entitlement, "used": used, "adjustment": adjustment,
                "close": close, "carry": carry, "eos": eos, "override": o}

    def year_closing(self, emp, y: int) -> float:
        o = self.override(emp, y)
        if y < self.start_year(emp):
            return 0.0
        y_end = date(y, 12, 31)
        if _has(o, "yearEnd") and _has(o, "carry"):
            return max(0.0, _num(o["yearEnd"]) - self.used_delta(emp, y, y_end))
        if y == self.today.year:
            return max(0.0, self.carry_forward(emp, y) + self.accrued(emp, y, y_end, self.MIDNIGHT) + self.manual_net(emp, y) - self.default_used(emp, y, y_end))
        return self.ledger(emp, y)["close"]

    def current(self, emp) -> float:
        y, now = self.today.year, self.today
        o = self.override(emp, y)
        if _has(o, "current"):
            base = max(0.0, _num(o["current"]) - self.used_delta(emp, y, now))
            d = _d(o.get("currentAsOf") or o.get("updatedAt"))
            if d and d.year == y and d <= now:  # a parsed date is 03:00, before "now" on the same day
                base += max(0.0, self.accrued(emp, y, now, self.NOW) - self.accrued(emp, y, d, self.PARSED))
            return max(0.0, base)
        return max(0.0, self.carry_forward(emp, y) + self.accrued(emp, y, now) + self.manual_net(emp, y, now) - self.default_used(emp, y, now))

    # The employee app and the manager's team read the same figures (decision 4: no browser snapshots).
    def app_current(self, emp) -> float:
        return self.current(emp)

    def projected_year_end(self, emp, y: int | None = None) -> float:
        return self.year_closing(emp, y or self.today.year)

    def app_year_end(self, emp) -> float:
        return self.projected_year_end(emp)

    def year_excess(self, emp, y: int) -> float:
        o = self.override(emp, y)
        if _has(o, "eos"):
            return max(0.0, _num(o["eos"]))
        return self.eos_of(self.year_closing(emp, y))

    def accumulated_eos(self, emp, end_year: int | None = None) -> float:
        start, end = self.start_year(emp), end_year or self.today.year
        return max(0.0, sum(self.year_excess(emp, y) for y in range(start, end)))

    def cumulative_accrued(self, emp) -> float:
        cy, t = self.today.year, 0.0
        for y in range(self.start_year(emp), cy + 1):
            o = self.override(emp, y)
            t += max(0.0, _num(o["entitlement"])) if _has(o, "entitlement") and y < cy else self.accrued(emp, y, self.today if y == cy else date(y, 12, 31), self.NOW if y == cy else self.MIDNIGHT)
        return t

    def cumulative_used(self, emp) -> float:
        cy = self.today.year
        return sum(self.used_for(emp, y, self.today if y == cy else date(y, 12, 31)) for y in range(self.start_year(emp), cy + 1))

    def cumulative_manual(self, emp) -> float:
        cy, t = self.today.year, 0.0
        for y in range(self.start_year(emp), cy + 1):
            o = self.override(emp, y)
            t += _num(o["adjustment"]) if _has(o, "adjustment") else self.manual_net(emp, y, self.today if y == cy else date(y, 12, 31))
        return t

    def cumulative_balance(self, emp) -> float:
        return max(0.0, self.cumulative_accrued(emp) - self.cumulative_used(emp) + self.cumulative_manual(emp))

    def used_through(self, emp, end: date) -> float:
        """Their payroll `usedThrough`: annual leave taken from the start of service up to `end`."""
        total = 0.0
        for y in range(self.start_year(emp), end.year + 1):
            o = self.override(emp, y)
            if _has(o, "used") and y < end.year:
                total += max(0.0, _num(o["used"]))
            else:
                total += _num(self.default_used(emp, y, end if y == end.year else date(y, 12, 31)))
        return round(total * 100) / 100

    def summary(self, emp) -> dict:
        """One row of the balances table (Balances.jsx / leaveSnapshot)."""
        y = self.today.year
        accrued, used = self.cumulative_accrued(emp), self.cumulative_used(emp)
        return {
            "employee_id": str(self._e(emp).get("id")),
            "carry": round(self.carry_forward(emp, y), 2),
            "current": round(self.current(emp), 2),
            "year_end": round(self.year_closing(emp, y), 2),
            "accrued_since_join": round(accrued, 2),
            "used_since_join": round(used, 2),
            "remaining_since_join": round(self.cumulative_balance(emp), 2),
            "eos": round(self.accumulated_eos(emp, y), 2),
        }

    def years(self, emp) -> list[dict]:
        out = []
        for y in range(self.start_year(emp), self.today.year + 1):
            led = self.ledger(emp, y)
            out.append({k: (round(v, 2) if isinstance(v, float) else v) for k, v in led.items() if k != "override"} | {"override": led["override"]})
        return out


def request_days(book: LeaveBook, type_, start: date, end: date) -> int:
    """Days of a request: annual = workdays (no weekend, no holidays); other types = calendar days (their rule)."""
    if getattr(type_, "value", type_) == "annual":
        return book.count_workdays(start, end)
    return (end - start).days + 1
