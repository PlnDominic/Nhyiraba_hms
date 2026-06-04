-- Fix RLS Policies for Invoices Table
-- Run this script in your Supabase SQL Editor to fix the permission issues

-- 1. Enable RLS on invoices table
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable read access for all users" ON public.invoices;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.invoices;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.invoices;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.invoices;

-- 3. Create new policies for public access (since this is a single hotel system)
CREATE POLICY "invoices_select_policy" ON public.invoices
    FOR SELECT USING (true);

CREATE POLICY "invoices_insert_policy" ON public.invoices
    FOR INSERT WITH CHECK (true);

CREATE POLICY "invoices_update_policy" ON public.invoices
    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "invoices_delete_policy" ON public.invoices
    FOR DELETE USING (true);

-- 4. Grant necessary permissions to the public role
GRANT ALL ON public.invoices TO public;
GRANT USAGE ON SCHEMA public TO public;

-- 5. Verify the policies are created
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
WHERE tablename = 'invoices' 
AND schemaname = 'public';

-- 6. Test if invoices table is accessible
SELECT COUNT(*) as total_invoices FROM public.invoices;

-- 7. Test insert permission with a sample record
INSERT INTO public.invoices (guest_name, room_number, check_in_date, check_out_date, total_amount, status, created_at) 
VALUES ('Test Guest', '01', CURRENT_DATE, CURRENT_DATE + INTERVAL '1 day', 300.00, 'Pending', NOW())
RETURNING id, guest_name, room_number, total_amount;

-- 8. Clean up test data
DELETE FROM public.invoices WHERE guest_name = 'Test Guest';

-- 9. Final verification
SELECT 'Invoices table RLS setup complete' as status;
