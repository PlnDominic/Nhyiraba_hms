-- Make Dominic Kudom an administrator
-- This will give Dominic full admin permissions to manage users

UPDATE user_profiles 
SET role = 'admin' 
WHERE user_id = 'c99a27f8-3c2f-49db-92c4-6ddfaefc1378';

-- Verify the update
SELECT 
    user_id,
    full_name,
    email,
    role,
    position
FROM user_profiles
WHERE user_id = 'c99a27f8-3c2f-49db-92c4-6ddfaefc1378';

-- Test if is_admin() now works
-- (Run this AFTER logging out and back in as Dominic)
-- SELECT is_admin() as am_i_admin_now;
