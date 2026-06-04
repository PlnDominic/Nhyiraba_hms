-- Test Seth's admin status and is_admin() function
-- Run this while logged in as Seth Mensah

-- 1. Verify you're logged in as Seth
SELECT 
    auth.uid() as my_user_id,
    '8a9bfdf5-5e4f-4cb2-b4ad-1b0575029fcd' as seth_user_id,
    (auth.uid() = '8a9bfdf5-5e4f-4cb2-b4ad-1b0575029fcd'::uuid) as is_this_seth;

-- 2. Check Seth's profile
SELECT * FROM user_profiles WHERE user_id = auth.uid();

-- 3. Test if is_admin() returns true
SELECT is_admin() as am_i_admin;

-- 4. Manual check - does Seth show up in admin query?
SELECT EXISTS (
    SELECT 1 
    FROM user_profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'administrator')
) as manual_admin_check;

-- 5. Check if the is_admin() function exists and its definition
SELECT 
    proname as function_name,
    prosrc as function_body,
    prosecdef as is_security_definer
FROM pg_proc 
WHERE proname = 'is_admin';

-- 6. Try to see what policies are blocking the update
-- Check if Seth can see Dominic's profile
SELECT * FROM user_profiles WHERE user_id = 'c99a27f8-3c2f-49db-92c4-6ddfaefc1378';
