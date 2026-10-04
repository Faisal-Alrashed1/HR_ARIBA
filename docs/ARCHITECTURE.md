# Architecture

```
Browser ──HTTPS/JSON──▶ FastAPI (/api/v1) ──SQLAlchemy──▶ Supabase Postgres (RLS on, no policies)
   │                         │
   │ Next.js pages           ├──httpx──▶ Supabase Auth (GoTrue): sign-in, refresh, admin
   │ proxy.ts (route mirror) └──httpx──▶ Supabase Storage (private bucket, signed URLs)
```

## Principles
1. **The backend owns everything that matters**: state, rules, calculations and permissions.
   The frontend renders data and sends user actions. A native mobile app can use the same API later.
2. **One place per concern.** Thin routers (HTTP only) → services (business logic, pure where possible)
   → models. All `fetch` calls are in `frontend/src/lib/api.ts`.
3. **One calculation per rule**, used by both apps. This fixes the prototype, where the HR portal and the
   employee app computed leave differently.
4. **Normalized data.** One column per fact, no JSON blobs, no aliased field names, files in Storage.

## Backend (`backend/app`)
| Path | Role |
|---|---|
| `main.py` | app factory: CORS, security headers, request ids, error handlers, routers |
| `config.py` | settings from `.env`, validated at startup (production refuses SQLite / missing Supabase keys) |
| `database.py` | engine + session; Postgres via psycopg 3, SQLite for quick tests |
| `models.py` / `schemas.py` | every table + enum / every request + response shape |
| `migrations.py` | Alembic runner (startup in dev, tests) |
| `core/` | auth, identity provider, permissions, security, errors, audit, storage, scheduling, language, pagination |
| `routers/` | one file per resource |
| `services/` | business logic; stubs document the phases still to come |

**Request lifecycle**: security-headers middleware assigns a request id → CORS → router dependency
`get_current_user` verifies the JWT and loads the `users` row (active? must change password?) →
`require_roles(...)` → service applies the data scope → audit entry added in the same transaction → commit.

**Identity.** Supabase Auth stores credentials. Our `users` table stores role, status and the employee link,
keyed by the Supabase user id (`sub`). Usernames are employee numbers mapped to internal emails
(`emp084` → `emp084@users.ariba-hr.internal`). Login goes through the backend, so rate limiting and the
inactive check happen on the server. `LocalDevIdentity` stands in for GoTrue in development only.

## Frontend (`frontend/src`)
| Path | Role |
|---|---|
| `proxy.ts` | Next 16's replacement for `middleware.ts`: redirects by session and role (mirror only) |
| `app/` | one folder per route; HR pages at the top level, the employee app under `me/` |
| `components/` | `ui/` primitives, `nav/` shells (HR sidebar, employee bottom nav), feature components |
| `lib/api.ts` | the only `fetch`; all API types; refresh-on-401; `ApiError` |
| `lib/<area>.ts` | typed helpers per area (`auth.ts`, `employees.ts`) |
| `lib/i18n/` | `ar.ts` (source of keys), `en.ts`, `locale.tsx` |
| `lib/session.ts` | access/refresh tokens in first-party cookies so `proxy.ts` can read the role |

Language and theme are cookies read in the root layout, so the first paint already has the right
`lang`, `dir` and `data-theme`.

**Deviation from the original brief:** the brief listed a `lib/supabase.ts` browser client "for sign-in only".
Sign-in goes through the backend instead, so the browser has no Supabase client at all. That is stricter
than the brief (the browser never contacts Supabase) and makes server-side rate limiting possible.
