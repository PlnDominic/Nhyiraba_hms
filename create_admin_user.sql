-- ======================================================================
-- CREATE ADMIN USER: Seth Mensah (nhyirabahotel@gmail.com)
-- ======================================================================
-- This script sets up the admin profile and permissions
-- 
-- PREREQUISITE: You must first create the auth user in Supabase Dashboard
-- Go to: Authentication > Users > Add User
-- Email: nhyirabahotel@gmail.com
-- Password: [Set a secure password]
-- Auto Confirm User: YES (check this box)
-- ======================================================================

-- Step 1: Get the user ID (run this first to verify user exists)
SELECT 
    id as user_id,
    email,
    created_at,
    email_confirmed_at
FROM auth.users 
WHERE email = 'nhyirabahotel@gmail.com';

-- ======================================================================
-- Step 2: Create admin profile
-- Replace 'USER_ID_HERE' with the actual UUID from Step 1
-- ======================================================================

-- Insert admin user profile
INSERT INTO public.user_profiles (
    user_id,
    full_name,
    position,
    department,
    contact_number,
    role,
    created_at,
    updated_at
) VALUES (
    (SELECT id FROM auth.users WHERE email = 'nhyirabahotel@gmail.com'),
    'Seth Mensah',
    'System Administrator',
    'Management',
    '+233-XXX-XXXX', -- Update with actual phone number
    'admin',
    NOW(),
    NOW()
)
ON CONFLICT (user_id) 
DO UPDATE SET
    full_name = EXCLUDED.full_name,
    position = EXCLUDED.position,
    department = EXCLUDED.department,
    role = 'admin',
    updated_at = NOW();

-- ======================================================================
-- Step 3: Grant all permissions to admin
-- ======================================================================

-- First, ensure all permissions exist
INSERT INTO public.permissions (name, description) VALUES
    ('manage_reservations', 'Create, update, and delete reservations'),
    ('manage_rooms', 'Manage room status and details'),
    ('manage_guests', 'Access and modify guest information'),
    ('manage_billing', 'Process payments and manage billing'),
    ('view_reports', 'Access reporting and analytics'),
    ('manage_staff', 'Manage staff accounts and permissions'),
    ('system_settings', 'Configure system settings')
ON CONFLICT (name) DO NOTHING;

-- Grant all permissions to admin user
INSERT INTO public.user_permissions (user_id, permission_id)
SELECT 
    (SELECT id FROM auth.users WHERE email = 'nhyirabahotel@gmail.com'),
    p.id
FROM public.permissions p
ON CONFLICT (user_id, permission_id) DO NOTHING;

-- ======================================================================
-- Step 4: Verify admin user setup
-- ======================================================================

-- Check user profile
SELECT 
    up.user_id,
    u.email,
    up.full_name,
    up.position,
    up.department,
    up.role,
    up.created_at
FROM public.user_profiles up
JOIN auth.users u ON u.id = up.user_id
WHERE u.email = 'nhyirabahotel@gmail.com';

-- Check user permissions
SELECT 
    u.email,
    up.full_name,
    up.role,
    p.name as permission_name,
    p.description
FROM public.user_permissions uper
JOIN public.user_profiles up ON up.user_id = uper.user_id
JOIN auth.users u ON u.id = up.user_id
JOIN public.permissions p ON p.id = uper.permission_id
WHERE u.email = 'nhyirabahotel@gmail.com'
ORDER BY p.name;

-- ======================================================================
-- SETUP COMPLETE
-- ======================================================================
-- Admin user Seth Mensah (nhyirabahotel@gmail.com) is now ready!
-- You can now login at: https://nhyiraba-hms.vercel.app/login
-- ======================================================================
