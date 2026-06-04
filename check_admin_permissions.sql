-- Check current user's profile and role
-- Run this in Supabase SQL Editor while logged in as the admin user

-- 1. Check your current user ID
SELECT auth.uid() as current_user_id;

-- 2. Check your profile and role
SELECT 
    user_id,
    full_name,
    role,
    position,
    department,
    created_at
FROM user_profiles 
WHERE user_id = auth.uid();

-- 3. Check all admin users
SELECT 
    user_id,
    full_name,
    role,
    position,
    email
FROM user_profiles 
WHERE role IN ('admin', 'administrator');

-- 4. If your role is not 'admin' or 'administrator', update it:
-- UNCOMMENT AND RUN THIS IF NEEDED:
-- UPDATE user_profiles 
-- SET role = 'admin' 
-- WHERE user_id = auth.uid();

-- 5. Check existing RLS policies on user_profiles
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
WHERE tablename = 'user_profiles';
