-- fix_user_permissions_rls.sql
-- Enable Row Level Security and add policies for the user_permissions table
-- Allows admins to view, insert, update, and delete any permission rows,
-- while regular users can only manage their own permissions.

-- Enable RLS on the table (if not already enabled)
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Policy for regular users: they can manage only their own permission rows
CREATE POLICY "Allow users to manage own permissions"
  ON user_permissions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy for admins: they can manage any permission rows
CREATE POLICY "Allow admins to manage any permissions"
  ON user_permissions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.role = 'admin'
    )
  );

-- Optional: Grant SELECT permission for admins to see all rows (covered by the above policy)
-- No further action needed as the policy already allows SELECT for admins.
