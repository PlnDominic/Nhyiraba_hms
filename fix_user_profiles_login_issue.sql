-- ======================================================================
-- FIX USER PROFILES LOGIN ISSUE - 500 ERROR
-- ======================================================================
-- This script fixes RLS policies to allow users to read their own profile during login
-- ======================================================================

-- Step 1: Check if user_profiles table exists and its structure
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'user_profiles'
ORDER BY ordinal_position;

-- Step 2: Drop existing policies that might be causing issues
DROP POLICY IF EXISTS "Users can view their own profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.user_profiles;

-- Step 3: Create simplified RLS policies for user_profiles

-- Allow users to view their own profile (critical for login)
CREATE POLICY "Users can view their own profile"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow authenticated users to view all profiles (simplified for now)
CREATE POLICY "Authenticated users can view all profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (true);

-- Allow users to insert their own profile
CREATE POLICY "Users can insert their own profile"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow admins to do everything
CREATE POLICY "Admins can manage all profiles"
ON public.user_profiles
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'administrator')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'administrator')
    )
);

-- Step 4: Ensure RLS is enabled
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Step 5: Grant necessary permissions
GRANT ALL ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO service_role;

-- Step 6: Create or update admin user profile for Seth Mensah
-- This will work even if the user exists
INSERT INTO public.user_profiles (
    user_id,
    full_name,
    position,
    department,
    contact_number,
    role,
    created_at,
    updated_at
)
SELECT 
    id,
    'Seth Mensah',
    'System Administrator',
    'Management',
    '+233-000-0000',
    'admin',
    NOW(),
    NOW()
FROM auth.users 
WHERE email = 'nhyirabahotel@gmail.com'
ON CONFLICT (user_id) 
DO UPDATE SET
    full_name = 'Seth Mensah',
    position = 'System Administrator',
    department = 'Management',
    role = 'admin',
    updated_at = NOW();

-- Step 7: Ensure all permissions are assigned to admin
-- First ensure permissions exist
INSERT INTO public.permissions (name, description) VALUES
    ('manage_reservations', 'Create, update, and delete reservations'),
    ('manage_rooms', 'Manage room status and details'),
    ('manage_guests', 'Access and modify guest information'),
    ('manage_billing', 'Process payments and manage billing'),
    ('view_reports', 'Access reporting and analytics'),
    ('manage_staff', 'Manage staff accounts and permissions'),
    ('system_settings', 'Configure system settings')
ON CONFLICT (name) DO NOTHING;

-- Grant all permissions to admin
DELETE FROM public.user_permissions 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'nhyirabahotel@gmail.com');

INSERT INTO public.user_permissions (user_id, permission_id)
SELECT 
    (SELECT id FROM auth.users WHERE email = 'nhyirabahotel@gmail.com'),
    p.id
FROM public.permissions p;

-- Step 8: Verify the setup
SELECT 
    u.id as user_id,
    u.email,
    u.created_at as auth_created,
    u.email_confirmed_at,
    up.full_name,
    up.position,
    up.department,
    up.role,
    up.created_at as profile_created
FROM auth.users u
LEFT JOIN public.user_profiles up ON up.user_id = u.id
WHERE u.email = 'nhyirabahotel@gmail.com';

-- Verify permissions
SELECT 
    u.email,
    p.name as permission,
    p.description
FROM public.user_permissions uper
JOIN auth.users u ON u.id = uper.user_id
JOIN public.permissions p ON p.id = uper.permission_id
WHERE u.email = 'nhyirabahotel@gmail.com'
ORDER BY p.name;

-- Step 9: Test the profile query (this is what the app does during login)
SELECT 
    user_id,
    full_name,
    position,
    department,
    role,
    contact_number
FROM public.user_profiles
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'nhyirabahotel@gmail.com');

-- ======================================================================
-- TROUBLESHOOTING QUERIES
-- ======================================================================

-- If you still get errors, run these diagnostic queries:

-- 1. Check RLS status
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'user_profiles';

-- 2. Check all policies on user_profiles
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

-- 3. Check if user exists in both tables
SELECT 
    'auth.users' as table_name,
    COUNT(*) as count
FROM auth.users
WHERE email = 'nhyirabahotel@gmail.com'
UNION ALL
SELECT 
    'user_profiles' as table_name,
    COUNT(*) as count
FROM public.user_profiles up
JOIN auth.users u ON u.id = up.user_id
WHERE u.email = 'nhyirabahotel@gmail.com';

-- ======================================================================
-- FIX COMPLETE
-- ======================================================================
-- Now try logging in again at: https://nhyiraba-hms.vercel.app/login
-- Email: nhyirabahotel@gmail.com
-- Password: [Your password]
-- ======================================================================
