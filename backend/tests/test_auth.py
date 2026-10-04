import httpx
import respx

from app.config import Settings
from app.core.identity import SupabaseIdentity, internal_email, set_identity_provider
from app.core.security import password_policy_errors
from app.models import Role
from tests.conftest import auth, make_token


def _register(identity, user, password="secret123a"):
    identity.users[internal_email(user.username)] = [user.id, password, user.role.value]


def test_login_success_returns_session_and_profile(client, identity, make_user):
    user = make_user(Role.hr)
    _register(identity, user)
    r = client.post("/api/v1/auth/login", json={"username": user.username.upper(), "password": "secret123a"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["access_token"] and body["refresh_token"]
    assert body["user"]["role"] == "hr"
    assert body["user"]["employee"]["emp_no"] == user.username


def test_login_wrong_password_uses_error_format(client, identity, make_user):
    user = make_user()
    _register(identity, user)
    r = client.post("/api/v1/auth/login", json={"username": user.username, "password": "nope"})
    assert r.status_code == 401
    err = r.json()["error"]
    assert err["code"] == "invalid_credentials"
    assert err["request_id"]


def test_login_inactive_user_rejected(client, identity, make_user):
    user = make_user(is_active=False)
    _register(identity, user)
    r = client.post("/api/v1/auth/login", json={"username": user.username, "password": "secret123a"})
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "account_inactive"


def test_login_rate_limited_after_five_attempts(client, identity, make_user):
    user = make_user()
    _register(identity, user)
    for _ in range(5):
        assert client.post("/api/v1/auth/login", json={"username": user.username, "password": "bad"}).status_code == 401
    r = client.post("/api/v1/auth/login", json={"username": user.username, "password": "secret123a"})
    assert r.status_code == 429
    assert r.json()["error"]["code"] == "rate_limited"


def test_refresh(client, identity, make_user):
    user = make_user()
    _register(identity, user)
    r = client.post("/api/v1/auth/refresh", json={"refresh_token": f"refresh-{user.id}"})
    assert r.status_code == 200
    assert r.json()["user"]["id"] == str(user.id)


def test_missing_bad_and_expired_tokens(client, make_user):
    user = make_user()
    assert client.get("/api/v1/me").status_code == 401
    bad = {"Authorization": f"Bearer {make_token(user.id, secret='wrong-secret-wrong-secret-wrong-secret')}"}
    assert client.get("/api/v1/me", headers=bad).status_code == 401
    expired = {"Authorization": f"Bearer {make_token(user.id, exp_in=-10)}"}
    r = client.get("/api/v1/me", headers=expired)
    assert r.status_code == 401 and r.json()["error"]["code"] == "session_expired"
    refresh_tok = {"Authorization": f"Bearer {make_token(user.id, typ='refresh')}"}
    assert client.get("/api/v1/me", headers=refresh_tok).status_code == 401


def test_token_for_unknown_or_inactive_user(client, db, make_user):
    import uuid

    assert client.get("/api/v1/me", headers={"Authorization": f"Bearer {make_token(uuid.uuid4())}"}).status_code == 401
    user = make_user(is_active=False)
    r = client.get("/api/v1/me", headers=auth(user))
    assert r.status_code == 403 and r.json()["error"]["code"] == "account_inactive"


def test_forced_password_change_blocks_other_endpoints(client, identity, make_user):
    user = make_user(Role.hr, must_change_password=True)
    _register(identity, user, "temp1234x")
    assert client.get("/api/v1/me", headers=auth(user)).status_code == 200
    r = client.get("/api/v1/employees", headers=auth(user))
    assert r.status_code == 403 and r.json()["error"]["code"] == "password_change_required"

    r = client.post(
        "/api/v1/auth/change-password",
        headers=auth(user),
        json={"old_password": "temp1234x", "new_password": "newpass99"},
    )
    assert r.status_code == 204, r.text
    assert client.get("/api/v1/employees", headers=auth(user)).status_code == 200
    assert identity.users[internal_email(user.username)][1] == "newpass99"


def test_change_password_rules(client, identity, make_user):
    user = make_user()
    _register(identity, user, "oldpass11")
    url, h = "/api/v1/auth/change-password", auth(user)
    r = client.post(url, headers=h, json={"old_password": "wrong", "new_password": "newpass99"})
    assert r.status_code == 422 and r.json()["error"]["details"][0]["field"] == "old_password"
    r = client.post(url, headers=h, json={"old_password": "oldpass11", "new_password": "oldpass11"})
    assert r.status_code == 422 and r.json()["error"]["code"] == "weak_password"
    r = client.post(url, headers=h, json={"old_password": "oldpass11", "new_password": "short1"})
    assert r.status_code == 422


def test_password_policy():
    assert password_policy_errors("abc12345") == []
    assert password_policy_errors("كلمةسر123") == []
    assert password_policy_errors("abc1234")  # too short
    assert password_policy_errors("abcdefgh")  # no digit
    assert password_policy_errors("12345678")  # no letter
    assert password_policy_errors("abc12345", old="abc12345")  # same as old


def test_hr_creates_account_and_resets_password(client, identity, make_user, make_employee):
    hr = make_user(Role.hr)
    emp = make_employee()
    r = client.post("/api/v1/auth/users", headers=auth(hr), json={"employee_id": str(emp.id)})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["user"]["username"] == emp.emp_no
    assert body["user"]["must_change_password"] is True
    temp = body["temporary_password"]
    assert len(password_policy_errors(temp)) == 0
    # second account for the same employee is refused
    assert client.post("/api/v1/auth/users", headers=auth(hr), json={"employee_id": str(emp.id)}).status_code == 409

    user_id = body["user"]["id"]
    r = client.post(f"/api/v1/auth/users/{user_id}/temporary-password", headers=auth(hr))
    assert r.status_code == 200 and r.json()["temporary_password"] != temp


def test_only_admin_changes_roles(client, identity, make_user):
    hr = make_user(Role.hr)
    admin = make_user(Role.admin)
    target = make_user(Role.employee)
    _register(identity, target)
    r = client.patch(f"/api/v1/auth/users/{target.id}", headers=auth(hr), json={"role": "manager"})
    assert r.status_code == 403
    r = client.patch(f"/api/v1/auth/users/{target.id}", headers=auth(admin), json={"role": "manager"})
    assert r.status_code == 200 and r.json()["role"] == "manager"
    assert identity.users[internal_email(target.username)][2] == "manager"
    r = client.post("/api/v1/auth/users", headers=auth(hr), json={"employee_id": str(target.employee_id), "role": "admin"})
    assert r.status_code == 403


@respx.mock
def test_supabase_identity_password_grant():
    s = Settings(env="test", supabase_url="https://example.supabase.co", supabase_anon_key="anon")
    route = respx.post("https://example.supabase.co/auth/v1/token?grant_type=password").mock(
        return_value=httpx.Response(
            200,
            json={
                "access_token": "a",
                "refresh_token": "r",
                "expires_in": 3600,
                "user": {"id": "6f1c2b9e-1111-4c1a-9a2b-0123456789ab"},
            },
        )
    )
    session = SupabaseIdentity(s).sign_in("emp084@users.ariba-hr.internal", "pw")
    assert route.called
    assert route.calls.last.request.headers["apikey"] == "anon"
    assert str(session.user_id) == "6f1c2b9e-1111-4c1a-9a2b-0123456789ab"

    respx.post("https://example.supabase.co/auth/v1/token?grant_type=password").mock(
        return_value=httpx.Response(400, json={"error": "invalid_grant"})
    )
    try:
        SupabaseIdentity(s).sign_in("x@y.z", "bad")
        raise AssertionError("expected failure")
    except Exception as exc:  # ApiError
        assert getattr(exc, "code", None) == "invalid_credentials"


def test_local_dev_identity_round_trip(tmp_path):
    from app.core.identity import LocalDevIdentity

    s = Settings(env="development", supabase_url="", supabase_jwt_secret="x" * 40)
    idp = LocalDevIdentity(s, path=tmp_path / "auth.json")
    uid = idp.create_user("emp001@users.ariba-hr.internal", "pass1234a", "hr")
    session = idp.sign_in("emp001@users.ariba-hr.internal", "pass1234a")
    assert session.user_id == uid
    assert idp.refresh(session.refresh_token).user_id == uid
    try:
        idp.sign_in("emp001@users.ariba-hr.internal", "wrong")
        raise AssertionError("expected failure")
    except Exception as exc:
        assert getattr(exc, "code", None) == "invalid_credentials"


def test_local_dev_identity_refused_in_production():
    import pytest

    from app.core.identity import LocalDevIdentity

    s = Settings.model_construct(env="production", supabase_url="", supabase_jwt_secret="x" * 40)
    with pytest.raises(RuntimeError):
        LocalDevIdentity(s)
    set_identity_provider(None)
