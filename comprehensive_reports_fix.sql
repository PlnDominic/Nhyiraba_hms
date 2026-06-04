-- Comprehensive Fix for Reports Table 403 Error
-- This script addresses both RLS policies and authentication issues
-- Run this in your Supabase SQL Editor

-- 1. First, check if the reports table exists, if not create it
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reports') THEN
        -- Create the reports table for storing generated reports
        CREATE TABLE public.reports (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          date TIMESTAMP WITH TIME ZONE,
          type TEXT NOT NULL,
          format TEXT,
          generated_by TEXT,
          filename TEXT,
          file_content TEXT,   -- This will store the base64 file content
          preview_data TEXT,   -- For preview purposes
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Add appropriate indices
        CREATE INDEX idx_reports_created_at ON public.reports(created_at);
        CREATE INDEX idx_reports_type ON public.reports(type);

        RAISE NOTICE 'Reports table created successfully';
    ELSE
        RAISE NOTICE 'Reports table already exists';
    END IF;
END $$;

-- 2. Enable RLS on the reports table
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 3. Drop ALL existing policies on the reports table
DROP POLICY IF EXISTS "Authenticated users can CRUD their own reports" ON public.reports;
DROP POLICY IF EXISTS "Anyone can read reports" ON public.reports;
DROP POLICY IF EXISTS "Allow public access to reports" ON public.reports;
DROP POLICY IF EXISTS "Allow anonymous read access to reports" ON public.reports;
DROP POLICY IF EXISTS "Allow anonymous insert to reports" ON public.reports;
DROP POLICY IF EXISTS "Allow anonymous update to reports" ON public.reports;
DROP POLICY IF EXISTS "Allow anonymous delete from reports" ON public.reports;
DROP POLICY IF EXISTS "Allow all operations on reports" ON public.reports;

-- 4. Create comprehensive policies that work with both authenticated and anonymous users

-- Policy 1: Allow reading reports by anyone (both anon and authenticated)
CREATE POLICY "reports_select_policy" 
ON public.reports 
FOR SELECT 
TO anon, authenticated
USING (true);

-- Policy 2: Allow inserting reports by anyone (both anon and authenticated)
CREATE POLICY "reports_insert_policy" 
ON public.reports 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- Policy 3: Allow updating reports by anyone (both anon and authenticated)
CREATE POLICY "reports_update_policy" 
ON public.reports 
FOR UPDATE 
TO anon, authenticated
USING (true) WITH CHECK (true);

-- Policy 4: Allow deleting reports by anyone (both anon and authenticated)
CREATE POLICY "reports_delete_policy" 
ON public.reports 
FOR DELETE 
TO anon, authenticated
USING (true);

-- 5. Grant ALL necessary permissions to both anon and authenticated roles
GRANT ALL ON public.reports TO anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 6. Also grant permissions to the public role for maximum compatibility
GRANT ALL ON public.reports TO public;
GRANT USAGE ON SCHEMA public TO public;

-- 7. Ensure the UUID extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 8. Verify the policies are created correctly
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
WHERE tablename = 'reports' 
AND schemaname = 'public'
ORDER BY policyname;

-- 9. Test if the table is accessible
SELECT COUNT(*) as total_reports FROM public.reports;

-- 10. Test insert permission with a sample record
INSERT INTO public.reports (name, date, type, format, generated_by, filename, file_content, preview_data) 
VALUES ('Test Report', NOW(), 'test', 'pdf', 'test_user', 'test.pdf', 'test_content', 'test_preview')
RETURNING id, name, type, created_at;

-- 11. Clean up test data
DELETE FROM public.reports WHERE name = 'Test Report';

-- 12. Final verification
SELECT 'Reports table RLS setup complete' as status;

-- 13. Additional verification queries
-- Check table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'reports' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'reports' 
AND schemaname = 'public';

-- Check permissions
SELECT 
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.role_table_grants 
WHERE table_name = 'reports' 
AND table_schema = 'public'
ORDER BY grantee, privilege_type;
