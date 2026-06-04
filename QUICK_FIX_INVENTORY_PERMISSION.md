# Quick Fix: Inventory Request Permission Error

## 🚨 Problem
**Error:** `Failed to submit request: permission denied for table users`  
**Affected:** Housekeeping staff (and all non-admin staff)  
**Feature:** Request Inventory Items modal

---

## ⚡ Quick Fix (5 minutes)

### Step 1: Open Supabase
1. Go to your Supabase Dashboard
2. Click on "SQL Editor"

### Step 2: Run the Fix
1. Copy the entire contents of `FIX_INVENTORY_REQUESTS_RLS.sql`
2. Paste into SQL Editor
3. Click "Run" or press Ctrl+Enter

### Step 3: Verify
You should see a success message and a table showing 6 policies.

### Step 4: Test
1. Login as Housekeeping staff
2. Go to Tasks page
3. Click "Request Inventory Items"
4. Submit a request
5. ✅ Should work!

---

## 🔍 What This Does

**Replaces:** RLS policies that query `auth.users` table  
**With:** RLS policies that use `auth.jwt()` function  
**Result:** Housekeeping staff can now submit inventory requests

---

## 📋 Technical Details

### The Problem:
```sql
-- OLD (Broken)
EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
)
```
❌ Regular users can't query `auth.users` table

### The Solution:
```sql
-- NEW (Fixed)
(auth.jwt() -> 'user_metadata' ->> 'role')::text IN ('admin', 'manager')
```
✅ Reads from JWT token (no database query needed)

---

## 🎯 What Gets Fixed

### Before:
- ❌ Housekeeping staff get permission error
- ❌ Front Desk staff get permission error
- ❌ Any non-admin staff get permission error
- ✅ Only admins can submit requests (not intended)

### After:
- ✅ Housekeeping staff can submit requests
- ✅ Front Desk staff can submit requests
- ✅ All staff can submit requests for their department
- ✅ Admins and managers can approve/update requests

---

## 🔐 Security

**No security is compromised:**
- ✅ Users can only create requests for their own department
- ✅ Users can only view their own requests
- ✅ Only admins/managers can approve requests
- ✅ Only admins/managers can update requests
- ✅ Department-level access control maintained

---

## 📄 Files

1. **FIX_INVENTORY_REQUESTS_RLS.sql** - Run this in Supabase
2. **INVENTORY_REQUEST_PERMISSION_FIX.md** - Full documentation
3. **QUICK_FIX_INVENTORY_PERMISSION.md** - This file

---

## ✅ Checklist

- [ ] Open Supabase SQL Editor
- [ ] Copy FIX_INVENTORY_REQUESTS_RLS.sql
- [ ] Paste and run in SQL Editor
- [ ] Verify 6 policies created
- [ ] Test as Housekeeping staff
- [ ] Confirm request submission works

---

## 🆘 If It Doesn't Work

1. **Check user metadata:**
   - Users must have `role` and `department` in their JWT
   - Go to Authentication → Users → Edit user metadata

2. **Check RLS is enabled:**
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE tablename IN ('inventory_requests', 'inventory_request_items');
   ```
   Both should show `rowsecurity = true`

3. **Check policies exist:**
   ```sql
   SELECT tablename, policyname 
   FROM pg_policies 
   WHERE tablename IN ('inventory_requests', 'inventory_request_items');
   ```
   Should show 6 policies total

---

**Time to fix:** 5 minutes  
**Difficulty:** Easy (just run SQL)  
**Impact:** High (enables critical feature)  
**Risk:** Low (only updates RLS policies)

---

**Ready to fix? Run `FIX_INVENTORY_REQUESTS_RLS.sql` in Supabase now!** 🚀
