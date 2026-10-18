-- Bulk SMS (promotions, programmes, announcements): one campaign row per send,
-- with each recipient's message still logged in sms_logs.

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

ALTER TABLE IF EXISTS public.sms_logs ADD COLUMN IF NOT EXISTS campaign_id UUID;
CREATE INDEX IF NOT EXISTS idx_sms_logs_campaign ON public.sms_logs (campaign_id);

ALTER TABLE public.sms_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Managers can read sms campaigns" ON public.sms_campaigns;
CREATE POLICY "Managers can read sms campaigns" ON public.sms_campaigns
  FOR SELECT TO authenticated USING (public.app_is_manager());
DROP POLICY IF EXISTS "Managers can write sms campaigns" ON public.sms_campaigns;
CREATE POLICY "Managers can write sms campaigns" ON public.sms_campaigns
  FOR ALL TO authenticated USING (public.app_is_manager()) WITH CHECK (public.app_is_manager());
GRANT ALL ON public.sms_campaigns TO authenticated;
