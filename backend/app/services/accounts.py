"""Login accounts: sign-in, password changes, temporary passwords, roles.

The identity provider (Supabase Auth) holds credentials; our `users` table holds role, status and
the link to the employee. Usernames are employee numbers (e.g. `emp084`).
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ApiError, forbidden, not_found
from app.core.identity import AuthSession, generate_temporary_password, get_identity, internal_email
from app.core.security import password_policy_errors
from app.models import Employee, Role, User

_INVALID = ApiError(401, "invalid_credentials", "Invalid username or password")


def sign_in(db: Session, username: str, password: str) -> tuple[AuthSession, User]:
    user = db.scalar(select(User).where(User.username == username))
    # Unknown users still go to the provider so timing doesn't reveal which usernames exist.
    session = get_identity().sign_in(internal_email(username), password)
    if user is None or user.id != session.user_id:
        raise _INVALID
    if not user.is_active:
        raise ApiError(403, "account_inactive", "This account is disabled")
    user.last_login_at = datetime.now(UTC)
    return session, user


def change_password(db: Session, user: User, old: str, new: str) -> None:
    errors = password_policy_errors(new, old)
    if errors:
        raise ApiError(422, "weak_password", errors[0], [{"field": "new_password", "message": e} for e in errors])
    # Re-verify the old password before changing it.
    try:
        get_identity().sign_in(internal_email(user.username), old)
    except ApiError as exc:
        if exc.code == "invalid_credentials":
            raise ApiError(422, "validation_error", "Current password is incorrect", [{"field": "old_password", "message": "Incorrect"}])
        raise
    get_identity().set_password(user.id, new)
    user.must_change_password = False


def create_account(db: Session, employee_id: uuid.UUID, role: Role, actor: User) -> tuple[User, str]:
    if role == Role.admin and actor.role != Role.admin:
        raise forbidden("Only an admin can create admin accounts")
    emp = db.get(Employee, employee_id)
    if emp is None or emp.deleted_at is not None:
        raise not_found("Employee")
    if emp.termination_date is not None:
        raise ApiError(409, "conflict", "Cannot create a login for a terminated employee")
    if db.scalar(select(User.id).where(User.employee_id == emp.id)):
        raise ApiError(409, "conflict", "This employee already has a login")
    username = emp.emp_no.lower()
    if db.scalar(select(User.id).where(User.username == username)):
        raise ApiError(409, "conflict", "This username is already taken")
    temp = generate_temporary_password()
    uid = get_identity().create_user(internal_email(username), temp, role.value)
    user = User(id=uid, username=username, role=role, employee_id=emp.id, is_active=True, must_change_password=True)
    db.add(user)
    db.flush()
    return user, temp


def issue_temporary_password(db: Session, target: User, actor: User) -> str:
    if target.role == Role.admin and actor.role != Role.admin:
        raise forbidden("Only an admin can reset an admin's password")
    temp = generate_temporary_password()
    get_identity().set_password(target.id, temp)
    target.must_change_password = True
    return temp


def update_account(db: Session, target: User, actor: User, role: Role | None, is_active: bool | None) -> list[str]:
    changed = []
    if role is not None and role != target.role:
        if actor.role != Role.admin:
            raise forbidden("Only an admin can change roles")
        if target.id == actor.id:
            raise ApiError(409, "conflict", "You cannot change your own role")
        get_identity().set_role(target.id, role.value)
        target.role = role
        changed.append("role")
    if is_active is not None and is_active != target.is_active:
        if target.id == actor.id:
            raise ApiError(409, "conflict", "You cannot disable your own account")
        if target.role == Role.admin and actor.role != Role.admin:
            raise forbidden()
        target.is_active = is_active
        changed.append("is_active")
    return changed
