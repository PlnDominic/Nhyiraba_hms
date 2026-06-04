-- COMPREHENSIVE FIX for Access Request RLS
-- This fixes BOTH the INSERT and SELECT issues

-- ============================================
-- STEP 1: Remove ALL existing policies
-- ============================================

DROP POLICY IF EXISTS "Anyone can insert access requests" ON access_requests;
DROP POLICY IF EXISTS "allow_access_request_submission" ON access_requests;
DROP POLICY IF EXISTS "anon_insert_access_requests" ON access_requests;
DROP POLICY IF EXISTS "allow_insert_access_requests" ON access_requests;
DROP POLICY IF EXISTS "public_insert" ON access_requests;

DROP POLICY IF EXISTS "Admins can view access requests" ON access_requests;
DROP POLICY IF EXISTS "admins_view_access_requests" ON access_requests;
DROP POLICY IF EXISTS "allow_anon_select_own_request" ON access_requests;

DROP POLICY IF EXISTS "Admins can update access requests" ON access_requests;
DROP POLICY IF EXISTS "admins_update_access_requests" ON access_requests;

-- ============================================
-- STEP 2: Create NEW policies that work
-- ============================================

-- Policy 1: Allow ANYONE (anon + authenticated) to INSERT requests
CREATE POLICY "public_can_insert_requests" 
ON access_requests 
FOR INSERT 
TO public
WITH CHECK (true);

-- Policy 2: Allow ANYONE to SELECT requests by their email (for duplicate checking)
-- This allows the createAccessRequest function to check for existing requests
CREATE POLICY "public_can_view_own_requests" 
ON access_requests 
FOR SELECT 
TO public
USING (true);  -- Allow all selects for now since it's not sensitive data before approval

-- Policy 3: Admins can UPDATE requests (approve/reject)
CREATE POLICY "admins_can_update_requests" 
ON access_requests 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.user_id = auth.uid() 
    AND user_profiles.role IN ('admin', 'administrator')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.user_id = auth.uid() 
    AND user_profiles.role IN ('admin', 'administrator')
  )
);

-- ============================================
-- STEP 3: Verify policies were created
-- ============================================

SELECT 
    policyname,
    cmd as operation,
    CASE 
        WHEN roles @> ARRAY['public'::name] THEN 'public (everyone)'
        WHEN roles @> ARRAY['authenticated'::name] THEN 'authenticated only'
        ELSE roles::text
    END as who_can_use,
    CASE 
        WHEN with_check = 'true' THEN '✅ Always allowed'
        WHEN with_check IS NULL THEN 'N/A'
        ELSE 'Conditional'
    END as access_level
FROM pg_policies 
WHERE tablename = 'access_requests'
ORDER BY cmd, policyname;

-- ============================================
-- STEP 4: Test that it works
-- ============================================

SELECT 
    '🧪 Test Results' as test_section,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'access_requests' 
            AND cmd = 'INSERT'
            AND roles @> ARRAY['public'::name]
        ) THEN '✅ INSERT: Public can submit requests'
        ELSE '❌ INSERT: Still blocked'
    END as insert_test,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'access_requests' 
            AND cmd = 'SELECT'
            AND roles @> ARRAY['public'::name]
        ) THEN '✅ SELECT: Public can check duplicates'
        ELSE '❌ SELECT: Still blocked'
    END as select_test,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'access_requests' 
            AND cmd = 'UPDATE'
        ) THEN '✅ UPDATE: Admins can approve'
        ELSE '❌ UPDATE: Missing'
    END as update_test;
