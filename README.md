# Ariba HR

Ariba's human resources system: an **HR website** + an **employee mobile app** (iPhone and Android), on a single server.

## Running locally

### Requirements
- Python 3.12 · Node 22 or newer · PostgreSQL 16+
- **A local database containing the normalized schema.** The app does not create tables or run Alembic. Apply the `docs/db-normalization/` files to a local copy of the data (see `docs/db-normalization/README.md`).
- ⚠️ **Do not point any `.env` file at the Railway database.** All trials run against a local database only.

### macOS / Linux
```bash
# Server  → http://localhost:8000
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env     # set DATABASE_URL to your local database
export RUN_MIGRATIONS_ON_STARTUP=false ENV=development
export CORS_ORIGINS="http://localhost:3000,http://localhost:8081"
uvicorn app.main:app --reload --port 8000

# HR website → http://localhost:3000   (second window)
cd frontend/hr-web
npm ci
echo 'NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1' > .env.local
npm run dev

# Employee app → http://localhost:8081   (third window)
cd frontend/employee-app
npm ci
EXPO_PUBLIC_API_URL=http://localhost:8000 npx expo start --web --port 8081 --clear
```

### Windows (PowerShell)
```powershell
# If you get the error "running scripts is disabled", run this once in each window:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

# Server  → http://localhost:8000
cd backend
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env     # set DATABASE_URL to your local database
$env:RUN_MIGRATIONS_ON_STARTUP = "false"; $env:ENV = "development"
$env:CORS_ORIGINS = "http://localhost:3000,http://localhost:8081"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000

# HR website → http://localhost:3000   (second window)
cd frontend\hr-web
npm.cmd ci
Set-Content .env.local "NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1"
npm.cmd run dev

# Employee app → http://localhost:8081   (third window)
cd frontend\employee-app
npm.cmd ci
$env:EXPO_PUBLIC_API_URL = "http://localhost:8000"
npx.cmd expo start --web --port 8081 --clear
```

### On a phone
Put your computer's IP address in `EXPO_PUBLIC_API_URL` (e.g. `http://192.168.1.10:8000`) instead of `localhost`, and run the server with `--host 0.0.0.0`. The phone and the computer must be on the same network.

### Common errors
- **The page shows Method Not Allowed:** you opened the server URL in the browser. Open the website on port 3000.
- **Login fails with a network error:** make sure `CORS_ORIGINS` contains the page's exact address.
- **The app logs in to production:** delete `frontend/employee-app/.env` and open the Network tab to confirm the request goes to `localhost`.
