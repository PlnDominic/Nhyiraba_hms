#!/usr/bin/env bash
# Spins up a throwaway local Postgres, mocks Supabase's auth schema, applies the
# migrations and runs supabase/tests/authorization.test.sql. Needs PostgreSQL 14+ binaries.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
DIR="$(mktemp -d /var/tmp/hms-rls-XXXX)"; PORT="${PORT:-55432}"
RUN_AS=""; [ "$(id -u)" = "0" ] && { chown postgres "$DIR"; RUN_AS="su postgres -c"; }
run() { if [ -n "$RUN_AS" ]; then $RUN_AS "$*"; else bash -c "$*"; fi; }
cleanup() { run "$PGBIN/pg_ctl -D $DIR/data stop -m fast" >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap cleanup EXIT
run "$PGBIN/initdb -D $DIR/data -A trust" >/dev/null
run "$PGBIN/pg_ctl -D $DIR/data -o '-p $PORT -k $DIR' -l $DIR/log start" >/dev/null
sleep 2
PSQL="psql -h $DIR -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
$PSQL <<'SQL'
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('email', current_setting('request.jwt.claim.email', true)) $$;
GRANT USAGE ON SCHEMA auth, public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated;
SQL
for f in 20251103_enable_extensions 20251103_core_auth_and_billing 20251103_rooms_reservations \
         20261018_reservation_operations 20261019_operations_phase2 20261020_guest_profiles; do
  $PSQL -f "$ROOT/supabase/migrations/$f.sql" 2>/dev/null
done
$PSQL -f "$ROOT/sms_logs_migration.sql" 2>/dev/null
# the live project uses the non-recursive user_profiles policies from this script
sed -n '7,50p' "$ROOT/fix_infinite_recursion_rls.sql" | $PSQL 2>/dev/null
$PSQL -f "$ROOT/supabase/migrations/20261022_authorization.sql" 2>/dev/null
psql -h "$DIR" -p "$PORT" -U postgres -q -tA -f "$ROOT/supabase/tests/authorization.test.sql" 2>&1 | grep -v "^$" | sed 's/^psql:[^ ]* NOTICE:  //;s/^NOTICE:  //'
