"""Background jobs that replace their browser timers and Supabase cron (docs/17_PORT_PLAN.md section 2):
- every hour: move requests whose manager/CEO wait ran out to HR (ariba_hr_run_escalation);
- every 5 minutes: e-mail the new notifications (ariba-notify-dispatch) and push them to the app;
- every minute: register new candidates automatically when HR turned it on (their CandAuto).
Each job takes a Postgres advisory lock, so with several API instances only one runs it. SCHEDULER_ENABLED=0 turns it off
(the tests and one-off scripts do)."""
from __future__ import annotations

import asyncio
import logging
import os
from collections.abc import Callable
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

log = logging.getLogger(__name__)
LOCK_BASE = 7_340_000  # advisory lock ids 7340001…


def _escalation(db: Session) -> Any:
    from app.routers.port_workflow import run_escalation
    n = run_escalation(db)
    db.commit()
    return n


def _notify(db: Session) -> Any:
    from app.routers.port_mail import dispatch_notifications
    from app.services.push import send_pending
    return {"mail": dispatch_notifications(db), "push": send_pending(db)}


def _candidates(db: Session) -> Any:
    from app.routers.port_candidates import auto_register
    n = auto_register(db)
    db.commit()
    return n


JOBS: list[tuple[str, int, Callable[[Session], Any]]] = [("escalation", 3600, _escalation), ("notify", 300, _notify), ("candidates", 60, _candidates)]


def run_job(session_factory: Callable[[], Session], lock_id: int, name: str, fn: Callable[[Session], Any]) -> Any:
    db = session_factory()
    try:
        if not db.execute(text("SELECT pg_try_advisory_lock(:k)"), {"k": lock_id}).scalar():
            return None
        try:
            return fn(db)
        except Exception:  # noqa: BLE001 — one failing run must not stop the loop
            db.rollback()
            log.exception("scheduled job %s failed", name)
            return None
        finally:
            db.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": lock_id})
            db.commit()
    finally:
        db.close()


async def _loop(session_factory: Callable[[], Session], lock_id: int, name: str, every: int, fn: Callable[[Session], Any]) -> None:
    await asyncio.sleep(5 + lock_id % 7)
    while True:
        await asyncio.to_thread(run_job, session_factory, lock_id, name, fn)
        await asyncio.sleep(every)


def enabled() -> bool:
    return os.environ.get("SCHEDULER_ENABLED", "1") != "0"


def start(session_factory: Callable[[], Session]) -> list[asyncio.Task[None]]:
    if not enabled():
        return []
    return [asyncio.create_task(_loop(session_factory, LOCK_BASE + i + 1, name, every, fn)) for i, (name, every, fn) in enumerate(JOBS)]
