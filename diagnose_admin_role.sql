-- Check if current user is recognized as admin
-- Run this while logged in as your admin account

-- 1. Check your user ID and role
SELECT 
    auth.uid() as my_user_id,
    (SELECT role FROM user_profiles WHERE user_id = auth.uid()) as my_role,
    (SELECT full_name FROM user_profiles WHERE user_id = auth.uid()) as my_name,
    (SELECT email FROM user_profiles WHERE user_id = auth.uid()) as my_email;

-- 2. Test if is_admin() function returns true
SELECT is_admin() as am_i_admin;

-- 3. List all users with their roles
SELECT 
    user_id,
    full_name,
    email,
    role,
    position,
    created_at
FROM user_profiles
ORDER BY created_at;

-- 4. If your role is NOT 'admin', run this to fix it:
-- UNCOMMENT THE LINE BELOW AND REPLACE 'your-email@example.com' with your actual email
-- UPDATE user_profiles SET role = 'admin' WHERE email = 'your-email@example.com';
