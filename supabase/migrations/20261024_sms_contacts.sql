-- Saved SMS contacts: people and numbers that are not hotel guests (suppliers, members,
-- neighbours, event lists) so bulk messages can reach them too.
-- Phones are stored as digits with the country code (e.g. 233241234567).
-- Managers can read the list to message it; only administrators can add, import, edit or delete.
-- Safe to run more than once. Run in the Supabase SQL editor.

-- Role helpers (same definitions as 20261022_authorization.sql, so this file runs on its own)
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

CREATE TABLE IF NOT EXISTS public.sms_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  phone TEXT NOT NULL CHECK (phone ~ '^[0-9]{9,15}$'),
  group_name TEXT,
  opted_out BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_contacts_phone ON public.sms_contacts (phone);
CREATE INDEX IF NOT EXISTS idx_sms_contacts_group ON public.sms_contacts (group_name);

ALTER TABLE public.sms_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can read sms contacts" ON public.sms_contacts;
CREATE POLICY "Managers can read sms contacts" ON public.sms_contacts
  FOR SELECT TO authenticated USING (public.app_is_manager());

DROP POLICY IF EXISTS "Admins can insert sms contacts" ON public.sms_contacts;
CREATE POLICY "Admins can insert sms contacts" ON public.sms_contacts
  FOR INSERT TO authenticated WITH CHECK (public.app_is_admin() AND created_by = auth.uid());

DROP POLICY IF EXISTS "Admins can update sms contacts" ON public.sms_contacts;
CREATE POLICY "Admins can update sms contacts" ON public.sms_contacts
  FOR UPDATE TO authenticated USING (public.app_is_admin()) WITH CHECK (public.app_is_admin());

DROP POLICY IF EXISTS "Admins can delete sms contacts" ON public.sms_contacts;
CREATE POLICY "Admins can delete sms contacts" ON public.sms_contacts
  FOR DELETE TO authenticated USING (public.app_is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_contacts TO authenticated;
