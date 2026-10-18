"""Push notifications to the employee app (Expo push service). The scheduler sends every notification not pushed yet
to the recipient's registered devices; a device Expo reports as gone is forgotten. PUSH_DISABLED=1 turns sending off."""
from __future__ import annotations

import logging
import os
from typing import Any

import httpx
from sqlalchemy import text
from sqlalchemy.orm import Session

log = logging.getLogger(__name__)
EXPO_URL = "https://exp.host/--/api/v2/push/send"


def _post(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    r = httpx.post(EXPO_URL, json=messages, timeout=15, headers={"Accept": "application/json"})
    r.raise_for_status()
    return (r.json() or {}).get("data") or []


def send_pending(db: Session, limit: int = 100, post=_post) -> dict[str, int]:
    rows = db.execute(text("""SELECT n.id,n.title,n.body,n.request_id,t.token FROM public.workflow_notifications n
        LEFT JOIN public.ariba_auth_accounts a ON a.employee_id=n.recipient_employee_id AND a.active
        LEFT JOIN public.ariba_push_tokens t ON t.account_id=a.id
        WHERE n.pushed_at IS NULL AND n.created_at > now() - interval '2 days' ORDER BY n.created_at LIMIT :l"""), {"l": limit}).mappings().all()
    ids = sorted({r["id"] for r in rows})
    msgs = [{"to": r["token"], "title": r["title"], "body": r["body"] or "", "sound": "default",
             "data": {"request_id": str(r["request_id"]) if r["request_id"] else None}} for r in rows if r["token"]]
    sent = gone = 0
    if msgs and os.environ.get("PUSH_DISABLED") != "1":
        for i in range(0, len(msgs), 100):
            batch = msgs[i:i + 100]
            try:
                tickets = post(batch)
            except httpx.HTTPError as exc:
                log.warning("expo push failed: %s", exc)
                return {"sent": sent, "gone": gone}  # rows stay unpushed; next run retries
            for m, t in zip(batch, tickets, strict=False):
                if t.get("status") == "ok":
                    sent += 1
                elif (t.get("details") or {}).get("error") == "DeviceNotRegistered":
                    db.execute(text("DELETE FROM public.ariba_push_tokens WHERE token=:t"), {"t": m["to"]})
                    gone += 1
    if ids:
        db.execute(text("UPDATE public.workflow_notifications SET pushed_at=now() WHERE id = ANY(:ids)"), {"ids": ids})
    db.commit()
    return {"sent": sent, "gone": gone}
