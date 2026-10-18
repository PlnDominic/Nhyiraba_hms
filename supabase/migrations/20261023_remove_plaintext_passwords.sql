-- SECURITY: remove plain-text password storage and the helpers around it.
--
-- Before this migration:
--  * public.staff_credentials held every staff member's password in plain text and, with the
--    policy added by fix_infinite_recursion_rls.sql, any signed-in user could read all of them.
--  * staff_credentials_debug / staff_credentials_safe views exposed the same data.
--  * admin_update_user_password() (SECURITY DEFINER) rewrote auth.users hashes directly and,
--    like every Postgres function, was executable by default through the public API.
-- After: none of these exist; accounts created from now on start with
-- password_change_required = true and the app never stores a password.

-- 1. Everyone whose password was stored must choose a new one at next sign-in
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS password_change_required BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF to_regclass('public.staff_credentials') IS NOT NULL THEN
    UPDATE public.user_profiles
       SET password_change_required = true
     WHERE user_id IN (SELECT user_id FROM public.staff_credentials);
  END IF;
END $$;

-- 2. Remove the views, functions (any overload) and the table itself
DROP VIEW IF EXISTS public.staff_credentials_debug;
DROP VIEW IF EXISTS public.staff_credentials_safe;

DO $$
DECLARE f RECORD;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS signature
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('admin_update_user_password', 'sync_staff_credentials_to_auth', 'store_staff_credentials')
  LOOP
    EXECUTE 'DROP FUNCTION ' || f.signature || ' CASCADE';
  END LOOP;
END $$;

DROP TABLE IF EXISTS public.staff_credentials CASCADE;

-- 3. Report anything still holding credentials-like data (read the Notices tab)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT table_name, column_name
      FROM information_schema.columns
     WHERE table_schema = 'public' AND column_name ILIKE '%password%' AND column_name <> 'password_change_required'
  LOOP
    RAISE NOTICE 'Review: public.%.% still exists', r.table_name, r.column_name;
  END LOOP;
END $$;
