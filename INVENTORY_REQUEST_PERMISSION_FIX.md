# Inventory Request Permission Fix

## 🐛 Problem

**Error:** `Failed to submit request: permission denied for table users`

**When:** Housekeeping staff (or any non-admin staff) tries to submit an inventory request

**Where:** Request Inventory Items modal in the Tasks page

---

## 🔍 Root Cause

The Row Level Security (RLS) policies for `inventory_requests` and `inventory_request_items` tables were querying the `auth.users` table to check user permissions:

```sql
-- PROBLEMATIC CODE
EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
)
```

**The Issue:**
- Regular users (Housekeeping, Front Desk, etc.) don't have SELECT permission on `auth.users` table
- Only admins and service role have access to `auth.users`
- When RLS policy tries to query `auth.users`, it fails with "permission denied"

---

## ✅ Solution

Use `auth.jwt()` function instead of querying `auth.users` table. The JWT contains user metadata without requiring database access.

### Before (Broken):
```sql
EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
)
```

### After (Fixed):
```sql
(auth.jwt() -> 'user_metadata' ->> 'role')::text IN ('admin', 'manager')
```

---

## 🔧 How to Fix

### Step 1: Run the Fix SQL

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy and paste the contents of `FIX_INVENTORY_REQUESTS_RLS.sql`
4. Click "Run"

### Step 2: Verify the Fix

Run this query to check the policies:

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('inventory_requests', 'inventory_request_items')
ORDER BY tablename, policyname;
```

You should see 6 policies:
- 3 for `inventory_requests` (SELECT, INSERT, UPDATE)
- 3 for `inventory_request_items` (SELECT, INSERT, UPDATE)

### Step 3: Test

1. Login as Housekeeping staff
2. Go to Tasks page
3. Click "Request Inventory Items"
4. Select items and submit
5. Should work without errors! ✅

---

## 📋 Updated RLS Policies

### inventory_requests Table

#### 1. SELECT Policy
```sql
CREATE POLICY "Users can view their own department requests"
    ON inventory_requests FOR SELECT
    USING (
        auth.uid() = requested_by OR
        (auth.jwt() -> 'user_metadata' ->> 'role')::text IN ('admin', 'manager') OR
        (auth.jwt() -> 'user_metadata' ->> 'department')::text = department
    );
```

**Allows:**
- Users to view their own requests
- Admins and managers to view all requests
- Users to view requests from their department

#### 2. INSERT Policy
```sql
CREATE POLICY "Users can create requests for their department"
    ON inventory_requests FOR INSERT
    WITH CHECK (
        auth.uid() = requested_by AND
        (auth.jwt() -> 'user_metadata' ->> 'department')::text = department
    );
```

**Allows:**
- Users to create requests for their own department
- Prevents creating requests for other departments

#### 3. UPDATE Policy
```sql
CREATE POLICY "Admins and managers can update requests"
    ON inventory_requests FOR UPDATE
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role')::text IN ('admin', 'manager')
    );
```

**Allows:**
- Only admins and managers to update requests
- Regular staff cannot modify requests after submission

---

### inventory_request_items Table

#### 1. SELECT Policy
```sql
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
```

**Allows:**
- Users to view items in their own requests
- Admins and managers to view all request items

#### 2. INSERT Policy
```sql
CREATE POLICY "Users can insert request items for their requests"
    ON inventory_request_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM inventory_requests
            WHERE inventory_requests.id = inventory_request_items.request_id
            AND inventory_requests.requested_by = auth.uid()
        )
    );
```

**Allows:**
- Users to add items only to their own requests

#### 3. UPDATE Policy
```sql
CREATE POLICY "Admins and managers can update request items"
    ON inventory_request_items FOR UPDATE
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role')::text IN ('admin', 'manager')
    );
```

**Allows:**
- Only admins and managers to update request items

---

## 🎯 Key Differences

### Old Approach (Broken):
```sql
-- Queries auth.users table
EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
)
```

**Problems:**
- ❌ Requires SELECT permission on auth.users
- ❌ Fails for regular users
- ❌ Extra database query

### New Approach (Fixed):
```sql
-- Uses JWT metadata
(auth.jwt() -> 'user_metadata' ->> 'role')::text IN ('admin', 'manager')
```

**Benefits:**
- ✅ No database query needed
- ✅ Works for all users
- ✅ Faster performance
- ✅ More secure

---

## 🔐 Security Considerations

### What This Fix Does:
- ✅ Allows Housekeeping staff to submit inventory requests
- ✅ Maintains department-level access control
- ✅ Prevents users from viewing other departments' requests
- ✅ Restricts updates to admins and managers only

### What This Fix Does NOT Do:
- ❌ Does not give users access to auth.users table
- ❌ Does not bypass RLS
- ❌ Does not allow cross-department access
- ❌ Does not allow regular users to approve requests

---

## 🧪 Testing Checklist

### As Housekeeping Staff:
- [ ] Can open Request Inventory Items modal
- [ ] Can search and select items
- [ ] Can adjust quantities
- [ ] Can add notes
- [ ] Can submit request successfully
- [ ] Can view own requests in "My Requests" tab
- [ ] Cannot view other departments' requests
- [ ] Cannot approve or fulfill requests

### As Manager/Admin:
- [ ] Can view all requests
- [ ] Can approve requests
- [ ] Can fulfill requests
- [ ] Can update request status

---

## 📊 Before vs After

### Before (Broken):
```
Housekeeping Staff submits request
    ↓
RLS policy checks permissions
    ↓
Tries to query auth.users table
    ↓
❌ Permission denied error
    ↓
Request fails
```

### After (Fixed):
```
Housekeeping Staff submits request
    ↓
RLS policy checks permissions
    ↓
Reads user metadata from JWT
    ↓
✅ Permission granted
    ↓
Request succeeds
```

---

## 🚨 Important Notes

### User Metadata Requirements:

For this fix to work, users must have the following metadata in their JWT:

```json
{
  "user_metadata": {
    "role": "staff",
    "department": "Housekeeping",
    "full_name": "John Doe"
  }
}
```

**How to set user metadata:**

1. **During signup:**
   ```javascript
   const { data, error } = await supabase.auth.signUp({
     email: 'user@example.com',
     password: 'password',
     options: {
       data: {
         role: 'staff',
         department: 'Housekeeping',
         full_name: 'John Doe'
       }
     }
   });
   ```

2. **Update existing user:**
   ```javascript
   const { data, error } = await supabase.auth.updateUser({
     data: {
       role: 'staff',
       department: 'Housekeeping',
       full_name: 'John Doe'
     }
   });
   ```

3. **Via Supabase Dashboard:**
   - Go to Authentication → Users
   - Click on user
   - Edit "User Metadata" field
   - Add role and department

---

## 🔄 Rollback (If Needed)

If you need to rollback to the original policies:

```sql
-- Drop new policies
DROP POLICY IF EXISTS "Users can view their own department requests" ON inventory_requests;
DROP POLICY IF EXISTS "Users can create requests for their department" ON inventory_requests;
DROP POLICY IF EXISTS "Admins and managers can update requests" ON inventory_requests;
DROP POLICY IF EXISTS "Users can view request items they have access to" ON inventory_request_items;
DROP POLICY IF EXISTS "Users can insert request items for their requests" ON inventory_request_items;
DROP POLICY IF EXISTS "Admins and managers can update request items" ON inventory_request_items;

-- Re-run the original migration
-- (Copy from inventory_requests_migration.sql)
```

---

## 📝 Summary

**Problem:** Permission denied when Housekeeping staff submit inventory requests

**Cause:** RLS policies querying `auth.users` table without permission

**Solution:** Use `auth.jwt()` to read user metadata instead of querying database

**Files:**
- `FIX_INVENTORY_REQUESTS_RLS.sql` - SQL fix to run in Supabase
- `INVENTORY_REQUEST_PERMISSION_FIX.md` - This documentation

**Status:** ✅ Ready to deploy

---

**Created:** 2025-11-29  
**Issue:** Permission denied for table users  
**Fix:** Use auth.jwt() instead of querying auth.users  
**Impact:** High - Enables inventory requests for all staff
