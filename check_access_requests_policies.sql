-- Check RLS policies on access_requests table
-- Run this in Supabase SQL Editor to diagnose the issue

-- 1. Check if RLS is enabled
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
AND tablename = 'access_requests';

-- 2. List all policies on access_requests table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd as command,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies 
WHERE tablename = 'access_requests';

-- 3. Check table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'access_requests'
ORDER BY ordinal_position;

-- 4. Test if anonymous users can insert
-- This should work if policies are correct
SELECT 
    'INSERT policy check' as test,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'access_requests' 
            AND cmd = 'INSERT'
            AND with_check = 'true'
        ) THEN '✅ INSERT policy allows anonymous access'
        ELSE '❌ INSERT policy missing or restrictive'
    END as status;
