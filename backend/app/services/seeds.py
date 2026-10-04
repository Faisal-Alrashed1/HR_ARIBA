"""Command-line helpers for bootstrapping an environment.

    python -m app.services.seeds create-user --username emp084 --name-ar "..." --role admin

Creates (or reuses) the employee record and a login with a temporary password. The temporary
password is written to `.env.test.local` (git-ignored), never printed, and must be changed on
first sign-in.
"""

import argparse
from datetime import date
from pathlib import Path

from sqlalchemy import select

from app.core.identity import generate_temporary_password, get_identity, internal_email
from app.database import SessionLocal
from app.models import Employee, Role, User, Workplace

SECRETS_FILE = Path(".env.test.local")


def _record_secret(username: str, password: str) -> None:
    lines = SECRETS_FILE.read_text().splitlines() if SECRETS_FILE.exists() else []
    key = f"TEST_PASSWORD_{username.upper()}"
    lines = [ln for ln in lines if not ln.startswith(f"{key}=")]
    lines.append(f"{key}={password}")
    SECRETS_FILE.write_text("\n".join(lines) + "\n")


def create_user(username: str, name_ar: str, role: Role) -> None:
    username = username.strip().lower()
    with SessionLocal() as db:
        if db.scalar(select(User).where(User.username == username)):
            raise SystemExit(f"User {username} already exists")
        emp = db.scalar(select(Employee).where(Employee.emp_no == username))
        if emp is None:
            workplace = db.scalar(select(Workplace).where(Workplace.code == "ariba"))
            emp = Employee(emp_no=username, name_ar=name_ar, workplace_id=workplace.id if workplace else None, join_date=date.today())
            db.add(emp)
            db.flush()
        password = generate_temporary_password()
        uid = get_identity().create_user(internal_email(username), password, role.value)
        db.add(User(id=uid, username=username, role=role, employee_id=emp.id, must_change_password=True))
        db.commit()
    _record_secret(username, password)
    print(f"Created {role.value} login '{username}'. Temporary password saved to {SECRETS_FILE}.")


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.services.seeds")
    sub = parser.add_subparsers(dest="cmd", required=True)
    cu = sub.add_parser("create-user", help="Create an employee + login with a temporary password")
    cu.add_argument("--username", required=True)
    cu.add_argument("--name-ar", required=True)
    cu.add_argument("--role", choices=[r.value for r in Role], default="employee")
    args = parser.parse_args()
    if args.cmd == "create-user":
        create_user(args.username, args.name_ar, Role(args.role))


if __name__ == "__main__":
    main()
