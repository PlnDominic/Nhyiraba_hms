# Fixing 403 Forbidden Error When Saving Reports to Supabase

## Problem Description

You're experiencing a 403 Forbidden error when trying to save reports to Supabase:

```
Failed to load resource: the server responded with a status of 403 ()
Supabase permission error: Forbidden (403) when POST on reports. This may be due to Row Level Security policies.
Supabase error saving report: Object
Error saving report to Supabase: Object
```

## Root Cause

This error is caused by **Row Level Security (RLS) policies** on the `reports` table that are preventing the current user from inserting data. The issue can be:

1. **Missing reports table** - The table doesn't exist in your Supabase database
2. **Restrictive RLS policies** - The policies are too restrictive and don't allow the current user to insert data
3. **Authentication issues** - The user's session has expired or is invalid
4. **Missing permissions** - The user doesn't have the required role/permissions

## Solution Steps

### Step 1: Run the RLS Fix Script

1. **Log in to your Supabase Dashboard** at [https://app.supabase.com/](https://app.supabase.com/)
2. **Select your project**
3. **Go to the SQL Editor** (in the left sidebar)
4. **Create a "New Query"**
5. **Copy and paste the entire contents** of the `fix_reports_table_rls.sql` file
6. **Click "Run"** to execute the script

This script will:
- Create the reports table if it doesn't exist
- Enable RLS on the table
- Remove any existing restrictive policies
- Create new open policies that allow both authenticated and anonymous access
- Grant necessary permissions to the public role

### Step 2: Verify the Fix

After running the script, you should see:
- A success message: "Reports table RLS setup complete"
- The policies listed in the verification query
- A test insert and delete operation that succeeds

### Step 3: Test the Application

1. **Refresh your application** in the browser
2. **Try to generate and save a report** again
3. **Check the browser console** for any remaining errors

## Alternative Solutions

### If the Script Doesn't Work

If you still get errors after running the script, try these alternatives:

#### Option A: Disable RLS Temporarily (For Testing Only)

```sql
-- WARNING: This disables security - only use for testing
ALTER TABLE public.reports DISABLE ROW LEVEL SECURITY;
```

#### Option B: Create Simple Open Policy

```sql
-- Drop all existing policies
DROP POLICY IF EXISTS "Allow public read access to reports" ON public.reports;
DROP POLICY IF EXISTS "Allow public insert access to reports" ON public.reports;
DROP POLICY IF EXISTS "Allow public update access to reports" ON public.reports;
DROP POLICY IF EXISTS "Allow public delete access to reports" ON public.reports;

-- Create one simple policy that allows everything
CREATE POLICY "Allow all operations on reports" 
ON public.reports 
FOR ALL 
TO anon, authenticated
USING (true) 
WITH CHECK (true);
```

#### Option C: Check User Authentication

Verify that the user is properly authenticated:

```sql
-- Check current user's role and permissions
SELECT 
    auth.uid() as current_user_id,
    auth.role() as current_role,
    auth.jwt() ->> 'email' as user_email;
```

## Prevention

To prevent this issue in the future:

1. **Always test RLS policies** after creating new tables
2. **Use the principle of least privilege** - only grant necessary permissions
3. **Test with both authenticated and anonymous users** during development
4. **Keep RLS policies simple** until you understand the security requirements

## Debugging Tips

### Check Current RLS Policies

```sql
-- View all policies on the reports table
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual, 
    with_check
FROM pg_policies 
WHERE tablename = 'reports' 
AND schemaname = 'public';
```

### Check Table Structure

```sql
-- Verify the reports table exists and has correct structure
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'reports' 
AND table_schema = 'public';
```

### Test Permissions

```sql
-- Test if you can insert a record
INSERT INTO public.reports (name, type, generated_by) 
VALUES ('Test Report', 'test', 'test_user')
RETURNING id, name, created_at;

-- Clean up test data
DELETE FROM public.reports WHERE name = 'Test Report';
```

## Common Issues and Solutions

### Issue: "Table doesn't exist"
**Solution**: Run the `fix_reports_table_rls.sql` script to create the table

### Issue: "Permission denied"
**Solution**: The RLS policies are too restrictive - run the fix script

### Issue: "Authentication required"
**Solution**: Check if the user is properly logged in and the session is valid

### Issue: "Role not found"
**Solution**: Verify the user has the correct role assigned in the user_profiles table

## Support

If you continue to experience issues after following these steps:

1. **Check the Supabase logs** in your dashboard
2. **Review the browser console** for detailed error messages
3. **Verify your Supabase credentials** are correct
4. **Ensure your database is accessible** and not in maintenance mode
5. **Contact Nhyiraba Hotel support** at +233(0)248676262 or info.lavimacroyalhotel@gmail.com for additional assistance

## Security Note

The fix script creates open policies that allow public access to the reports table. This is suitable for development and testing, but for production use, you should:

1. **Review the security requirements** for your application
2. **Implement more restrictive policies** based on user roles
3. **Consider data sensitivity** and implement appropriate access controls
4. **Regularly audit** your RLS policies for security compliance
