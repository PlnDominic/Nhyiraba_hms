-- Fix RLS Policies for Guests Table
-- Run this script in your Supabase SQL Editor to fix the permission issues

-- 1. Enable RLS on guests table
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable read access for all users" ON public.guests;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.guests;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.guests;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.guests;

-- 3. Create new policies for public access (since this is a single hotel system)
CREATE POLICY "Enable read access for all users" ON public.guests
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON public.guests
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON public.guests
    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete access for all users" ON public.guests
    FOR DELETE USING (true);

-- 4. Verify the policies are created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'guests';

-- 5. Test if guests table is accessible
-- This should return the count of guests (even if 0)
SELECT COUNT(*) as total_guests FROM public.guests;
