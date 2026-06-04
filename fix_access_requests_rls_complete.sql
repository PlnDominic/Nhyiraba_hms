-- Complete fix for access_requests RLS policies
-- This script will completely reset and fix all RLS policies for the access_requests table

-- First, let's drop ALL existing policies (regardless of their names)
DO $$ 
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'access_requests' 
      AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.access_requests', policy_record.policyname);
    RAISE NOTICE 'Dropped policy: %', policy_record.policyname;
  END LOOP;
END $$;

-- Ensure RLS is enabled
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

-- Create fresh, clean policies

-- 1. INSERT Policy: Allow ANYONE (including anonymous users) to submit access requests
-- This is critical for the registration flow
CREATE POLICY "allow_anonymous_insert_access_requests" 
ON public.access_requests 
FOR INSERT 
TO public
WITH CHECK (true);

-- 2. SELECT Policy: Allow authenticated users with admin/administrator role to view all requests
CREATE POLICY "allow_admins_select_access_requests" 
ON public.access_requests 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_profiles 
    WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role IN ('admin', 'administrator')
  )
);

-- 3. UPDATE Policy: Allow authenticated users with admin/administrator role to update requests
CREATE POLICY "allow_admins_update_access_requests" 
ON public.access_requests 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_profiles 
    WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role IN ('admin', 'administrator')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.user_profiles 
    WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role IN ('admin', 'administrator')
  )
);

-- 4. DELETE Policy: Allow authenticated users with admin/administrator role to delete requests
CREATE POLICY "allow_admins_delete_access_requests" 
ON public.access_requests 
FOR DELETE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_profiles 
    WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role IN ('admin', 'administrator')
  )
);

-- Verify the policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'access_requests' 
  AND schemaname = 'public'
ORDER BY policyname;

-- Print success messages
DO $$ 
BEGIN
  RAISE NOTICE 'Access requests RLS policies have been successfully reset and recreated!';
  RAISE NOTICE 'Anonymous users can now submit access requests.';
  RAISE NOTICE 'Admins can view, update, and delete access requests.';
END $$; 
