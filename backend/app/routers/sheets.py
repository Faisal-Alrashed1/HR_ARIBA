"""Saved working sheets (payroll months first): GET/PUT the rows, approve/unapprove.

Keys follow the V114 HTML storage names: `pay_YYYY_MM` is the payroll of that month.
"""

import re
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import audit
from app.core.auth import get_current_user
from app.core.errors import ApiError, forbidden, not_found
from app.core.permissions import HR_ROLES, SALARY_ROLES
from app.database import get_db
from app.models import Role, Sheet, User

router = APIRouter(prefix="/sheets", tags=["sheets"])

_KEY = re.compile(r"^[a-z0-9_]{2,80}$")


class SheetOut(BaseModel):
    key: str
    data: Any = None
    approved: bool = False
    approved_at: datetime | None = None
    updated_at: datetime | None = None


class SheetIn(BaseModel):
    data: Any


def _check(key: str, user: User, write: bool) -> None:
    if not _KEY.match(key):
        raise ApiError(422, "invalid_key", "Invalid sheet key")
    allowed = SALARY_ROLES if key.startswith("pay_") else HR_ROLES
    if not write and key.startswith("pay_") and user.role == Role.ceo:
        return
    if user.role not in allowed:
        raise forbidden()


def _out(s: Sheet | None, key: str) -> SheetOut:
    if s is None:
        return SheetOut(key=key)
    return SheetOut(key=s.key, data=s.data, approved=s.approved, approved_at=s.approved_at, updated_at=s.updated_at)


@router.get("", response_model=list[SheetOut])
def list_sheets(prefix: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Sheets whose key starts with `prefix` (e.g. `pay_` for the payroll archive), without their rows."""
    _check(prefix.rstrip("_") + "_x", user, write=False)
    rows = db.scalars(select(Sheet).where(Sheet.key.startswith(prefix)).order_by(Sheet.key.desc()))
    return [SheetOut(key=s.key, approved=s.approved, approved_at=s.approved_at, updated_at=s.updated_at) for s in rows]


@router.get("/{key}", response_model=SheetOut)
def get_sheet(key: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _check(key, user, write=False)
    return _out(db.scalar(select(Sheet).where(Sheet.key == key)), key)


@router.put("/{key}", response_model=SheetOut)
def put_sheet(key: str, body: SheetIn, request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _check(key, user, write=True)
    s = db.scalar(select(Sheet).where(Sheet.key == key))
    if s is not None and s.approved:
        raise ApiError(409, "approved", "This sheet is approved and can no longer be edited")
    if s is None:
        s = Sheet(key=key)
        db.add(s)
    s.data = body.data
    s.updated_by = user.id
    audit(db, request, user, "save", "sheet", key)
    db.commit()
    db.refresh(s)
    return _out(s, key)


@router.post("/{key}/approve", response_model=SheetOut)
def approve_sheet(key: str, request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _check(key, user, write=True)
    s = db.scalar(select(Sheet).where(Sheet.key == key))
    if s is None:
        raise not_found("Sheet")
    s.approved, s.approved_at, s.approved_by = True, datetime.now(timezone.utc), user.id
    audit(db, request, user, "approve", "sheet", key)
    db.commit()
    db.refresh(s)
    return _out(s, key)


@router.post("/{key}/unapprove", response_model=SheetOut)
def unapprove_sheet(key: str, request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role not in HR_ROLES:
        raise forbidden()
    s = db.scalar(select(Sheet).where(Sheet.key == key))
    if s is None:
        raise not_found("Sheet")
    s.approved, s.approved_at, s.approved_by = False, None, None
    audit(db, request, user, "unapprove", "sheet", key)
    db.commit()
    db.refresh(s)
    return _out(s, key)
