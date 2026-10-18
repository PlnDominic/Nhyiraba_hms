-- ======================================================================
-- STAFF MANAGEMENT TABLES FOR LAVIMAC HOTEL MANAGEMENT SYSTEM
-- ======================================================================
-- This script creates all staff-related tables
-- Run this in your Supabase SQL Editor
-- ======================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ======================================================================
-- 1. STAFF TABLE
-- ======================================================================

CREATE TABLE IF NOT EXISTS public.staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    name TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    address TEXT,
    position TEXT NOT NULL,
    department TEXT NOT NULL,
    hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
    employment_type TEXT DEFAULT 'full-time' CHECK (employment_type IN ('full-time', 'part-time', 'contract', 'intern')),
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'On Leave', 'Terminated')),
    salary NUMERIC(10, 2),
    photo_url TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    date_of_birth DATE,
    national_id TEXT,
    bank_account TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for staff table
CREATE INDEX IF NOT EXISTS idx_staff_email ON public.staff(email);
CREATE INDEX IF NOT EXISTS idx_staff_user_id ON public.staff(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_department ON public.staff(department);
CREATE INDEX IF NOT EXISTS idx_staff_status ON public.staff(status);
CREATE INDEX IF NOT EXISTS idx_staff_position ON public.staff(position);
CREATE INDEX IF NOT EXISTS idx_staff_name ON public.staff USING gin(to_tsvector('english', first_name || ' ' || last_name));

-- ======================================================================
-- 2. STAFF SCHEDULES TABLE
-- ======================================================================

CREATE TABLE IF NOT EXISTS public.staff_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    shift_type TEXT DEFAULT 'regular' CHECK (shift_type IN ('regular', 'overtime', 'night', 'weekend')),
    department TEXT NOT NULL,
    position TEXT,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no-show')),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for staff_schedules
CREATE INDEX IF NOT EXISTS idx_staff_schedules_staff_id ON public.staff_schedules(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_shift_date ON public.staff_schedules(shift_date);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_department ON public.staff_schedules(department);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_status ON public.staff_schedules(status);

-- ======================================================================
-- 3. TIME ENTRIES TABLE (Clock In/Out)
-- ======================================================================

CREATE TABLE IF NOT EXISTS public.time_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('in', 'out')),
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    entry_time TIME NOT NULL DEFAULT CURRENT_TIME,
    entry_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    location TEXT,
    notes TEXT,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for time_entries
CREATE INDEX IF NOT EXISTS idx_time_entries_staff_id ON public.time_entries(staff_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_entry_date ON public.time_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_time_entries_entry_type ON public.time_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_time_entries_timestamp ON public.time_entries(entry_timestamp);

-- (4. staff_credentials was removed: the app never stores passwords)

-- ======================================================================
-- 5. TRAINING MODULES TABLE
-- ======================================================================

CREATE TABLE IF NOT EXISTS public.training_modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    duration_hours NUMERIC(5, 2),
    content TEXT,
    video_url TEXT,
    documents JSONB DEFAULT '[]'::jsonb,
    quiz_questions JSONB DEFAULT '[]'::jsonb,
    passing_score INTEGER DEFAULT 70,
    is_mandatory BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for training_modules
CREATE INDEX IF NOT EXISTS idx_training_modules_category ON public.training_modules(category);
CREATE INDEX IF NOT EXISTS idx_training_modules_status ON public.training_modules(status);

-- ======================================================================
-- 6. STAFF TRAININGS TABLE (Junction Table)
-- ======================================================================

CREATE TABLE IF NOT EXISTS public.staff_trainings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    training_module_id UUID NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
    enrollment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completion_date TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'not-started' CHECK (status IN ('not-started', 'in-progress', 'completed', 'failed')),
    score INTEGER,
    attempts INTEGER DEFAULT 0,
    certificate_url TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(staff_id, training_module_id)
);

-- Indexes for staff_trainings
CREATE INDEX IF NOT EXISTS idx_staff_trainings_staff_id ON public.staff_trainings(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_trainings_module_id ON public.staff_trainings(training_module_id);
CREATE INDEX IF NOT EXISTS idx_staff_trainings_status ON public.staff_trainings(status);

-- ======================================================================
-- 7. PERFORMANCE METRICS TABLE
-- ======================================================================

CREATE TABLE IF NOT EXISTS public.performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Indexes for performance_metrics
CREATE INDEX IF NOT EXISTS idx_performance_metrics_staff_id ON public.performance_metrics(staff_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_reviewer_id ON public.performance_metrics(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_period ON public.performance_metrics(review_period_start, review_period_end);

-- ======================================================================
-- 8. STAFF LEAVES TABLE
-- ======================================================================

CREATE TABLE IF NOT EXISTS public.staff_leaves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Indexes for staff_leaves
CREATE INDEX IF NOT EXISTS idx_staff_leaves_staff_id ON public.staff_leaves(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_leaves_status ON public.staff_leaves(status);
CREATE INDEX IF NOT EXISTS idx_staff_leaves_dates ON public.staff_leaves(start_date, end_date);

-- ======================================================================
-- 9. TRIGGERS AND FUNCTIONS
-- ======================================================================

-- Update timestamp trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to staff tables
DROP TRIGGER IF EXISTS update_staff_timestamp ON public.staff;
CREATE TRIGGER update_staff_timestamp 
BEFORE UPDATE ON public.staff 
FOR EACH ROW 
EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_staff_schedules_timestamp ON public.staff_schedules;
CREATE TRIGGER update_staff_schedules_timestamp 
BEFORE UPDATE ON public.staff_schedules 
FOR EACH ROW 
EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_time_entries_timestamp ON public.time_entries;
CREATE TRIGGER update_time_entries_timestamp 
BEFORE UPDATE ON public.time_entries 
FOR EACH ROW 
EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_training_modules_timestamp ON public.training_modules;
CREATE TRIGGER update_training_modules_timestamp 
BEFORE UPDATE ON public.training_modules 
FOR EACH ROW 
EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_staff_trainings_timestamp ON public.staff_trainings;
CREATE TRIGGER update_staff_trainings_timestamp 
BEFORE UPDATE ON public.staff_trainings 
FOR EACH ROW 
EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_performance_metrics_timestamp ON public.performance_metrics;
CREATE TRIGGER update_performance_metrics_timestamp 
BEFORE UPDATE ON public.performance_metrics 
FOR EACH ROW 
EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_staff_leaves_timestamp ON public.staff_leaves;
CREATE TRIGGER update_staff_leaves_timestamp 
BEFORE UPDATE ON public.staff_leaves 
FOR EACH ROW 
EXECUTE FUNCTION update_modified_column();

-- Function to calculate work hours
CREATE OR REPLACE FUNCTION calculate_work_hours(
    p_staff_id UUID,
    p_date DATE
) RETURNS INTERVAL AS $$
DECLARE
    v_clock_in TIME;
    v_clock_out TIME;
BEGIN
    -- Get first clock in
    SELECT entry_time INTO v_clock_in
    FROM public.time_entries
    WHERE staff_id = p_staff_id 
        AND entry_date = p_date 
        AND entry_type = 'in'
    ORDER BY entry_time ASC
    LIMIT 1;
    
    -- Get last clock out
    SELECT entry_time INTO v_clock_out
    FROM public.time_entries
    WHERE staff_id = p_staff_id 
        AND entry_date = p_date 
        AND entry_type = 'out'
    ORDER BY entry_time DESC
    LIMIT 1;
    
    -- Return difference
    IF v_clock_in IS NOT NULL AND v_clock_out IS NOT NULL THEN
        RETURN v_clock_out - v_clock_in;
    ELSE
        RETURN NULL;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get staff attendance summary
CREATE OR REPLACE FUNCTION get_staff_attendance_summary(
    p_staff_id UUID,
    p_start_date DATE,
    p_end_date DATE
) RETURNS TABLE (
    total_days INTEGER,
    present_days INTEGER,
    absent_days INTEGER,
    late_days INTEGER,
    total_hours INTERVAL
) AS $$
BEGIN
    RETURN QUERY
    WITH date_series AS (
        SELECT generate_series(p_start_date, p_end_date, '1 day'::interval)::date AS date
    ),
    attendance AS (
        SELECT 
            ds.date,
            CASE WHEN te.entry_date IS NOT NULL THEN 1 ELSE 0 END AS present,
            calculate_work_hours(p_staff_id, ds.date) AS hours
        FROM date_series ds
        LEFT JOIN (
            SELECT DISTINCT entry_date 
            FROM public.time_entries 
            WHERE staff_id = p_staff_id
        ) te ON ds.date = te.entry_date
    )
    SELECT 
        COUNT(*)::INTEGER AS total_days,
        SUM(present)::INTEGER AS present_days,
        (COUNT(*) - SUM(present))::INTEGER AS absent_days,
        0::INTEGER AS late_days,
        SUM(hours) AS total_hours
    FROM attendance;
END;
$$ LANGUAGE plpgsql;

-- ======================================================================
-- 10. ROW LEVEL SECURITY POLICIES
-- ======================================================================

-- Enable RLS on all staff tables
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_leaves ENABLE ROW LEVEL SECURITY;

-- Staff table policies
CREATE POLICY "Staff viewable by authenticated users" ON public.staff
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff manageable by admins" ON public.staff
    FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role IN ('admin', 'administrator', 'manager'))
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role IN ('admin', 'administrator', 'manager'))
    );

CREATE POLICY "Staff can update own record" ON public.staff
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Staff schedules policies
CREATE POLICY "Schedules viewable by authenticated users" ON public.staff_schedules
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Schedules manageable by managers" ON public.staff_schedules
    FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role IN ('admin', 'administrator', 'manager'))
    );

-- Time entries policies
CREATE POLICY "Time entries viewable by authenticated users" ON public.time_entries
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert their own time entries" ON public.time_entries
    FOR INSERT TO authenticated
    WITH CHECK (
        staff_id IN (SELECT id FROM public.staff WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role IN ('admin', 'administrator', 'manager'))
    );

CREATE POLICY "Users can update their own time entries" ON public.time_entries
    FOR UPDATE TO authenticated
    USING (
        staff_id IN (SELECT id FROM public.staff WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role IN ('admin', 'administrator', 'manager'))
    );

-- Training modules policies
CREATE POLICY "Training modules viewable by authenticated users" ON public.training_modules
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Training modules manageable by admins" ON public.training_modules
    FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role IN ('admin', 'administrator', 'manager'))
    );

-- Staff trainings policies
CREATE POLICY "Staff trainings viewable by authenticated users" ON public.staff_trainings
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff trainings manageable by admins and self" ON public.staff_trainings
    FOR ALL TO authenticated
    USING (
        staff_id IN (SELECT id FROM public.staff WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role IN ('admin', 'administrator', 'manager'))
    );

-- Performance metrics policies
CREATE POLICY "Performance metrics viewable by staff and managers" ON public.performance_metrics
    FOR SELECT TO authenticated
    USING (
        staff_id IN (SELECT id FROM public.staff WHERE user_id = auth.uid())
        OR reviewer_id IN (SELECT id FROM public.staff WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role IN ('admin', 'administrator', 'manager'))
    );

CREATE POLICY "Performance metrics manageable by managers" ON public.performance_metrics
    FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role IN ('admin', 'administrator', 'manager'))
    );

-- Staff leaves policies
CREATE POLICY "Staff leaves viewable by staff and managers" ON public.staff_leaves
    FOR SELECT TO authenticated
    USING (
        staff_id IN (SELECT id FROM public.staff WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role IN ('admin', 'administrator', 'manager'))
    );

CREATE POLICY "Staff can request leaves" ON public.staff_leaves
    FOR INSERT TO authenticated
    WITH CHECK (
        staff_id IN (SELECT id FROM public.staff WHERE user_id = auth.uid())
    );

CREATE POLICY "Managers can manage all leaves" ON public.staff_leaves
    FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role IN ('admin', 'administrator', 'manager'))
    );

-- ======================================================================
-- 11. SAMPLE DATA (Optional)
-- ======================================================================

-- Insert sample staff members
INSERT INTO public.staff (first_name, last_name, email, phone, position, department, hire_date, status, salary)
VALUES
    ('John', 'Doe', 'john.doe@lavimacroyalhotel.com', '+233-555-1234', 'Hotel Manager', 'Management', '2020-01-10', 'Active', 8000),
    ('Jane', 'Smith', 'jane.smith@lavimacroyalhotel.com', '+233-555-5678', 'Receptionist', 'Front Desk', '2021-03-15', 'Active', 3500),
    ('Michael', 'Johnson', 'michael.johnson@lavimacroyalhotel.com', '+233-555-9012', 'Housekeeping Manager', 'Housekeeping', '2019-11-05', 'Active', 4500),
    ('Sarah', 'Williams', 'sarah.williams@lavimacroyalhotel.com', '+233-555-3456', 'Chef', 'Food & Beverage', '2021-06-20', 'Active', 5000),
    ('David', 'Brown', 'david.brown@lavimacroyalhotel.com', '+233-555-7890', 'Maintenance Supervisor', 'Maintenance', '2020-09-12', 'Active', 4000)
ON CONFLICT (email) DO NOTHING;

-- ======================================================================
-- STAFF TABLES SETUP COMPLETE
-- ======================================================================
-- All staff-related tables, policies, and functions have been created.
-- Sample staff data has been inserted.
-- ======================================================================
