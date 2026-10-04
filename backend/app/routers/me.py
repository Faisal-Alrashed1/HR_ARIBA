"""The signed-in user's own account and employee record (employee app)."""

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.audit import audit
from app.core.auth import get_current_user, get_current_user_allow_pending
from app.core.errors import not_found
from app.database import get_db
from app.models import User
from app.schemas import EmployeeOut, UserOut
from app.services import employees as svc

router = APIRouter(prefix="/me", tags=["me"])


class MeOut(BaseModel):
    user: UserOut


@router.get("", response_model=MeOut)
def me(user: User = Depends(get_current_user_allow_pending)):
    return MeOut(user=UserOut.model_validate(user))


@router.get("/employee", response_model=EmployeeOut)
def my_employee(request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.employee_id is None:
        raise not_found("Employee")
    emp = svc.get_employee(db, user, user.employee_id)
    audit(db, request, user, "read", "employee", emp.id, {"self": True})
    db.commit()
    return svc.to_detail(db, emp, user)
