-- Fix for "permission denied for table users" error
-- This happens because RLS policies are trying to query auth.users table
-- which Housekeeping staff don't have permission to access

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own department requests" ON inventory_requests;
DROP POLICY IF EXISTS "Users can create requests for their department" ON inventory_requests;
DROP POLICY IF EXISTS "Admins and managers can update requests" ON inventory_requests;
DROP POLICY IF EXISTS "Users can view request items they have access to" ON inventory_request_items;
DROP POLICY IF EXISTS "Users can insert request items for their requests" ON inventory_request_items;
DROP POLICY IF EXISTS "Admins and managers can update request items" ON inventory_request_items;

-- Create new RLS policies using auth.jwt() instead of querying auth.users
-- This avoids the permission denied error

-- Policy for SELECT on inventory_requests
CREATE POLICY "Users can view their own department requests"
    ON inventory_requests FOR SELECT
    USING (
        auth.uid() = requested_by OR
        (auth.jwt() -> 'user_metadata' ->> 'role')::text IN ('admin', 'manager') OR
        (auth.jwt() -> 'user_metadata' ->> 'department')::text = department
    );

-- Policy for INSERT on inventory_requests
CREATE POLICY "Users can create requests for their department"
    ON inventory_requests FOR INSERT
    WITH CHECK (
        auth.uid() = requested_by AND
        (auth.jwt() -> 'user_metadata' ->> 'department')::text = department
    );

-- Policy for UPDATE on inventory_requests
CREATE POLICY "Admins and managers can update requests"
    ON inventory_requests FOR UPDATE
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role')::text IN ('admin', 'manager')
    );

-- Policy for SELECT on inventory_request_items
CREATE POLICY "Users can view request items they have access to"
    ON inventory_request_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM inventory_requests
            WHERE inventory_requests.id = inventory_request_items.request_id
            AND (
                inventory_requests.requested_by = auth.uid() OR
                (auth.jwt() -> 'user_metadata' ->> 'role')::text IN ('admin', 'manager')
            )
        )
    );

-- Policy for INSERT on inventory_request_items
CREATE POLICY "Users can insert request items for their requests"
    ON inventory_request_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM inventory_requests
            WHERE inventory_requests.id = inventory_request_items.request_id
            AND inventory_requests.requested_by = auth.uid()
        )
    );

-- Policy for UPDATE on inventory_request_items
CREATE POLICY "Admins and managers can update request items"
    ON inventory_request_items FOR UPDATE
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role')::text IN ('admin', 'manager')
    );

-- Verify the policies are created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('inventory_requests', 'inventory_request_items')
ORDER BY tablename, policyname;
