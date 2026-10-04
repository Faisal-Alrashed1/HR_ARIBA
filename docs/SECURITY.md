# Security

## Authentication
- Supabase Auth holds passwords. The backend calls GoTrue's password grant with the **anon** key and its
  admin API with the **service-role** key. The service-role key exists only in `backend/.env`.
- Every request carries `Authorization: Bearer <access token>`. `core/auth.py` verifies it:
  HS256 with `SUPABASE_JWT_SECRET` (legacy projects, dev, tests) or the project's JWKS (RS256/ES256),
  audience `authenticated`, `exp` and `sub` required, refresh tokens rejected.
- The token's `sub` must match an **active** row in `users`. Otherwise 401 (`unauthorized`) or 403 (`account_inactive`).
- **Password policy** (server and client): ≥ 8 characters, letters **and** digits, different from the old one.
  Changing a password re-verifies the current one.
- **Temporary passwords**: HR/admin issue them (shown once, never logged). `must_change_password` blocks every
  endpoint except `/me` and `/auth/change-password` (403 `password_change_required`).
- **Rate limit**: login allows 5 attempts per username and 20 per IP in 5 minutes (429). It is in-memory,
  so moving to more than one backend process needs a shared store. Change-password uses the same limiter.
- Dev-only `LocalDevIdentity` (PBKDF2-SHA256, 200k iterations, file `backend/.local_auth.json`) is refused
  when `ENV=production` or `SUPABASE_URL` is set, and config validation refuses production without Supabase.

## Authorization
Roles: `employee`, `manager`, `finance`, `hr`, `ceo`, `admin`. Every endpoint checks on the server;
the frontend (`proxy.ts`, hidden menu items) only mirrors it.

| Rule | Where |
|---|---|
| Role gates | `require_roles(...)` in each router |
| Data scope: employee → self; manager → self + direct reports; hr/ceo/admin → all; finance → no directory | `permissions.scope_employees` |
| Out-of-scope record → **404**, not 403 | scoped lookups in services |
| Salaries: finance, hr, admin, or the employee themselves | `permissions.can_view_salary` |
| Full ID / passport / insurance card / IBAN: hr, admin, or self; otherwise masked `******1234` | `permissions.can_view_full_ids` |
| Lists always mask the national ID and never include salaries | `employees.to_list_item` |
| Only admin changes roles or creates/resets admin accounts; nobody changes their own role or disables themselves | `services/accounts.py` |

**RLS** is enabled on every table in Postgres (including `alembic_version`) with **no policies**, so Supabase's
`anon` and `authenticated` roles can read nothing even if someone gets the anon key. The backend connects
as the table owner. This is the second layer; the first is the backend's own checks.

## Transport and headers
- CORS allowlist from `CORS_ORIGINS`; no credentials mode (bearer tokens only).
- API headers: `Content-Security-Policy: default-src 'none'`, `X-Frame-Options: DENY`, `nosniff`,
  `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, HSTS in production, `X-Request-ID`.
- Frontend headers (`next.config.ts`): CSP that allows `connect-src` to the API origin only, frame-ancestors none.
- OpenAPI docs only in development.

## Data protection (Saudi PDPL in mind)
- **Audit log** (`audit_logs`): logins (successful and failed), employee list and detail reads (noting whether
  salary or full IDs were returned), every write with the changed field **names** (not values), account changes.
  Each entry records actor, IP and request id.
- Minimum disclosure: masked IDs, salary hidden by role, notes hidden from roles without full-ID access.
- Uploads (from the documents phase): allowlisted MIME types checked against magic bytes (PDF, Word, JPG, PNG),
  12 MB max, private bucket, short-lived signed URLs, no base64 in the database.
- Secrets live only in `.env` files, which are git-ignored. `.env.example` files contain no values.

## Session handling in the browser
Access and refresh tokens are kept in first-party, `SameSite=Strict` cookies (`Secure` on HTTPS) so `proxy.ts`
can mirror routing. They are readable by JavaScript, the same exposure as supabase-js's default storage. The
strict CSP limits script injection. A possible hardening step: move tokens to httpOnly cookies behind a
Next.js backend-for-frontend.
