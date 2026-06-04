-- Comprehensive Fix for Guests Table and RLS Policies
-- Run this script in your Supabase SQL Editor to completely fix the permission issues

-- 1. First, let's check if the guests table exists and its structure
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'guests') THEN
        -- Create the guests table if it doesn't exist
        CREATE TABLE public.guests (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255),
            phone VARCHAR(50),
            room INTEGER,
            check_in DATE,
            check_out DATE,
            status VARCHAR(50) DEFAULT 'Active',
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            date_of_birth DATE,
            gender VARCHAR(20),
            nationality VARCHAR(100),
            region VARCHAR(100),
            address TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Add indexes for better performance
        CREATE INDEX idx_guests_room ON public.guests(room);
        CREATE INDEX idx_guests_status ON public.guests(status);
        CREATE INDEX idx_guests_check_in ON public.guests(check_in);
        
        RAISE NOTICE 'Guests table created successfully';
    ELSE
        RAISE NOTICE 'Guests table already exists';
    END IF;
END $$;

-- 2. Disable RLS temporarily to reset everything
ALTER TABLE public.guests DISABLE ROW LEVEL SECURITY;

-- 3. Drop ALL existing policies (if any)
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'guests' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.guests', policy_record.policyname);
    END LOOP;
    RAISE NOTICE 'All existing policies dropped';
END $$;

-- 4. Re-enable RLS
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;

-- 5. Create comprehensive policies for single hotel system
-- Policy for SELECT (read access)
CREATE POLICY "guests_select_policy" ON public.guests
    FOR SELECT USING (true);

-- Policy for INSERT (create access)
CREATE POLICY "guests_insert_policy" ON public.guests
    FOR INSERT WITH CHECK (true);

-- Policy for UPDATE (modify access)
CREATE POLICY "guests_update_policy" ON public.guests
    FOR UPDATE USING (true) WITH CHECK (true);

-- Policy for DELETE (remove access)
CREATE POLICY "guests_delete_policy" ON public.guests
    FOR DELETE USING (true);

-- 6. Grant necessary permissions to the public role
GRANT ALL ON public.guests TO public;
GRANT USAGE ON SCHEMA public TO public;

-- 7. Verify the table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'guests'
ORDER BY ordinal_position;

-- 8. Verify the policies are created
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual, 
    with_check
FROM pg_policies 
WHERE tablename = 'guests' 
AND schemaname = 'public';

-- 9. Test if the table is accessible
SELECT COUNT(*) as total_guests FROM public.guests;

-- 10. Test insert permission with a sample record
INSERT INTO public.guests (name, email, phone, status) 
VALUES ('Test Guest', 'test@example.com', '+1234567890', 'Active')
RETURNING id, name, email;

-- 11. Clean up test data
DELETE FROM public.guests WHERE email = 'test@example.com';

-- 12. Final verification
SELECT 'Guests table setup complete' as status;
