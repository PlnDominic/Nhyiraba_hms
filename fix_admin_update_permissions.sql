-- Fix admin permissions for updating user profiles
-- This addresses RLS policy issues that prevent admins from updating profiles

-- Step 1: Drop the existing problematic UPDATE policies
DROP POLICY IF EXISTS "Users can update their own profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON user_profiles;

-- Step 2: Create a helper function to check if user is admin
-- This avoids circular RLS checks
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM user_profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'administrator')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create improved UPDATE policies
-- Policy 1: Users can update their own profile
CREATE POLICY "users_update_own_profile" 
ON user_profiles 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy 2: Admins can update any profile using the helper function
CREATE POLICY "admins_update_any_profile" 
ON user_profiles 
FOR UPDATE 
USING (is_admin())
WITH CHECK (is_admin());

-- Step 4: Verify the policies were created
SELECT 
    policyname,
    permissive,
    cmd,
    qual as using_expression,
    with_check
FROM pg_policies 
WHERE tablename = 'user_profiles' 
AND cmd = 'UPDATE';

-- Step 5: Grant execute permission on the helper function
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
