-- Fix RLS Policies for Reports Table
-- Run this script in your Supabase SQL Editor to fix the permission issues

-- 1. First, ensure the UUID extension is available and working
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Check if the reports table exists, if not create it
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reports') THEN
        -- Create the reports table for storing generated reports
        CREATE TABLE public.reports (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
        
        -- If table exists, ensure the id column has the correct default
        ALTER TABLE public.reports ALTER COLUMN id SET DEFAULT uuid_generate_v4();
        
        -- Also ensure the column is properly configured
        ALTER TABLE public.reports ALTER COLUMN id SET NOT NULL;
    END IF;
END $$;

-- 3. Enable RLS on the reports table
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can CRUD their own reports" ON public.reports;
DROP POLICY IF EXISTS "Anyone can read reports" ON public.reports;
DROP POLICY IF EXISTS "Allow public access to reports" ON public.reports;
DROP POLICY IF EXISTS "Allow anonymous read access to reports" ON public.reports;
DROP POLICY IF EXISTS "Allow anonymous insert to reports" ON public.reports;
DROP POLICY IF EXISTS "Allow anonymous update to reports" ON public.reports;
DROP POLICY IF EXISTS "Allow anonymous delete from reports" ON public.reports;

-- 5. Create new open policies that allow both authenticated and anonymous access
-- Policy to allow viewing reports by anyone
CREATE POLICY "Allow public read access to reports" 
ON public.reports FOR SELECT 
TO anon, authenticated
USING (true);

-- Policy to allow inserting reports by anyone
CREATE POLICY "Allow public insert access to reports" 
ON public.reports FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- Policy to allow updating reports by anyone
CREATE POLICY "Allow public update access to reports" 
ON public.reports FOR UPDATE 
TO anon, authenticated
USING (true) WITH CHECK (true);

-- Policy to allow deleting reports by anyone
CREATE POLICY "Allow public delete access to reports" 
ON public.reports FOR DELETE 
TO anon, authenticated
USING (true);

-- 6. Grant necessary permissions to the public role
GRANT ALL ON public.reports TO public;
GRANT USAGE ON SCHEMA public TO public;

-- 7. Test UUID generation function
SELECT 'Testing UUID generation:' as test_step, uuid_generate_v4() as generated_uuid;

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
WHERE tablename = 'reports' 
AND schemaname = 'public';

-- 9. Test if reports table is accessible
SELECT COUNT(*) as total_reports FROM public.reports;

-- 10. Test insert permission with a sample record (explicitly providing UUID)
INSERT INTO public.reports (id, name, date, type, format, generated_by, filename, file_content, preview_data) 
VALUES (uuid_generate_v4(), 'Test Report', NOW(), 'test', 'pdf', 'test_user', 'test.pdf', 'test_content', 'test_preview')
RETURNING id, name, type, created_at;

-- 11. Clean up test data
DELETE FROM public.reports WHERE name = 'Test Report';

-- 12. Final verification
SELECT 'Reports table RLS setup complete' as status;
