#!/usr/bin/env bash
# Validates that all Supabase migrations apply cleanly from scratch and that
# the compliance pipeline (consent, export, deletion, retention, function
# ACLs) behaves correctly — without needing Docker or a Supabase project.
#
# Requires: PostgreSQL 15+ server binaries on the host (initdb/pg_ctl/psql).
# Run as a non-root user (initdb refuses to run as root).
#
# Usage: ./scripts/validate-migrations.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGBIN="${PGBIN:-$(dirname "$(command -v initdb || echo /usr/lib/postgresql/16/bin/initdb)")}"
WORKDIR="$(mktemp -d /tmp/flowstate-migrate-XXXXXX)"
PGPORT="${VALIDATE_PGPORT:-54999}"
DB=flowstate_validation

cleanup() {
  "$PGBIN/pg_ctl" -D "$WORKDIR/data" stop -m immediate >/dev/null 2>&1 || true
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

echo "→ initdb (throwaway cluster in $WORKDIR)"
"$PGBIN/initdb" -D "$WORKDIR/data" -U postgres >/dev/null
"$PGBIN/pg_ctl" -D "$WORKDIR/data" \
  -o "-p $PGPORT -k $WORKDIR -c listen_addresses=" \
  -l "$WORKDIR/server.log" start >/dev/null

PSQL=("$PGBIN/psql" -h "$WORKDIR" -p "$PGPORT" -U postgres)

"${PSQL[@]}" -qc "CREATE DATABASE $DB;"
PSQL=("$PGBIN/psql" -h "$WORKDIR" -p "$PGPORT" -U postgres -d "$DB")

echo "→ applying Supabase environment shim"
"${PSQL[@]}" -v ON_ERROR_STOP=1 -q -f "$REPO_ROOT/supabase/tests/supabase-shim.sql"

echo "→ applying all migrations from scratch (CLI filename order)"
for f in $(LC_ALL=C ls "$REPO_ROOT"/supabase/migrations/*.sql); do
  # pg_cron / pg_net are unavailable outside Supabase images; the shim
  # provides a cron.schedule stand-in, so neutralize only the extension DDL.
  if ! sed -E 's/^[[:space:]]*create extension if not exists (pg_cron|pg_net).*;/SELECT 1;/I' "$f" \
      | "${PSQL[@]}" -v ON_ERROR_STOP=1 -q -o /dev/null; then
    echo "✗ FAILED: $f"
    exit 1
  fi
  echo "  ✓ $(basename "$f")"
done

echo "→ running compliance smoke tests"
SMOKE_OUT="$("${PSQL[@]}" -f "$REPO_ROOT/supabase/tests/compliance-smoke.sql" 2>&1 || true)"
echo "$SMOKE_OUT" | grep -E "PASS|ERROR|HOLE|ALL " || true
if ! grep -q "ALL SMOKE TESTS PASSED" <<<"$SMOKE_OUT"; then
  echo "✗ smoke tests failed"
  exit 1
fi

echo "DONE — migrations apply from scratch and the compliance suite is green"
