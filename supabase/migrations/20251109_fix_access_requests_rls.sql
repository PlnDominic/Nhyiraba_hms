-- Migration: Fix access_requests RLS policies
-- Date: 2025-11-09
-- Description: Fixes "new row violates row-level security policy" error when submitting access requests

-- Drop existing potentially conflicting INSERT policies
DROP POLICY IF EXISTS "Anyone can insert access requests" ON access_requests;
DROP POLICY IF EXISTS "anon_insert_access_requests" ON access_requests;
DROP POLICY IF EXISTS "allow_insert_access_requests" ON access_requests;
DROP POLICY IF EXISTS "public_insert" ON access_requests;

-- Create INSERT policy that allows both anonymous and authenticated users to submit requests
CREATE POLICY "allow_access_request_submission" 
ON access_requests 
FOR INSERT 
TO public
WITH CHECK (true);

-- Ensure admins can view access requests
DROP POLICY IF EXISTS "Admins can view access requests" ON access_requests;
DROP POLICY IF EXISTS "admins_view_access_requests" ON access_requests;

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

-- Ensure admins can update access requests (approve/reject)
DROP POLICY IF EXISTS "Admins can update access requests" ON access_requests;
DROP POLICY IF EXISTS "admins_update_access_requests" ON access_requests;

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

-- Log the result
DO $$
BEGIN
    RAISE NOTICE 'Access requests RLS policies updated successfully';
    RAISE NOTICE 'Anonymous users can now submit access requests';
    RAISE NOTICE 'Admins can view and update access requests';
END $$;
