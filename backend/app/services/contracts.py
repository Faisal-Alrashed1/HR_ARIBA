"""Contract dates."""

import calendar
from datetime import date, timedelta


def add_months(d: date, months: int) -> date:
    """Same day `months` later, clamped to the last day of the target month
    (31 Jan + 1 month -> 28/29 Feb)."""
    m = d.month - 1 + months
    year, month = d.year + m // 12, m % 12 + 1
    day = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def fixed_term_end(join_date: date, duration_months: int) -> date:
    """End date of a fixed-term contract = join date + duration in months − 1 day
    (legacy addMonthsSafe: 2025-03-10 + 24 months → 2027-03-09)."""
    return add_months(join_date, duration_months) - timedelta(days=1)
