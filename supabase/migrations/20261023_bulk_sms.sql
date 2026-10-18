-- Bulk SMS (promotions, programmes, announcements).
-- One campaign row per send; each recipient's message is still logged in sms_logs.
-- Safe to run more than once. Run in the Supabase SQL editor.

-- Role helpers (same definitions as 20261022_authorization.sql, so this file runs on its own)
CREATE OR REPLACE FUNCTION public.app_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.app_is_manager()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(public.app_role() IN ('admin', 'administrator', 'manager'), false);
$$;

GRANT EXECUTE ON FUNCTION public.app_role(), public.app_is_manager() TO authenticated;

-- The message log table (also created by sms_logs_migration.sql)
CREATE TABLE IF NOT EXISTS public.sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event TEXT,
  phone TEXT,
  message TEXT,
  provider_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'SUBMITTING',
  error TEXT,
  sent_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status_checked_at TIMESTAMP WITH TIME ZONE
);

-- Campaigns
CREATE TABLE IF NOT EXISTS public.sms_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  type TEXT NOT NULL CHECK (type IN ('promotion', 'programme', 'announcement', 'other')),
  message TEXT NOT NULL,
  total INTEGER NOT NULL DEFAULT 0,
  submitted INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sms_campaigns_created ON public.sms_campaigns (created_at DESC);

-- Link each logged message to its campaign
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS campaign_id UUID;
CREATE INDEX IF NOT EXISTS idx_sms_logs_campaign ON public.sms_logs (campaign_id);

-- Only managers and admins can see or create campaigns
ALTER TABLE public.sms_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can read sms campaigns" ON public.sms_campaigns;
CREATE POLICY "Managers can read sms campaigns" ON public.sms_campaigns
  FOR SELECT TO authenticated USING (public.app_is_manager());

DROP POLICY IF EXISTS "Managers can write sms campaigns" ON public.sms_campaigns;
CREATE POLICY "Managers can write sms campaigns" ON public.sms_campaigns
  FOR ALL TO authenticated USING (public.app_is_manager()) WITH CHECK (public.app_is_manager());

GRANT ALL ON public.sms_campaigns TO authenticated;
