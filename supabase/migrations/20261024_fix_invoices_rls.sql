-- Fix: "new row violates row-level security policy for table invoices".
-- The invoice form saves with insert(...).select(), so Postgres needs BOTH an
-- INSERT and a SELECT policy to pass for the signed-in user. Older fix scripts
-- left a conflicting mix on some databases. This resets the invoice policies
-- to one clean set. Safe to run more than once. Run in the Supabase SQL editor.
--
-- Signed-in staff can read, create and edit invoices. Deleting stays limited to
-- managers by the restrictive authz_* policy from 20261022_authorization.sql
-- (those authz_* policies are left untouched).

DO $$
DECLARE
  tbl TEXT;
  pol RECORD;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['invoices', 'invoice_items']
  LOOP
    IF to_regclass('public.' || tbl) IS NULL THEN
      RAISE NOTICE 'Skipping %: table does not exist', tbl;
      CONTINUE;
    END IF;

    -- Remove every old policy except the authorization rules
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl AND policyname NOT LIKE 'authz\_%'
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, tbl);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', tbl || '_select_authenticated', tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', tbl || '_insert_authenticated', tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', tbl || '_update_authenticated', tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (true)', tbl || '_delete_authenticated', tbl);

    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', tbl);
  END LOOP;
END $$;

-- Needed if the id columns use a sequence (SERIAL) instead of an identity column
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
