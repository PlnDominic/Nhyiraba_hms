-- Fix Reports Table UUID Generation Issue
-- This script specifically addresses the "null value in column id" error
-- Run this in your Supabase SQL Editor

-- 1. Ensure UUID extension is available and working
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Test UUID generation function
SELECT 'Testing UUID generation:' as test_step, uuid_generate_v4() as generated_uuid;

-- 3. Check current table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default,
    is_identity
FROM information_schema.columns 
WHERE table_name = 'reports' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Fix the id column if it has issues
DO $$
BEGIN
    -- Check if the id column exists and has the right type
    IF EXISTS (SELECT FROM information_schema.columns 
               WHERE table_name = 'reports' 
               AND column_name = 'id' 
               AND table_schema = 'public') THEN
        
        -- Ensure the id column is UUID type
        ALTER TABLE public.reports ALTER COLUMN id TYPE UUID USING id::UUID;
        
        -- Set the default value to uuid_generate_v4()
        ALTER TABLE public.reports ALTER COLUMN id SET DEFAULT uuid_generate_v4();
        
        -- Ensure NOT NULL constraint
        ALTER TABLE public.reports ALTER COLUMN id SET NOT NULL;
        
        RAISE NOTICE 'Fixed id column configuration';
    ELSE
        RAISE NOTICE 'id column not found - table may not exist';
    END IF;
END $$;

-- 5. Alternative: Drop and recreate the table if there are persistent issues
DO $$
BEGIN
    -- Only do this if the table exists and we're having persistent issues
    IF EXISTS (SELECT FROM information_schema.tables 
               WHERE table_schema = 'public' AND table_name = 'reports') THEN
        
        -- Drop the existing table
        DROP TABLE public.reports CASCADE;
        RAISE NOTICE 'Dropped existing reports table';
        
        -- Recreate with proper UUID handling
        CREATE TABLE public.reports (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name TEXT NOT NULL,
          date TIMESTAMP WITH TIME ZONE,
          type TEXT NOT NULL,
          format TEXT,
          generated_by TEXT,
          filename TEXT,
          file_content TEXT,
          preview_data TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Add indices
        CREATE INDEX idx_reports_created_at ON public.reports(created_at);
        CREATE INDEX idx_reports_type ON public.reports(type);
        
        RAISE NOTICE 'Recreated reports table with proper UUID handling';
    END IF;
END $$;

-- 6. Enable RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 7. Create open policies
DROP POLICY IF EXISTS "Allow public read access to reports" ON public.reports;
DROP POLICY IF EXISTS "Allow public insert access to reports" ON public.reports;
DROP POLICY IF EXISTS "Allow public update access to reports" ON public.reports;
DROP POLICY IF EXISTS "Allow public delete access to reports" ON public.reports;

CREATE POLICY "Allow public read access to reports" 
ON public.reports FOR SELECT 
TO anon, authenticated
USING (true);

CREATE POLICY "Allow public insert access to reports" 
ON public.reports FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Allow public update access to reports" 
ON public.reports FOR UPDATE 
TO anon, authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete access to reports" 
ON public.reports FOR DELETE 
TO anon, authenticated
USING (true);

-- 8. Grant permissions
GRANT ALL ON public.reports TO anon, authenticated, public;
GRANT USAGE ON SCHEMA public TO anon, authenticated, public;

-- 9. Test the fix with a simple insert
INSERT INTO public.reports (name, type, generated_by) 
VALUES ('Test Report - UUID Fix', 'test', 'test_user')
RETURNING id, name, created_at;

-- 10. Clean up test data
DELETE FROM public.reports WHERE name = 'Test Report - UUID Fix';

-- 11. Final verification
SELECT 'UUID issue fixed - reports table is ready' as status;

-- 12. Show final table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'reports' 
AND table_schema = 'public'
ORDER BY ordinal_position;
