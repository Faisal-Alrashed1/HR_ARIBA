"""Test setup: SQLite database migrated with Alembic (copied fresh for every test), HS256 tokens
for each role, and an in-memory identity provider."""

import os
import shutil
import time
import uuid
from datetime import date
from pathlib import Path

os.environ.update(
    ENV="test",
    DATABASE_URL="sqlite:///./.pytest-unused.db",
    SUPABASE_URL="",
    SUPABASE_JWT_SECRET="test-secret-0123456789-abcdefghijklmnop",
    RUN_MIGRATIONS_ON_STARTUP="false",
    CORS_ORIGINS="http://localhost:3000",
)

import jwt  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import select  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.core.errors import ApiError  # noqa: E402
from app.core.identity import AuthSession, set_identity_provider  # noqa: E402
from app.core.security import login_limiter  # noqa: E402
from app.database import get_db, make_engine  # noqa: E402
from app.main import create_app  # noqa: E402
from app.migrations import run_migrations  # noqa: E402
from app.models import Employee, Nationality, Role, User, Workplace  # noqa: E402


class FakeIdentity:
    """In-memory identity provider: {email: (user_id, password, role)}."""

    def __init__(self):
        self.users: dict[str, list] = {}

    def sign_in(self, email, password):
        rec = self.users.get(email)
        if not rec or rec[1] != password:
            raise ApiError(401, "invalid_credentials", "Invalid username or password")
        return AuthSession(make_token(rec[0]), "refresh-" + str(rec[0]), 3600, rec[0])

    def refresh(self, refresh_token):
        for uid, _pw, _role in self.users.values():
            if refresh_token == f"refresh-{uid}":
                return AuthSession(make_token(uid), refresh_token, 3600, uid)
        raise ApiError(401, "session_expired", "expired")

    def sign_out(self, access_token):
        pass

    def create_user(self, email, password, role):
        if email in self.users:
            raise ApiError(409, "conflict", "exists")
        uid = uuid.uuid4()
        self.users[email] = [uid, password, role]
        return uid

    def _rec(self, user_id):
        return next(r for r in self.users.values() if r[0] == user_id)

    def set_password(self, user_id, password):
        self._rec(user_id)[1] = password

    def set_role(self, user_id, role):
        self._rec(user_id)[2] = role


def make_token(user_id, exp_in: int = 3600, secret: str | None = None, **extra) -> str:
    now = int(time.time())
    claims = {"sub": str(user_id), "aud": "authenticated", "iat": now, "exp": now + exp_in, **extra}
    return jwt.encode(claims, secret or get_settings().supabase_jwt_secret, algorithm="HS256")


@pytest.fixture(scope="session")
def template_db(tmp_path_factory) -> Path:
    path = tmp_path_factory.mktemp("db") / "template.db"
    run_migrations(f"sqlite:///{path}")
    return path


@pytest.fixture
def engine(template_db, tmp_path):
    path = tmp_path / "test.db"
    shutil.copy(template_db, path)
    eng = make_engine(f"sqlite:///{path}")
    yield eng
    eng.dispose()


@pytest.fixture
def db(engine) -> Session:
    session = sessionmaker(bind=engine, expire_on_commit=False)()
    yield session
    session.close()


@pytest.fixture
def identity():
    fake = FakeIdentity()
    set_identity_provider(fake)
    yield fake
    set_identity_provider(None)


@pytest.fixture
def client(engine, identity) -> TestClient:
    app = create_app()
    SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def _get_db():
        s = SessionLocal()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[get_db] = _get_db
    login_limiter.clear()
    with TestClient(app) as c:
        yield c


# --------------------------------------------------------------------------- factories


@pytest.fixture
def ref(db):
    """Reference rows from the seed migration."""

    class R:
        ariba = db.scalar(select(Workplace).where(Workplace.code == "ariba"))
        optimum = db.scalar(select(Workplace).where(Workplace.code == "optimum"))
        saudi = db.scalar(select(Nationality).where(Nationality.code == "saudi"))
        egyptian = db.scalar(select(Nationality).where(Nationality.code == "egyptian"))

    return R


@pytest.fixture
def make_employee(db, ref):
    counter = iter(range(1, 10_000))

    def _make(**kw) -> Employee:
        n = next(counter)
        values = dict(
            emp_no=f"emp{900 + n}",
            name_ar=f"موظف {n}",
            workplace_id=ref.ariba.id,
            nationality_id=ref.egyptian.id,
            join_date=date(2022, 1, 1),
            national_id=f"2{n:09d}",
            basic_salary=10000,
            housing_allowance=2500,
        )
        values.update(kw)
        emp = Employee(**values)
        db.add(emp)
        db.commit()
        return emp

    return _make


@pytest.fixture
def make_user(db, make_employee):
    def _make(role: Role = Role.employee, employee: Employee | None = None, **kw) -> User:
        emp = employee or make_employee()
        user = User(
            id=uuid.uuid4(),
            username=emp.emp_no,
            role=role,
            employee_id=emp.id,
            must_change_password=kw.pop("must_change_password", False),
            **kw,
        )
        db.add(user)
        db.commit()
        return user

    return _make


def auth(user: User) -> dict:
    return {"Authorization": f"Bearer {make_token(user.id)}"}
