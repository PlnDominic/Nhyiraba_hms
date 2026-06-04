-- ULTIMATE FIX: Simplest possible admin policy that definitely works
-- This uses a SECURITY DEFINER function that explicitly bypasses RLS

-- Step 0: Drop all existing UPDATE policies FIRST (before dropping functions)
DROP POLICY IF EXISTS "users_update_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "allow_user_update_own_profile" ON user_profiles;  
DROP POLICY IF EXISTS "admins_update_any_profile" ON user_profiles;
DROP POLICY IF EXISTS "admin_update_all" ON user_profiles;
DROP POLICY IF EXISTS "user_update_own" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON user_profiles;

-- Step 1: Create helper function with explicit RLS bypass
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_role(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.current_user_is_admin() CASCADE;

-- Function to get current user's role, bypassing RLS
CREATE OR REPLACE FUNCTION public.get_user_role(check_user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role 
  FROM public.user_profiles 
  WHERE user_id = check_user_id
  LIMIT 1;
$$;

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT get_user_role(auth.uid()) IN ('admin', 'administrator');
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_user_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated;

-- Step 2: Create clean policies
CREATE POLICY "user_can_update_own_profile" 
ON user_profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "admin_can_update_all_profiles" 
ON user_profiles 
FOR UPDATE 
USING (current_user_is_admin());

-- Step 3: Test the functions
SELECT 
    auth.uid() as current_user_id,
    get_user_role(auth.uid()) as my_role,
    current_user_is_admin() as am_i_admin;

-- Step 4: Verify policies
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'user_profiles' AND cmd = 'UPDATE';
