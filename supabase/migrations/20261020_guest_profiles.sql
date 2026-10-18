-- Guest profiles (#16), notes/preferences, and SMS retry tracking (#19/#20).
-- Profiles themselves are derived from the guests/reservations tables;
-- this adds the staff-entered data that has no other home.

CREATE TABLE IF NOT EXISTS public.guest_profiles (
  guest_key TEXT PRIMARY KEY,
  display_name TEXT,
  preferences TEXT,
  vip BOOLEAN NOT NULL DEFAULT false,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.guest_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_key TEXT NOT NULL,
  note TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_guest_notes_key ON public.guest_notes(guest_key, created_at DESC);

-- Retried SMS point back at the failed original (table is created by sms_logs_migration.sql)
ALTER TABLE IF EXISTS public.sms_logs ADD COLUMN IF NOT EXISTS retry_of UUID;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['guest_profiles', 'guest_notes']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can manage %1$s" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "Authenticated users can manage %1$s" ON public.%1$I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
    EXECUTE format('GRANT ALL ON public.%I TO authenticated', t);
  END LOOP;
END $$;
