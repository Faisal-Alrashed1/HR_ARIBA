"""Contract dates."""

import calendar
from datetime import date


def add_months(d: date, months: int) -> date:
    """Same day `months` later, clamped to the last day of the target month
    (31 Jan + 1 month -> 28/29 Feb)."""
    m = d.month - 1 + months
    year, month = d.year + m // 12, m % 12 + 1
    day = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def fixed_term_end(join_date: date, duration_months: int) -> date:
    """End date of a fixed-term contract = join date + duration in months.
    Matches the V114 prototype (`addMonthsSafe(cj, dur)`) so imported dates stay unchanged."""
    return add_months(join_date, duration_months)
