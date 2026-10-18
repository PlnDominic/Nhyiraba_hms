-- Reservation and room operations: availability, cancellation, maintenance, and rate plans.

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_fee DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS no_show_at TIMESTAMP WITH TIME ZONE;

CREATE TABLE IF NOT EXISTS public.maintenance_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id BIGINT NOT NULL REFERENCES public.rooms(id),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  priority VARCHAR(20) NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
  status VARCHAR(20) NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Resolved', 'Cancelled')),
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_tickets_room ON public.maintenance_tickets(room_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_tickets_status ON public.maintenance_tickets(status);

CREATE TABLE IF NOT EXISTS public.rate_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  base_rate DECIMAL(10, 2) NOT NULL DEFAULT 0,
  meal_plan VARCHAR(50) NOT NULL DEFAULT 'Room Only',
  min_nights INTEGER NOT NULL DEFAULT 1,
  max_nights INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cancellation_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  days_before_checkin INTEGER NOT NULL DEFAULT 0,
  fee_percent DECIMAL(5, 2) NOT NULL DEFAULT 0,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.maintenance_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cancellation_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage maintenance tickets" ON public.maintenance_tickets;
CREATE POLICY "Authenticated users can manage maintenance tickets" ON public.maintenance_tickets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage rate plans" ON public.rate_plans;
CREATE POLICY "Authenticated users can manage rate plans" ON public.rate_plans
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage cancellation policies" ON public.cancellation_policies;
CREATE POLICY "Authenticated users can manage cancellation policies" ON public.cancellation_policies
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.maintenance_tickets TO authenticated;
GRANT ALL ON public.rate_plans TO authenticated;
GRANT ALL ON public.cancellation_policies TO authenticated;

INSERT INTO public.rate_plans (name, description, base_rate, meal_plan)
VALUES
  ('Standard Flexible', 'Flexible booking with standard cancellation terms', 0, 'Room Only'),
  ('Advance Purchase', 'Discounted non-refundable rate', 0, 'Room Only')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.cancellation_policies (name, days_before_checkin, fee_percent, description)
VALUES
  ('Standard', 2, 0, 'Free cancellation at least two days before check-in'),
  ('Late Cancellation', 1, 50, 'Fifty percent of one night for late cancellation'),
  ('No Refund', 0, 100, 'Full first-night charge for same-day cancellation or no-show')
ON CONFLICT (name) DO NOTHING;
