#!/usr/bin/env bash
# Builds a local test database from the schema only (no real data):
#   Supabase schema (tools/legacy-parity/sql/schema.sql) → synthetic approvers → the normalization exactly as Railway ran
#   it (docs/db-normalization) → the port migrations (docs/db-migrations/0*.sql) → synthetic data (seed.py).
# Usage: ARIBA_DEV_PASSWORD='…' bash tools/dev-db/build.sh <dbname> [--no-migrations]
#   PGHOST/PGUSER as usual (e.g. PGHOST=/tmp PGUSER=postgres). The database is dropped and recreated.
set -euo pipefail
DB="${1:?usage: build.sh <dbname> [--no-migrations]}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PSQL() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" "$@"; }

dropdb --if-exists "$DB"
createdb "$DB"
PSQL -f "$ROOT/tools/legacy-parity/sql/schema.sql" >/dev/null
PSQL -f "$ROOT/tools/dev-db/seed_pre.sql"
for f in railway_prep.sql preflight_checks.sql pre_migration_fixes.sql preflight_checks.sql ariba_normalization.sql; do
  PSQL -f "$ROOT/docs/db-normalization/$f" >/dev/null
done
if [ "${2:-}" != "--no-migrations" ]; then
  for f in "$ROOT"/docs/db-migrations/0*.sql; do
    echo "== $(basename "$f")"
    PSQL -f "$f" >/dev/null
  done
fi
"$ROOT/backend/.venv/bin/python" "$ROOT/tools/dev-db/seed.py" "$DB"
echo "built $DB"
