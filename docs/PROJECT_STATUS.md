# Project status

_Last updated: 2026-10-04 · branch `feat/foundation`_

Start here. This file says what exists, what has been checked, and what has **not** been checked.

## Design match (2026-10-04)
The frontend now reproduces the V114 prototypes' look exactly (prototype CSS, fonts, logo, wording, markup);
see `frontend/DESIGN.md`. Backend additions for the built screens: GOSI and end-of-service calculations,
salary figures on the employee record, live salary preview, full dashboard (KPIs, charts, expiry alerts),
document/photo uploads (Supabase Storage, or local disk in development), dependents, duplicate checks and
automatic employee numbers. New endpoints: `GET /dashboard`, `POST /employees/salary-preview`,
`GET|POST /employees/{id}/documents`, `GET /documents/{id}/file`, `DELETE /documents/{id}`,
`GET|PUT|DELETE /employees/{id}/photo`, `GET|POST /employees/{id}/dependents`, `PATCH|DELETE /dependents/{id}`,
`POST /dependents/{id}/documents`. The employee app has its own login at `/me/login`.

## Phase 1 — Foundation + Employees (done)

| Area | State |
|---|---|
| Repo layout (backend / frontend / docs) | ✅ |
| Baseline schema for every §3.3 entity (27 enums, 25 tables) | ✅ `0001_baseline_schema` |
| Reference data (workplaces, departments, nationalities, holidays, GOSI rules, settings, workflow stages) | ✅ `0002_seed_reference_data` |
| Supabase JWT auth (JWKS + HS256), username → internal email, refresh, logout | ✅ |
| Forced password change, temporary passwords, password policy | ✅ |
| Roles + data scope + salary/ID visibility | ✅ employees module |
| Error format, security headers, CORS allowlist, login rate limit, audit log | ✅ |
| Employees API (list/tabs/filters/search/sort/pagination, detail, create, update, terminate, reactivate, counts) | ✅ |
| Login accounts API (create, temporary password, role/active) | ✅ |
| Frontend: proxy (route mirror), `lib/api.ts`, i18n AR/EN + RTL, light/night theme, print CSS | ✅ |
| Frontend pages: login, dashboard (headcount KPIs), employees list, employee form (5 tabs), new employee, `/me` home + profile + settings | ✅ |
| Other screens | 🟡 placeholder pages so the navigation is complete |

### Verified
- `pytest`: 45 passed on SQLite (auth, employees, permissions, security, scheduling, migrations incl. model-drift guard).
- `npm run lint`, `tsc --noEmit`, `next build`: clean.
- Manual check in a browser against the local backend (SQLite + dev auth): login → forced password change →
  dashboard → employees list → create employee (fixed-term contract end auto-calculated) → detail;
  Arabic RTL and English LTR; light and night themes.

### Not verified yet (be honest here)
- **Nothing has run against Supabase yet.** Needs the dev/test project keys:
  - Supabase Auth sign-in/refresh/admin calls (only tested against mocked HTTP with `respx`).
  - JWKS (asymmetric) token verification.
  - Alembic on Postgres, native ENUM creation, RLS enabled on every table
    (`test_postgres_migrations_and_rls` is skipped until `TEST_DATABASE_URL` is set).
- Storage (`core/storage.py`) is written but unused and untested.
- Mobile layout of `/me` checked only by building, not on a phone.
- The login rate limiter is in-memory: correct for one backend process only.

## Decisions taken (with the business owner)
- EOS base = **basic + housing** everywhere.
- Service years = **actual days ÷ 365**.
- Saudization = **simple count** (no Nitaqat weighting for now).
- Approval stages per request type are **data** (`workflow_rules`): leaves/remote/advance → manager → HR → CEO;
  permission/maternity permission/early leave/overtime/mission → manager → HR; forgot punch → HR only.

Open questions found in the prototypes are listed at the end of [BUSINESS_RULES.md](BUSINESS_RULES.md).

## Next phases (proposed order)
1. Supabase hookup + verification of everything above · dependents · documents (Storage)
2. Leave (ledger, balances, holidays) · requests + approval workflow
3. Attendance (check-in, geofence, late, remote limit) · punch locations
4. Payroll + GOSI · payslips
5. End of service + settlement · templates/letters · alerts · full dashboard · reports
6. `import_from_v114.py` (one-time migration from the old Supabase project)

## API (v1)

All under `/api/v1` unless noted. 🔒 = needs a bearer token.

| Method | Path | Who |
|---|---|---|
| GET | `/health` (no prefix) | public |
| POST | `/auth/login` | public, rate-limited |
| POST | `/auth/refresh` | public (refresh token) |
| POST | `/auth/logout` | 🔒 any |
| POST | `/auth/change-password` | 🔒 any (incl. pending change) |
| POST | `/auth/users` | 🔒 hr, admin (admin accounts: admin only) |
| PATCH | `/auth/users/{id}` | 🔒 hr, admin (role: admin only) |
| POST | `/auth/users/{id}/temporary-password` | 🔒 hr, admin |
| GET | `/auth/users/by-employee/{employee_id}` | 🔒 hr, admin |
| GET | `/me` | 🔒 any (incl. pending change) |
| GET | `/me/employee` | 🔒 any with an employee record |
| GET | `/employees?tab=&q=&workplace_id=&department_id=&page=&page_size=&sort=` | 🔒 all but finance (scoped) |
| GET | `/employees/counts` | 🔒 all but finance (scoped) |
| POST | `/employees` | 🔒 hr, admin |
| GET | `/employees/{id}` | 🔒 all but finance (scoped; 404 outside scope) |
| PATCH | `/employees/{id}` | 🔒 hr, admin |
| POST | `/employees/{id}/terminate` | 🔒 hr, admin |
| POST | `/employees/{id}/reactivate` | 🔒 hr, admin |
| GET | `/settings/lookups` | 🔒 any |

OpenAPI docs at `/docs` in development only.

## Doc index
- [ARCHITECTURE.md](ARCHITECTURE.md) · [SECURITY.md](SECURITY.md) · [DATABASE.md](DATABASE.md) · [BUSINESS_RULES.md](BUSINESS_RULES.md)
- Features: [FEATURE_auth.md](FEATURE_auth.md) · [FEATURE_employees.md](FEATURE_employees.md)
- [backend/README.md](../backend/README.md) · [frontend/README.md](../frontend/README.md) · [frontend/DESIGN.md](../frontend/DESIGN.md)
