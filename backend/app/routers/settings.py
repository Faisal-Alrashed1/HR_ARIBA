"""Reference data and company settings."""

from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.database import get_db
from app.models import Department, GosiRule, GosiSystem, Nationality, User, Workplace
from app.schemas import LookupOut, LookupsOut, NationalityOut

router = APIRouter(prefix="/settings", tags=["settings"])


class GosiRatesOut(BaseModel):
    """Effective GOSI rates for one date, as fractions (percentage / 100) in the shape the
    legacy payroll engine (frontend/legacy js/payroll/107-ariba-v119-payroll.js `rates`) expects."""

    match_emp: float
    match_emp_55: float
    match_er: float
    match_er_55: float
    no_match_emp: float
    no_match_emp_55: float
    no_match_er: float
    no_match_er_55: float
    non_saudi_er: float
    cap: float
    age_thr: int


@router.get("/lookups", response_model=LookupsOut)
def lookups(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return LookupsOut(
        workplaces=[LookupOut.model_validate(w) for w in db.scalars(select(Workplace).where(Workplace.is_active.is_(True)).order_by(Workplace.name_ar))],
        departments=[LookupOut.model_validate(d) for d in db.scalars(select(Department).where(Department.is_active.is_(True)).order_by(Department.name_ar))],
        nationalities=[NationalityOut.model_validate(n) for n in db.scalars(select(Nationality).order_by(Nationality.sort_order))],
    )


@router.get("/gosi-rates", response_model=GosiRatesOut)
def gosi_rates(on: date, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """The GOSI rules in force on `on` (the latest effective_from <= on per system), as fractions."""
    rules = list(db.scalars(select(GosiRule)))

    def effective(system: GosiSystem) -> GosiRule | None:
        candidates = [r for r in rules if r.system == system and r.effective_from <= on]
        return max(candidates, key=lambda r: r.effective_from) if candidates else None

    def fraction(system: GosiSystem, field: str) -> float:
        rule = effective(system)
        return float(getattr(rule, field)) / 100 if rule else 0.0

    matching = effective(GosiSystem.matching)
    non_matching = effective(GosiSystem.non_matching)
    non_saudi = effective(GosiSystem.non_saudi)
    any_rule = matching or non_matching or non_saudi

    return GosiRatesOut(
        match_emp=fraction(GosiSystem.matching, "employee_rate"),
        match_emp_55=fraction(GosiSystem.matching, "employee_rate_senior"),
        match_er=fraction(GosiSystem.matching, "employer_rate"),
        match_er_55=fraction(GosiSystem.matching, "employer_rate_senior"),
        no_match_emp=fraction(GosiSystem.non_matching, "employee_rate"),
        no_match_emp_55=fraction(GosiSystem.non_matching, "employee_rate_senior"),
        no_match_er=fraction(GosiSystem.non_matching, "employer_rate"),
        no_match_er_55=fraction(GosiSystem.non_matching, "employer_rate_senior"),
        non_saudi_er=fraction(GosiSystem.non_saudi, "employer_rate"),
        cap=float(any_rule.wage_cap) if any_rule else 45000.0,
        age_thr=any_rule.senior_age if any_rule else 55,
    )
