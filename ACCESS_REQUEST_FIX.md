# 🔧 Fix: "Row violates row-level security policy" Error

## Problem
When users try to submit an access request, they get this error:
```
new row violates row-level security policy for table "access_requests"
```

## Cause
The RLS (Row-Level Security) policy on the `access_requests` table is blocking anonymous users from inserting requests.

---

## ✅ Solution (1 minute)

### Step 1: Open Supabase SQL Editor

### Step 2: Run This SQL

```sql
-- Drop conflicting policies
DROP POLICY IF EXISTS "Anyone can insert access requests" ON access_requests;

-- Create new policy that explicitly allows public access
CREATE POLICY "allow_access_request_submission" 
ON access_requests 
FOR INSERT 
TO public
WITH CHECK (true);

-- Verify it worked
SELECT 
    policyname,
    cmd,
    roles
FROM pg_policies 
WHERE tablename = 'access_requests' 
AND cmd = 'INSERT';
```

You should see:
```
policyname: allow_access_request_submission
cmd: INSERT
roles: {public}
```

### Step 3: Test Access Request

1. Go to your app's **Request Access** page (not logged in)
2. Fill out the form:
   - Full Name
   - Email
   - Position
   - Department
   - Contact Number
3. Click **Submit Request**
4. Should see: **"Request submitted successfully!"** ✅

---

## What This Does

The policy change allows:
- ✅ **Anonymous users** to submit access requests (INSERT)
- ✅ **Admins only** to view requests (SELECT)
- ✅ **Admins only** to approve/reject requests (UPDATE)

This is secure because:
- Anyone can request access (public form)
- Only admins can see and process requests
- No sensitive data is exposed

---

## 🧪 Troubleshooting

### Still getting RLS error?

1. **Check if RLS is enabled:**
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'access_requests';
```

2. **List all policies:**
```sql
SELECT policyname, cmd, roles 
FROM pg_policies 
WHERE tablename = 'access_requests';
```

3. **Re-run the full fix script:**
   - Use `fix_access_requests_rls.sql`

### Error: "relation does not exist"

The `access_requests` table might not be created. Run:
```sql
CREATE TABLE IF NOT EXISTS access_requests (
    id BIGSERIAL PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    position TEXT NOT NULL,
    department TEXT NOT NULL,
    reason TEXT,
    contact_number TEXT,
    request_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'pending',
    processed_by UUID REFERENCES auth.users(id),
    processed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;
```

Then re-apply the policy fix.

---

## 📁 Related Files

- `fix_access_requests_rls.sql` - Complete fix script
- `check_access_requests_policies.sql` - Diagnostic script
- `supabase/migrations/20251109_fix_access_requests_rls.sql` - Migration file

---

## Why This Happened

The original policy might have been:
- Named inconsistently
- Not applied to the `public` role
- Conflicting with other policies
- Missing the `TO public` clause

The fix ensures the policy explicitly allows public INSERT operations while keeping SELECT and UPDATE restricted to admins only.

---

**Last Updated**: 2025-11-09
