"""Reference data and company settings (read-only in this phase)."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.database import get_db
from app.models import Department, Nationality, User, Workplace
from app.schemas import LookupOut, LookupsOut, NationalityOut

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/lookups", response_model=LookupsOut)
def lookups(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return LookupsOut(
        workplaces=[LookupOut.model_validate(w) for w in db.scalars(select(Workplace).where(Workplace.is_active.is_(True)).order_by(Workplace.name_ar))],
        departments=[LookupOut.model_validate(d) for d in db.scalars(select(Department).where(Department.is_active.is_(True)).order_by(Department.name_ar))],
        nationalities=[NationalityOut.model_validate(n) for n in db.scalars(select(Nationality).order_by(Nationality.sort_order))],
    )
