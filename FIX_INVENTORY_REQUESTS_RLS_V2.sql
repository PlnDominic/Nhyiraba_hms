-- UPDATED Fix for Inventory Requests RLS Policies
-- This fixes both the "permission denied for table users" error
-- and the "403 Forbidden" error when fetching requests

-- First, drop all existing policies
DROP POLICY IF EXISTS "Users can view their own department requests" ON inventory_requests;
DROP POLICY IF EXISTS "Users can create requests for their department" ON inventory_requests;
DROP POLICY IF EXISTS "Admins and managers can update requests" ON inventory_requests;
DROP POLICY IF EXISTS "Users can view request items they have access to" ON inventory_request_items;
DROP POLICY IF EXISTS "Users can insert request items for their requests" ON inventory_request_items;
DROP POLICY IF EXISTS "Admins and managers can update request items" ON inventory_request_items;

-- Ensure RLS is enabled
ALTER TABLE inventory_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_request_items ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- INVENTORY_REQUESTS POLICIES
-- ============================================================================

-- 1. SELECT Policy - Allow users to view requests from their department
CREATE POLICY "Users can view their own department requests"
    ON inventory_requests FOR SELECT
    USING (
        -- User can view their own requests
        auth.uid() = requested_by 
        OR
        -- Admins and managers can view all requests
        (auth.jwt() -> 'user_metadata' ->> 'role')::text IN ('admin', 'manager')
        OR
        -- Users can view requests from their department
        (auth.jwt() -> 'user_metadata' ->> 'department')::text = department
    );

-- 2. INSERT Policy - Allow users to create requests for their department
CREATE POLICY "Users can create requests for their department"
    ON inventory_requests FOR INSERT
    WITH CHECK (
        -- User must be authenticated
        auth.uid() IS NOT NULL
        AND
        -- User must be creating request for themselves
        auth.uid() = requested_by
        AND
        -- Request must be for user's department
        (
            (auth.jwt() -> 'user_metadata' ->> 'department')::text = department
            OR
            -- Allow if no department in JWT (for backwards compatibility)
            (auth.jwt() -> 'user_metadata' ->> 'department') IS NULL
        )
    );

-- 3. UPDATE Policy - Allow admins and managers to update requests
CREATE POLICY "Admins and managers can update requests"
    ON inventory_requests FOR UPDATE
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role')::text IN ('admin', 'manager')
    );

-- 4. DELETE Policy - Allow admins to delete requests
CREATE POLICY "Admins can delete requests"
    ON inventory_requests FOR DELETE
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role')::text = 'admin'
    );

-- ============================================================================
-- INVENTORY_REQUEST_ITEMS POLICIES
-- ============================================================================

-- 1. SELECT Policy - Allow users to view items from requests they can access
CREATE POLICY "Users can view request items they have access to"
    ON inventory_request_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM inventory_requests
            WHERE inventory_requests.id = inventory_request_items.request_id
            AND (
                -- User created the request
                inventory_requests.requested_by = auth.uid()
                OR
                -- User is admin or manager
                (auth.jwt() -> 'user_metadata' ->> 'role')::text IN ('admin', 'manager')
                OR
                -- User is from same department
                (auth.jwt() -> 'user_metadata' ->> 'department')::text = inventory_requests.department
            )
        )
    );

-- 2. INSERT Policy - Allow users to add items to their own requests
CREATE POLICY "Users can insert request items for their requests"
    ON inventory_request_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM inventory_requests
            WHERE inventory_requests.id = inventory_request_items.request_id
            AND inventory_requests.requested_by = auth.uid()
        )
    );

-- 3. UPDATE Policy - Allow admins and managers to update request items
CREATE POLICY "Admins and managers can update request items"
    ON inventory_request_items FOR UPDATE
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role')::text IN ('admin', 'manager')
    );

-- 4. DELETE Policy - Allow admins to delete request items
CREATE POLICY "Admins can delete request items"
    ON inventory_request_items FOR DELETE
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role')::text = 'admin'
    );

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Ensure authenticated users have the necessary permissions
GRANT SELECT, INSERT ON inventory_requests TO authenticated;
GRANT SELECT, INSERT ON inventory_request_items TO authenticated;
GRANT UPDATE, DELETE ON inventory_requests TO authenticated;
GRANT UPDATE, DELETE ON inventory_request_items TO authenticated;

-- ============================================================================
-- VERIFY POLICIES
-- ============================================================================

-- Check that all policies are created
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd,
    CASE 
        WHEN qual IS NOT NULL THEN 'Has USING clause'
        ELSE 'No USING clause'
    END as using_clause,
    CASE 
        WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause'
        ELSE 'No WITH CHECK clause'
    END as with_check_clause
FROM pg_policies
WHERE tablename IN ('inventory_requests', 'inventory_request_items')
ORDER BY tablename, policyname;

-- ============================================================================
-- TEST QUERIES (Run these to verify policies work)
-- ============================================================================

-- Test 1: Check if you can select from inventory_requests
-- This should work for authenticated users
-- SELECT * FROM inventory_requests LIMIT 1;

-- Test 2: Check if you can insert into inventory_requests
-- This should work if you're authenticated and have department metadata
-- INSERT INTO inventory_requests (requested_by, requester_name, department, status, notes)
-- VALUES (auth.uid(), 'Test User', 'Housekeeping', 'pending', 'Test request')
-- RETURNING *;

-- Test 3: Check RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename IN ('inventory_requests', 'inventory_request_items');

-- Expected output: rowsecurity should be 't' (true) for both tables
