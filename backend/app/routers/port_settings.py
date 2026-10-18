"""Settings ported from their React system (docs/PORT_PLAN.md section 2): the runtime settings their engines read."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.routers.canonical import _app_setting, _gosi_settings, current_actor

router = APIRouter()

# Their lib/data.js SETTING_KEYS (the ones the formulas read).
RUNTIME_KEYS = {"insurance": "insurance_rules", "carry": "leave_carry", "accrual": "leave_accrual_method",
                "country": "country_system", "schedule": "attendance_schedule"}


@router.get("/settings/runtime")
def runtime_settings(actor: dict[str, Any] = Depends(current_actor), db: Session = Depends(get_db)):
    """The settings their `runtimePatchFromSettings` turns into the engines' runtime (rt): leave carry, accrual method,
    GOSI table (with the automatic periods merged, as getInsSettings), country layer and the work schedule."""
    out = {k: _app_setting(db, key) for k, key in RUNTIME_KEYS.items()}
    out["insurance"] = _gosi_settings(db)
    return out
