-- #44 Server-side authorization at the database layer.
-- The browser talks to Supabase directly, so role rules must live in Postgres.
--  1. Staff can no longer promote themselves (role/department/permissions are admin-only).
--  2. RESTRICTIVE policies on privileged writes: they are ANDed with every other policy,
--     so older permissive policies elsewhere in the project cannot bypass them.
-- Service-role requests (server code with SUPABASE_SERVICE_KEY) bypass RLS as usual.

-- ---------------------------------------------------------------------------
-- Role helpers (SECURITY DEFINER so they can read user_profiles under RLS)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.app_is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(public.app_role() IN ('admin', 'administrator'), false);
$$;

CREATE OR REPLACE FUNCTION public.app_is_manager()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(public.app_role() IN ('admin', 'administrator', 'manager'), false);
$$;

GRANT EXECUTE ON FUNCTION public.app_role(), public.app_is_admin(), public.app_is_manager() TO authenticated;

-- ---------------------------------------------------------------------------
-- 1. Privilege-escalation guard on user_profiles
--    Existing policies let users update their own row (any column) and insert
--    their own profile with any role. This trigger closes that hole.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_user_profile_privileges()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Service role / internal triggers have no auth.uid(); admins may change anything.
  IF auth.uid() IS NULL OR public.app_is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Only administrators can create profiles for other users' USING ERRCODE = '42501';
    END IF;
    NEW.role := 'staff';  -- a self-created profile always starts as plain staff
    RETURN NEW;
  END IF;

  -- UPDATE by a non-admin: privileged columns must not change.
  -- to_jsonb() keeps this working even if an optional column (e.g. permissions) is absent.
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR to_jsonb(NEW) -> 'role' IS DISTINCT FROM to_jsonb(OLD) -> 'role'
     OR to_jsonb(NEW) -> 'department' IS DISTINCT FROM to_jsonb(OLD) -> 'department'
     OR to_jsonb(NEW) -> 'permissions' IS DISTINCT FROM to_jsonb(OLD) -> 'permissions' THEN
    RAISE EXCEPTION 'Only administrators can change role, department or permissions' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_user_profile_privileges ON public.user_profiles;
CREATE TRIGGER guard_user_profile_privileges
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_profile_privileges();

-- Only admins may delete profiles or edit explicit permissions.
DROP POLICY IF EXISTS "authz_profiles_delete_admin" ON public.user_profiles;
CREATE POLICY "authz_profiles_delete_admin" ON public.user_profiles AS RESTRICTIVE
  FOR DELETE USING (public.app_is_admin());

DO $$
BEGIN
  IF to_regclass('public.user_permissions') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "authz_user_permissions_write_admin_ins" ON public.user_permissions';
    EXECUTE 'CREATE POLICY "authz_user_permissions_write_admin_ins" ON public.user_permissions AS RESTRICTIVE FOR INSERT WITH CHECK (public.app_is_admin())';
    EXECUTE 'DROP POLICY IF EXISTS "authz_user_permissions_write_admin_upd" ON public.user_permissions';
    EXECUTE 'CREATE POLICY "authz_user_permissions_write_admin_upd" ON public.user_permissions AS RESTRICTIVE FOR UPDATE USING (public.app_is_admin())';
    EXECUTE 'DROP POLICY IF EXISTS "authz_user_permissions_write_admin_del" ON public.user_permissions';
    EXECUTE 'CREATE POLICY "authz_user_permissions_write_admin_del" ON public.user_permissions AS RESTRICTIVE FOR DELETE USING (public.app_is_admin())';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Restrictive rules for privileged writes (skipped if a table does not exist)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  rule RECORD;
BEGIN
  FOR rule IN
    SELECT * FROM (VALUES
      -- table,                    command,  who
      ('invoices',              'DELETE', 'manager'),  -- financial records
      ('invoice_items',         'DELETE', 'manager'),
      ('rate_plans',            'INSERT', 'manager'),  -- pricing configuration
      ('rate_plans',            'UPDATE', 'manager'),
      ('rate_plans',            'DELETE', 'manager'),
      ('cancellation_policies', 'INSERT', 'manager'),
      ('cancellation_policies', 'UPDATE', 'manager'),
      ('cancellation_policies', 'DELETE', 'manager'),
      ('checkin_records',       'UPDATE', 'manager'),  -- audit evidence: append-only for staff
      ('checkin_records',       'DELETE', 'manager'),
      ('checkout_settlements',  'UPDATE', 'manager'),
      ('checkout_settlements',  'DELETE', 'manager'),
      ('housekeeping_log',      'UPDATE', 'manager'),
      ('housekeeping_log',      'DELETE', 'manager'),
      ('maintenance_tickets',   'DELETE', 'manager'),
      ('guest_notes',           'UPDATE', 'manager'),
      ('guest_notes',           'DELETE', 'manager'),
      ('sms_logs',              'UPDATE', 'manager'),
      ('sms_logs',              'DELETE', 'manager'),
      ('access_requests',       'DELETE', 'admin')
    ) AS t(tbl, cmd, who)
  LOOP
    IF to_regclass('public.' || rule.tbl) IS NULL THEN
      RAISE NOTICE 'Skipping %: table does not exist', rule.tbl;
      CONTINUE;
    END IF;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'authz_' || lower(rule.cmd) || '_' || rule.who, rule.tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR %s %s (public.%I())',
      'authz_' || lower(rule.cmd) || '_' || rule.who,
      rule.tbl,
      rule.cmd,
      CASE WHEN rule.cmd = 'INSERT' THEN 'WITH CHECK' ELSE 'USING' END,
      CASE WHEN rule.who = 'admin' THEN 'app_is_admin' ELSE 'app_is_manager' END
    );
  END LOOP;
END $$;
