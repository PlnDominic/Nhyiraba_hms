-- Fix RLS policies for access_requests table
-- This allows anonymous users to submit access requests

-- Step 1: Drop existing INSERT policies that might be conflicting
DROP POLICY IF EXISTS "Anyone can insert access requests" ON access_requests;
DROP POLICY IF EXISTS "anon_insert_access_requests" ON access_requests;
DROP POLICY IF EXISTS "allow_insert_access_requests" ON access_requests;
DROP POLICY IF EXISTS "public_insert" ON access_requests;

-- Step 2: Create new INSERT policy that explicitly allows anonymous and authenticated users
CREATE POLICY "allow_access_request_submission" 
ON access_requests 
FOR INSERT 
TO public
WITH CHECK (true);

-- Step 3: Ensure SELECT policies exist for admins
DROP POLICY IF EXISTS "Admins can view access requests" ON access_requests;

CREATE POLICY "admins_view_access_requests" 
ON access_requests 
FOR SELECT 
TO authenticated
USING (
  auth.uid() IN (
    SELECT user_id 
    FROM user_profiles 
    WHERE role IN ('admin', 'administrator')
  )
);

-- Step 4: Allow admins to update access requests (for approval/rejection)
DROP POLICY IF EXISTS "Admins can update access requests" ON access_requests;

CREATE POLICY "admins_update_access_requests" 
ON access_requests 
FOR UPDATE 
TO authenticated
USING (
  auth.uid() IN (
    SELECT user_id 
    FROM user_profiles 
    WHERE role IN ('admin', 'administrator')
  )
);

-- Step 5: Verify the policies
SELECT 
    policyname,
    cmd as command,
    roles,
    qual as using_clause,
    with_check
FROM pg_policies 
WHERE tablename = 'access_requests'
ORDER BY cmd;

-- Step 6: Test the policy (should return success)
SELECT 
    'Policy test' as test,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'access_requests' 
            AND cmd = 'INSERT'
            AND roles @> ARRAY['public']
        ) THEN '✅ Access requests can be submitted anonymously'
        ELSE '❌ Policy still restrictive'
    END as status;
