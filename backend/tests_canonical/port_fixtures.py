"""Integration fixtures for the ported routes: a real Postgres built by tools/dev-db/build.sh (schema → normalization →
docs/db-migrations → synthetic data), the app with its database dependency pointed there, and signed-in clients.
Needs LEGACY_PARITY_PG (a local Postgres that may create databases); skipped otherwise."""
from __future__ import annotations

import os
import subprocess
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[2]
PASSWORD = "pytest-local-only"  # synthetic test database only
DB_NAME = "ariba_pytest_port"


@pytest.fixture(scope="session")
def port_engine():
    dsn = os.environ.get("LEGACY_PARITY_PG")
    if not dsn:
        pytest.skip("set LEGACY_PARITY_PG to a local Postgres that may create databases")
    url = make_url(dsn)
    env = {**os.environ, "ARIBA_DEV_PASSWORD": PASSWORD, "PGHOST": url.query.get("host") or url.host or "/tmp",
           "PGUSER": url.query.get("user") or url.username or "postgres"}
    subprocess.run(["bash", str(ROOT / "tools/dev-db/build.sh"), DB_NAME], check=True, env=env, capture_output=True)
    eng = create_engine(url.set(drivername="postgresql+psycopg", database=DB_NAME))
    os.environ["MAIL_DISABLED"] = "1"
    os.environ["PUSH_DISABLED"] = "1"
    os.environ["SCHEDULER_ENABLED"] = "0"
    os.environ.setdefault("MAIL_SECRET_KEY", "pytest-mail-secret-key-0123456789abcdef")
    yield eng
    eng.dispose()


@pytest.fixture(scope="session")
def api(port_engine):
    from app.database import get_db
    from app.main import app

    def db():
        s = Session(bind=port_engine)
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[get_db] = db
    client = TestClient(app, raise_server_exceptions=True)
    yield client
    app.dependency_overrides.pop(get_db, None)


_TOKENS: dict[str, str] = {}


def login(api: TestClient, username: str) -> dict[str, str]:
    if username not in _TOKENS:
        r = api.post("/api/v1/auth/login", json={"username": username, "password": PASSWORD})
        assert r.status_code == 200, r.text
        _TOKENS[username] = r.json()["access_token"]
    return {"Authorization": f"Bearer {_TOKENS[username]}"}


def sql(engine, statement: str, **params):
    from sqlalchemy import text
    with engine.begin() as cx:
        res = cx.execute(text(statement), params)
        try:
            return [dict(r) for r in res.mappings()]
        except Exception:  # noqa: BLE001 - statements without rows
            return []
