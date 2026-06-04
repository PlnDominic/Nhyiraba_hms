-- Simplest possible fix: Create a direct admin UPDATE policy
-- This avoids function complications

-- Step 1: Drop ALL existing UPDATE policies on user_profiles
DROP POLICY IF EXISTS "users_update_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "allow_user_update_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "admins_update_any_profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON user_profiles;

-- Step 2: Create TWO simple policies
-- Policy 1: Anyone can update their own profile
CREATE POLICY "user_update_own" 
ON user_profiles 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy 2: Admins can update ANY profile (direct check, no function)
CREATE POLICY "admin_update_all" 
ON user_profiles 
FOR UPDATE 
USING (
  auth.uid() IN (
    SELECT user_id 
    FROM user_profiles 
    WHERE role IN ('admin', 'administrator')
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT user_id 
    FROM user_profiles 
    WHERE role IN ('admin', 'administrator')
  )
);

-- Step 3: Verify policies
SELECT 
    policyname,
    cmd,
    qual as using_clause,
    with_check
FROM pg_policies 
WHERE tablename = 'user_profiles' 
AND cmd = 'UPDATE';

-- Step 4: Test update as admin (should work now)
-- This is just a test query to see if you can see other users:
SELECT 
    user_id,
    full_name,
    role
FROM user_profiles 
ORDER BY created_at;
