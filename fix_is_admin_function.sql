-- Fix the is_admin() function to properly bypass RLS
-- The SECURITY DEFINER should allow it to check user_profiles without RLS interference

-- Drop and recreate the function with explicit schema and better logic
DROP FUNCTION IF EXISTS is_admin();

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Get the role directly, bypassing RLS with SECURITY DEFINER
  SELECT role INTO user_role
  FROM public.user_profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  -- Return true if role is admin or administrator
  RETURN (user_role IN ('admin', 'administrator'));
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;

-- Test the function
SELECT public.is_admin() as is_admin_result;

-- Also show current user's role for verification
SELECT 
    auth.uid() as current_user,
    role as current_role
FROM user_profiles 
WHERE user_id = auth.uid();
