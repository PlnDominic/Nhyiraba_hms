-- Staff features: leave & availability (#22), certifications (#26), goals & reviews (#25).
-- Requires public.staff and public.user_profiles (see staff_tables_setup.sql).
-- Policies: staff see/edit their own records, managers (admin/manager/hr) see everything.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_staff_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid() AND role IN ('admin', 'administrator', 'manager', 'hr')
  );
$$;

-- staff.id values belonging to the signed-in user (linked by user_id, else by email)
CREATE OR REPLACE FUNCTION public.current_staff_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.staff
  WHERE user_id = auth.uid()
     OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

GRANT EXECUTE ON FUNCTION public.is_staff_manager() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_staff_ids() TO authenticated;

-- ---------------------------------------------------------------------------
-- #22 Leave and availability
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('annual', 'sick', 'personal', 'maternity', 'paternity', 'unpaid')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count INTEGER NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by UUID REFERENCES public.staff(id),
  approval_date TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_staff_leaves_staff_id ON public.staff_leaves(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_leaves_dates ON public.staff_leaves(start_date, end_date);

CREATE TABLE IF NOT EXISTS public.leave_policies (
  leave_type TEXT PRIMARY KEY CHECK (leave_type IN ('annual', 'sick', 'personal', 'maternity', 'paternity', 'unpaid')),
  days_per_year INTEGER NOT NULL DEFAULT 0
);
INSERT INTO public.leave_policies (leave_type, days_per_year) VALUES
  ('annual', 15), ('sick', 10), ('personal', 3), ('maternity', 84), ('paternity', 5), ('unpaid', 0)
ON CONFLICT (leave_type) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.department_min_coverage (
  department TEXT PRIMARY KEY,
  min_staff INTEGER NOT NULL DEFAULT 1 CHECK (min_staff >= 0)
);

CREATE TABLE IF NOT EXISTS public.staff_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),  -- 0 = Sunday
  available BOOLEAN NOT NULL DEFAULT true,
  start_time TIME,
  end_time TIME,
  UNIQUE (staff_id, weekday)
);

-- ---------------------------------------------------------------------------
-- #26 Certifications and required training
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  issuer TEXT,
  issued_date DATE,
  expiry_date DATE,
  evidence_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_staff_certifications_staff ON public.staff_certifications(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_certifications_expiry ON public.staff_certifications(expiry_date);

CREATE TABLE IF NOT EXISTS public.training_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                 -- certification/training name staff must hold
  department TEXT,                    -- NULL = everyone
  position TEXT,                      -- NULL = any position
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- #25 Review periods, goals, review workflow
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.review_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS public.staff_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  period_id UUID REFERENCES public.review_periods(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  weight INTEGER NOT NULL DEFAULT 1 CHECK (weight BETWEEN 1 AND 10),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  status TEXT NOT NULL DEFAULT 'not-started' CHECK (status IN ('not-started', 'in-progress', 'achieved', 'missed')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_staff_goals_staff ON public.staff_goals(staff_id);

-- performance_metrics already exists (staff_tables_setup.sql); create it if missing, then extend
CREATE TABLE IF NOT EXISTS public.performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  review_period_start DATE NOT NULL,
  review_period_end DATE NOT NULL,
  reviewer_id UUID REFERENCES public.staff(id),
  overall_rating NUMERIC(3, 2) CHECK (overall_rating >= 0 AND overall_rating <= 5),
  punctuality_rating NUMERIC(3, 2) CHECK (punctuality_rating >= 0 AND punctuality_rating <= 5),
  quality_of_work_rating NUMERIC(3, 2) CHECK (quality_of_work_rating >= 0 AND quality_of_work_rating <= 5),
  teamwork_rating NUMERIC(3, 2) CHECK (teamwork_rating >= 0 AND teamwork_rating <= 5),
  customer_service_rating NUMERIC(3, 2) CHECK (customer_service_rating >= 0 AND customer_service_rating <= 5),
  strengths TEXT,
  areas_for_improvement TEXT,
  goals TEXT,
  comments TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'reviewed', 'acknowledged')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.performance_metrics
  ADD COLUMN IF NOT EXISTS period_id UUID REFERENCES public.review_periods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS manager_feedback TEXT,
  ADD COLUMN IF NOT EXISTS staff_comments TEXT,
  ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMP WITH TIME ZONE;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
ALTER TABLE public.staff_leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_min_coverage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;

-- Leave: staff see only their own requests; managers see all
DROP POLICY IF EXISTS "leave_select" ON public.staff_leaves;
CREATE POLICY "leave_select" ON public.staff_leaves FOR SELECT TO authenticated
  USING (public.is_staff_manager() OR staff_id IN (SELECT public.current_staff_ids()));

DROP POLICY IF EXISTS "leave_insert_own" ON public.staff_leaves;
CREATE POLICY "leave_insert_own" ON public.staff_leaves FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff_manager()
    OR (staff_id IN (SELECT public.current_staff_ids()) AND status = 'pending')
  );

DROP POLICY IF EXISTS "leave_update" ON public.staff_leaves;
CREATE POLICY "leave_update" ON public.staff_leaves FOR UPDATE TO authenticated
  USING (public.is_staff_manager() OR (staff_id IN (SELECT public.current_staff_ids()) AND status = 'pending'))
  WITH CHECK (public.is_staff_manager() OR (staff_id IN (SELECT public.current_staff_ids()) AND status IN ('pending', 'cancelled')));

DROP POLICY IF EXISTS "leave_delete_manager" ON public.staff_leaves;
CREATE POLICY "leave_delete_manager" ON public.staff_leaves FOR DELETE TO authenticated USING (public.is_staff_manager());

-- Reference tables: readable by all signed-in staff, managed by managers
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['leave_policies', 'department_min_coverage', 'training_requirements', 'review_periods']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_read" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "%1$s_read" ON public.%1$I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_manage" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "%1$s_manage" ON public.%1$I FOR ALL TO authenticated USING (public.is_staff_manager()) WITH CHECK (public.is_staff_manager())', t);
  END LOOP;
END $$;

-- Availability: readable by all (scheduling), editable by the owner or managers
DROP POLICY IF EXISTS "availability_read" ON public.staff_availability;
CREATE POLICY "availability_read" ON public.staff_availability FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "availability_write" ON public.staff_availability;
CREATE POLICY "availability_write" ON public.staff_availability FOR ALL TO authenticated
  USING (public.is_staff_manager() OR staff_id IN (SELECT public.current_staff_ids()))
  WITH CHECK (public.is_staff_manager() OR staff_id IN (SELECT public.current_staff_ids()));

-- Certifications: own + managers; staff may add their own but only managers edit/delete
DROP POLICY IF EXISTS "cert_select" ON public.staff_certifications;
CREATE POLICY "cert_select" ON public.staff_certifications FOR SELECT TO authenticated
  USING (public.is_staff_manager() OR staff_id IN (SELECT public.current_staff_ids()));
DROP POLICY IF EXISTS "cert_insert" ON public.staff_certifications;
CREATE POLICY "cert_insert" ON public.staff_certifications FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_manager() OR staff_id IN (SELECT public.current_staff_ids()));
DROP POLICY IF EXISTS "cert_manage" ON public.staff_certifications;
CREATE POLICY "cert_manage" ON public.staff_certifications FOR UPDATE TO authenticated
  USING (public.is_staff_manager()) WITH CHECK (public.is_staff_manager());
DROP POLICY IF EXISTS "cert_delete" ON public.staff_certifications;
CREATE POLICY "cert_delete" ON public.staff_certifications FOR DELETE TO authenticated USING (public.is_staff_manager());

-- Goals: own + managers; staff may update progress on their own goals
DROP POLICY IF EXISTS "goals_select" ON public.staff_goals;
CREATE POLICY "goals_select" ON public.staff_goals FOR SELECT TO authenticated
  USING (public.is_staff_manager() OR staff_id IN (SELECT public.current_staff_ids()));
DROP POLICY IF EXISTS "goals_manage" ON public.staff_goals;
CREATE POLICY "goals_manage" ON public.staff_goals FOR ALL TO authenticated
  USING (public.is_staff_manager()) WITH CHECK (public.is_staff_manager());
DROP POLICY IF EXISTS "goals_update_own" ON public.staff_goals;
CREATE POLICY "goals_update_own" ON public.staff_goals FOR UPDATE TO authenticated
  USING (staff_id IN (SELECT public.current_staff_ids()))
  WITH CHECK (staff_id IN (SELECT public.current_staff_ids()));

-- Reviews: staff see their own once submitted; managers manage; staff can acknowledge their own
DROP POLICY IF EXISTS "reviews_select_own_submitted" ON public.performance_metrics;
CREATE POLICY "reviews_select_own_submitted" ON public.performance_metrics FOR SELECT TO authenticated
  USING (public.is_staff_manager() OR (staff_id IN (SELECT public.current_staff_ids()) AND status <> 'draft'));
DROP POLICY IF EXISTS "reviews_manage" ON public.performance_metrics;
CREATE POLICY "reviews_manage" ON public.performance_metrics FOR ALL TO authenticated
  USING (public.is_staff_manager()) WITH CHECK (public.is_staff_manager());
DROP POLICY IF EXISTS "reviews_acknowledge_own" ON public.performance_metrics;
CREATE POLICY "reviews_acknowledge_own" ON public.performance_metrics FOR UPDATE TO authenticated
  USING (staff_id IN (SELECT public.current_staff_ids()) AND status IN ('submitted', 'reviewed'))
  WITH CHECK (staff_id IN (SELECT public.current_staff_ids()) AND status = 'acknowledged');

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.staff_leaves, public.leave_policies, public.department_min_coverage, public.staff_availability,
  public.staff_certifications, public.training_requirements, public.review_periods,
  public.staff_goals, public.performance_metrics
TO authenticated;
