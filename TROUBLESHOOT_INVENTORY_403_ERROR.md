# Troubleshooting: 403 Forbidden Error on Inventory Requests

## 🚨 Error Details

**Error Message:**
```
POST https://...supabase.co/rest/v1/inventory_requests?columns=... 403 (Forbidden)
Supabase permission error: Forbidden (403) when POST on inventory_requests
Error loading requests: Object
```

**Location:** TasksPage.js:473  
**Affected:** Housekeeping staff trying to view or submit inventory requests

---

## 🔍 Root Causes

### 1. **RLS Policies Not Applied**
The RLS (Row Level Security) policies may not have been created or are using the old approach that queries `auth.users` table.

### 2. **Missing User Metadata**
User's JWT token may not contain required metadata (`role`, `department`).

### 3. **Incorrect Permissions**
The `authenticated` role may not have been granted SELECT/INSERT permissions on the tables.

---

## ✅ Complete Fix (Step-by-Step)

### Step 1: Apply Updated RLS Policies

1. **Open Supabase Dashboard**
2. **Go to SQL Editor**
3. **Copy and paste** the entire contents of `FIX_INVENTORY_REQUESTS_RLS_V2.sql`
4. **Click "Run"**

This will:
- Drop old policies
- Create new policies using `auth.jwt()`
- Grant necessary permissions
- Add DELETE policies for admins

### Step 2: Verify User Metadata

Check that users have the required metadata in their JWT:

```sql
-- Check user metadata
SELECT 
    id,
    email,
    raw_user_meta_data->>'role' as role,
    raw_user_meta_data->>'department' as department,
    raw_user_meta_data->>'full_name' as full_name
FROM auth.users
WHERE email = 'housekeeping@example.com'; -- Replace with actual email
```

**Expected output:**
```
role: "staff"
department: "Housekeeping"
full_name: "John Doe"
```

**If metadata is missing**, update it:

```sql
-- Update user metadata (run as admin)
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
    jsonb_set(
        raw_user_meta_data,
        '{role}',
        '"staff"'
    ),
    '{department}',
    '"Housekeeping"'
)
WHERE email = 'housekeeping@example.com';
```

### Step 3: Verify RLS is Enabled

```sql
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename IN ('inventory_requests', 'inventory_request_items');
```

**Expected output:**
```
rowsecurity: t (true) for both tables
```

**If RLS is disabled**, enable it:

```sql
ALTER TABLE inventory_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_request_items ENABLE ROW LEVEL SECURITY;
```

### Step 4: Verify Policies Exist

```sql
SELECT 
    tablename, 
    policyname,
    cmd
FROM pg_policies
WHERE tablename IN ('inventory_requests', 'inventory_request_items')
ORDER BY tablename, policyname;
```

**Expected output:** 8 policies total
- 4 for `inventory_requests` (SELECT, INSERT, UPDATE, DELETE)
- 4 for `inventory_request_items` (SELECT, INSERT, UPDATE, DELETE)

### Step 5: Test Permissions

```sql
-- Test SELECT permission (as authenticated user)
SELECT * FROM inventory_requests LIMIT 1;

-- Test INSERT permission (as authenticated user)
INSERT INTO inventory_requests (
    requested_by, 
    requester_name, 
    department, 
    status, 
    notes
)
VALUES (
    auth.uid(), 
    'Test User', 
    'Housekeeping', 
    'pending', 
    'Test request'
)
RETURNING *;

-- Clean up test data
DELETE FROM inventory_requests WHERE notes = 'Test request';
```

---

## 🔧 Common Issues and Solutions

### Issue 1: "permission denied for table users"

**Cause:** RLS policies are querying `auth.users` table

**Solution:** Use `auth.jwt()` instead (already fixed in V2 SQL)

### Issue 2: "403 Forbidden" on SELECT

**Cause:** User doesn't have permission to view requests

**Solutions:**
1. Check user has `department` metadata
2. Verify SELECT policy exists
3. Ensure user's department matches request department

### Issue 3: "403 Forbidden" on INSERT

**Cause:** User doesn't have permission to create requests

**Solutions:**
1. Check user has `department` metadata
2. Verify INSERT policy exists
3. Ensure `requested_by` matches `auth.uid()`
4. Ensure `department` matches user's department

### Issue 4: Policies not working

**Cause:** Policies may have syntax errors or wrong conditions

**Solution:** Drop and recreate policies using V2 SQL

---

## 🎯 Key Differences in V2 Fix

### Old Approach (Broken):
```sql
EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
)
```
❌ Queries `auth.users` table (permission denied)

### New Approach (Fixed):
```sql
(auth.jwt() -> 'user_metadata' ->> 'role')::text IN ('admin', 'manager')
```
✅ Reads from JWT token (no database query)

### Additional Improvements in V2:

1. **Better NULL handling:**
   ```sql
   (auth.jwt() -> 'user_metadata' ->> 'department') IS NULL
   ```
   Allows requests even if department metadata is missing

2. **Added DELETE policies:**
   - Admins can delete requests and items
   - Prevents orphaned data

3. **Explicit GRANT statements:**
   ```sql
   GRANT SELECT, INSERT ON inventory_requests TO authenticated;
   ```
   Ensures authenticated users have base permissions

4. **Department matching:**
   ```sql
   (auth.jwt() -> 'user_metadata' ->> 'department')::text = department
   ```
   Users can view all requests from their department

---

## 🧪 Testing Checklist

### As Housekeeping Staff:

- [ ] Login successfully
- [ ] Navigate to Tasks page
- [ ] Click "Request Inventory Items"
- [ ] See list of available items
- [ ] Select items and add to request
- [ ] Submit request (should succeed)
- [ ] See request in "My Requests" tab
- [ ] No 403 errors in console
- [ ] No "permission denied" errors

### As Admin/Manager:

- [ ] Can view all requests
- [ ] Can approve requests
- [ ] Can update request status
- [ ] Can delete requests

---

## 📊 Debugging Steps

### 1. Check Browser Console

Look for these errors:
```
✅ No errors = Working correctly
❌ 403 Forbidden = RLS policy issue
❌ permission denied for table users = Old policies still active
❌ null value in column = Missing user metadata
```

### 2. Check Network Tab

Look at the request:
```
Method: POST (for INSERT) or GET (for SELECT)
URL: /rest/v1/inventory_requests
Status: 200 (success) or 403 (forbidden)
```

### 3. Check Supabase Logs

In Supabase Dashboard → Logs:
```
Look for: "permission denied" or "policy violation"
```

### 4. Test with SQL Editor

Run queries directly in SQL Editor to isolate the issue:
```sql
-- This should work
SELECT * FROM inventory_requests WHERE department = 'Housekeeping';

-- This should also work
INSERT INTO inventory_requests (requested_by, requester_name, department, status)
VALUES (auth.uid(), 'Test', 'Housekeeping', 'pending');
```

---

## 🔐 Security Verification

After applying the fix, verify security is maintained:

### What Users CAN Do:
- ✅ View their own requests
- ✅ View requests from their department
- ✅ Create requests for their department
- ✅ Add items to their own requests

### What Users CANNOT Do:
- ❌ View requests from other departments
- ❌ Create requests for other departments
- ❌ Update request status (only admins/managers)
- ❌ Delete requests (only admins)
- ❌ Modify other users' requests

### What Admins/Managers CAN Do:
- ✅ View all requests
- ✅ Update any request
- ✅ Delete any request
- ✅ Approve/reject requests

---

## 📝 Quick Reference

### Files:
- `FIX_INVENTORY_REQUESTS_RLS_V2.sql` - Updated fix (run this)
- `FIX_INVENTORY_REQUESTS_RLS.sql` - Old fix (don't use)
- `TROUBLESHOOT_INVENTORY_403_ERROR.md` - This guide

### Key Commands:

```sql
-- Check policies
SELECT * FROM pg_policies WHERE tablename = 'inventory_requests';

-- Check RLS status
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'inventory_requests';

-- Check user metadata
SELECT raw_user_meta_data FROM auth.users WHERE email = 'user@example.com';

-- Test permissions
SELECT * FROM inventory_requests LIMIT 1;
```

---

## 🆘 Still Not Working?

### 1. Clear Browser Cache
- Hard refresh: Ctrl + Shift + R
- Or use incognito mode

### 2. Re-login
- Logout and login again
- This refreshes the JWT token

### 3. Check User Account
```sql
SELECT 
    email,
    raw_user_meta_data,
    created_at,
    confirmed_at
FROM auth.users
WHERE email = 'housekeeping@example.com';
```

### 4. Verify Tables Exist
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('inventory_requests', 'inventory_request_items');
```

### 5. Check for Conflicting Policies
```sql
-- Drop ALL policies and start fresh
DROP POLICY IF EXISTS "Users can view their own department requests" ON inventory_requests;
-- ... (drop all policies)

-- Then run FIX_INVENTORY_REQUESTS_RLS_V2.sql
```

---

## ✅ Success Indicators

You'll know it's working when:

1. **No console errors**
2. **Requests load in Tasks page**
3. **Can submit new requests**
4. **Requests appear in "My Requests" tab**
5. **Status code 200 in Network tab**

---

**Run `FIX_INVENTORY_REQUESTS_RLS_V2.sql` in Supabase SQL Editor to fix the issue!** 🚀

---

**Created:** 2025-11-29  
**Issue:** 403 Forbidden on inventory_requests  
**Fix:** Updated RLS policies using auth.jwt()  
**Status:** Ready to deploy
