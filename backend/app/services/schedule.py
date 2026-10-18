"""Work schedule (official + Ramadan) — port of their lib/schedule.js (rows 125–126), and the Ramadan flexible hours
of the missing `ariba_hr_set_ramadan_flex` (docs/PORT_PLAN.md section 5, item 3). Ramadan = the manual dates when both
are set, else month 9 of the Umm al-Qura calendar (what their browser's Intl `islamic-umalqura` calendar gives)."""
from __future__ import annotations

from datetime import date
from typing import Any

from hijridate import Gregorian

DEFAULT_SCHEDULE = {
    "enabled": False,
    "official": {"start": "08:00", "end": "17:00", "hours": 8, "grace": 15},
    "ramadan": {"start": "09:00", "end": "15:00", "hours": 6, "grace": 15},
    "ramadanAuto": True, "ramadanFrom": "", "ramadanTo": "",
}


def norm_schedule(s: Any) -> dict[str, Any]:
    d = DEFAULT_SCHEDULE
    s = s if isinstance(s, dict) else {}
    return {"enabled": bool(s.get("enabled")), "official": {**d["official"], **(s.get("official") or {})},
            "ramadan": {**d["ramadan"], **(s.get("ramadan") or {})}, "ramadanAuto": s.get("ramadanAuto") is not False,
            "ramadanFrom": s.get("ramadanFrom") or "", "ramadanTo": s.get("ramadanTo") or ""}


def hijri_month(day: date) -> int | None:
    try:
        return Gregorian(day.year, day.month, day.day).to_hijri().month
    except (ValueError, OverflowError):
        return None  # outside the Umm al-Qura table (1343–1500 AH)


def is_ramadan(day: date, cfg: Any) -> bool:
    c = norm_schedule(cfg)
    d = day.isoformat()
    if c["ramadanFrom"] and c["ramadanTo"]:
        return c["ramadanFrom"] <= d <= c["ramadanTo"]
    if not c["ramadanAuto"]:
        return False
    return hijri_month(day) == 9


def schedule_for(day: date, cfg: Any) -> dict[str, Any]:
    c = norm_schedule(cfg)
    r = is_ramadan(day, c)
    return {"kind": "ramadan" if r else "official", **(c["ramadan"] if r else c["official"])}


RAMADAN_FLEX_DEFAULT = {"enabled": False, "window_start": "09:00", "window_end": "15:00", "shift_hours": 6, "from": "", "to": ""}


def norm_ramadan_flex(v: Any) -> dict[str, Any]:
    v = v if isinstance(v, dict) else {}
    return {**RAMADAN_FLEX_DEFAULT, **{k: v[k] for k in RAMADAN_FLEX_DEFAULT if v.get(k) not in (None,)}}


def ramadan_today(day: date, flex: Any) -> bool:
    """Ramadan for the flexible hours: the card's own optional dates, else the automatic Hijri month."""
    f = norm_ramadan_flex(flex)
    if f["from"] and f["to"]:
        return f["from"] <= day.isoformat() <= f["to"]
    return hijri_month(day) == 9
