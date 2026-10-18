-- Runs after fixtures/legacy_plaintext_credentials.sql and 20261023_remove_plaintext_passwords.sql
\set ON_ERROR_STOP 1
\set VERBOSITY terse

DO $$
BEGIN
  IF to_regclass('public.staff_credentials') IS NOT NULL THEN RAISE EXCEPTION 'FAIL staff_credentials table still exists'; END IF;
  IF to_regclass('public.staff_credentials_debug') IS NOT NULL THEN RAISE EXCEPTION 'FAIL debug view still exists'; END IF;
  IF to_regclass('public.staff_credentials_safe') IS NOT NULL THEN RAISE EXCEPTION 'FAIL safe view still exists'; END IF;
  RAISE NOTICE 'ok  table and views removed';

  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public'
               AND p.proname IN ('admin_update_user_password', 'sync_staff_credentials_to_auth', 'store_staff_credentials')) THEN
    RAISE EXCEPTION 'FAIL a password helper function still exists';
  END IF;
  RAISE NOTICE 'ok  password helper functions removed';

  IF NOT (SELECT password_change_required FROM public.user_profiles WHERE user_id = '00000000-0000-0000-0000-0000000000e1') THEN
    RAISE EXCEPTION 'FAIL user with a stored password was not flagged for a password change';
  END IF;
  IF (SELECT password_change_required FROM public.user_profiles WHERE user_id = '00000000-0000-0000-0000-0000000000e2') THEN
    RAISE EXCEPTION 'FAIL user without a stored password was flagged';
  END IF;
  RAISE NOTICE 'ok  only users whose password was stored must change it';

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND column_name ILIKE '%password%' AND column_name <> 'password_change_required') THEN
    RAISE EXCEPTION 'FAIL a password-like column still exists';
  END IF;
  RAISE NOTICE 'ok  no password columns remain in public';
END $$;

-- idempotent: a second run must not fail
\i supabase/migrations/20261023_remove_plaintext_passwords.sql
\echo 'ok  migration is safe to re-run'
\echo 'All password-removal checks passed'
