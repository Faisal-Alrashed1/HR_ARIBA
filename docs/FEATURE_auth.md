# Feature: authentication and accounts

## What it does
- Sign in with a **username** (the employee number, e.g. `emp084`) and password.
- Sessions: access token (1 h in Supabase's default) + refresh token; the frontend refreshes once on a 401.
- First sign-in with a temporary password forces a password change before anything else.
- HR/admin create logins for employees and issue temporary passwords; admins change roles.

## Flow
1. `POST /api/v1/auth/login {username, password}` → backend rate-limits, maps to `emp084@<INTERNAL_EMAIL_DOMAIN>`,
   calls Supabase `token?grant_type=password`, checks the `users` row (exists, same id, active), audits, and
   returns `{access_token, refresh_token, expires_in, user}`.
2. The frontend stores the tokens in cookies (`lib/session.ts`). `proxy.ts` reads the role claim
   (`app_metadata.role`, kept in sync by the backend) to redirect, as a mirror only.
3. Every API call: `Authorization: Bearer …` → `core/auth.py` → `users` row → role/scope checks.
4. If `must_change_password`: everything except `/me` and `/auth/change-password` returns 403
   `password_change_required`, and the frontend sends the user to `/me/settings?force=1`.

## Code
- Backend: `core/auth.py`, `core/identity.py`, `core/security.py` (rate limit, password policy), `services/accounts.py`, `routers/auth.py`, `routers/me.py`
- Frontend: `lib/auth.ts`, `lib/session.ts`, `lib/auth-context.tsx`, `proxy.ts`, `app/login/`, `app/me/settings/`, `components/me/change-password-form.tsx`
- Tests: `tests/test_auth.py`

## Bootstrap
`python -m app.services.seeds create-user --username emp084 --name-ar "…" --role admin` creates the employee
and login. The temporary password is written to `backend/.env.test.local`.

## Not verified
Real Supabase Auth (tests mock GoTrue with `respx`); JWKS verification.
