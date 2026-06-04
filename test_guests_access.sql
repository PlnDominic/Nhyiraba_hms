-- Test Guests Table Access
-- Run this script to verify if the guests table is working correctly

-- 1. Check if table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'guests'
) as table_exists;

-- 2. Check current RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'guests';

-- 3. List all current policies
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

-- 4. Check table permissions
SELECT 
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.role_table_grants 
WHERE table_name = 'guests' 
AND table_schema = 'public';

-- 5. Test basic operations as anonymous user
-- This should work if RLS policies are correct
SELECT COUNT(*) as guest_count FROM public.guests;

-- 6. Test insert (this should work)
INSERT INTO public.guests (name, email, phone, status) 
VALUES ('Test User', 'test@test.com', '+1234567890', 'Active')
RETURNING id, name, email;

-- 7. Verify the insert worked
SELECT COUNT(*) as guest_count_after_insert FROM public.guests;

-- 8. Clean up test data
DELETE FROM public.guests WHERE email = 'test@test.com';

-- 9. Final count
SELECT COUNT(*) as final_guest_count FROM public.guests;
