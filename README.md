# Ariba HR — أريبا للموارد البشرية

Production HR platform for **Ariba for Consulting (أريبا للاستشارات)**: an **HR portal** for HR,
finance, managers and the CEO, and a mobile-first **employee app** (`/me`), both on one backend.
It replaces the V114 single-file HTML prototypes.

| Part | Stack |
|---|---|
| `backend/` | FastAPI · SQLAlchemy 2 · Alembic · Pydantic · Postgres (SQLite locally) · Argon2 |
| `frontend/` | Next.js 16 (App Router) · React 19 · TypeScript (strict) · prototype CSS · Chart.js |

The backend owns all state, rules and calculations behind a versioned JSON API (`/api/v1`).
The browser never talks to the database directly. Hosting: Railway ([docs/DEPLOY_RAILWAY.md](docs/DEPLOY_RAILWAY.md)).

## Run it

**Backend** (Python 3.12):

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env
.venv/bin/uvicorn app.main:app --reload --port 8000
```

Migrations run on startup in development. To create the first admin login:

```bash
cd backend && .venv/bin/python -m app.services.seeds create-user --username emp084 --name-ar "مدير النظام" --role admin
```

The temporary password goes to `backend/.env.test.local` (git-ignored) and must be changed on first sign-in.

**Frontend** (Node 20+):

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev                   # http://localhost:3000
```

**Tests**: `cd backend && .venv/bin/pytest -q` · `cd frontend && npm run lint && npx tsc --noEmit && npm run build`

Locally the backend uses SQLite; set `DATABASE_URL` to a Postgres URL to use Postgres.

## Read next

1. [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) — what's built, what isn't verified, the API list
2. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the parts fit together
3. [docs/SECURITY.md](docs/SECURITY.md) · [docs/BUSINESS_RULES.md](docs/BUSINESS_RULES.md) · [docs/DATABASE.md](docs/DATABASE.md)
