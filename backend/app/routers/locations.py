"""Punch locations (مواقع البصمة) — CRUD."""

import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.audit import audit
from app.core.auth import get_current_user
from app.core.permissions import HR_ROLES, require_roles
from app.database import get_db
from app.models import User, Workplace
from app.schemas import LocationCreate, LocationOut, LocationUpdate
from app.services import locations as svc

router = APIRouter(tags=["locations"])

_WRITERS = require_roles(*HR_ROLES)


@router.get("/locations", response_model=list[LocationOut])
def list_locations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    locs = svc.list_all(db)
    wps = svc.workplaces_by_id(db, {l.workplace_id for l in locs if l.workplace_id})
    return [svc.to_out(l, wps.get(l.workplace_id)) for l in locs]


@router.post("/locations", response_model=LocationOut, status_code=201)
def create_location(body: LocationCreate, request: Request, user: User = Depends(_WRITERS), db: Session = Depends(get_db)):
    loc = svc.create(db, body)
    wp = db.get(Workplace, loc.workplace_id) if loc.workplace_id else None
    audit(db, request, user, "create", "location", loc.id)
    db.commit()
    db.refresh(loc)
    return svc.to_out(loc, wp)


@router.patch("/locations/{location_id}", response_model=LocationOut)
def update_location(location_id: uuid.UUID, body: LocationUpdate, request: Request, user: User = Depends(_WRITERS), db: Session = Depends(get_db)):
    loc = svc.get(db, location_id)
    changed = svc.update(loc, body)
    wp = db.get(Workplace, loc.workplace_id) if loc.workplace_id else None
    audit(db, request, user, "update", "location", loc.id, {"changed": changed})
    db.commit()
    return svc.to_out(loc, wp)


@router.delete("/locations/{location_id}", status_code=204)
def delete_location(location_id: uuid.UUID, request: Request, user: User = Depends(_WRITERS), db: Session = Depends(get_db)):
    loc = svc.get(db, location_id)
    svc.remove(loc)
    audit(db, request, user, "delete", "location", loc.id)
    db.commit()
