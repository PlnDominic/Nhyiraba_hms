# Debug: Food & Beverage Inventory Access Issue

## Problem
Food & Beverage staff can't access Inventory page even though it's in their department access list.

## Checklist for Debugging

### 1. Check User's Department Value
The department must be stored correctly in the database. Check:

```sql
-- Run this in Supabase SQL Editor while logged in as the F&B staff
SELECT 
    user_id,
    full_name,
    department,
    role
FROM user_profiles
WHERE user_id = auth.uid();
```

**Expected values:**
- `department = 'food_beverage'` ✅ (lowercase with underscore)
- `department = 'Food Beverage'` ✅ (normalized by code)
- `department = 'Food & Beverage'` ❌ (won't match due to `&`)

### 2. Log Out and Log Back In
The user session caches the user data. After updating department access:

1. **Click Logout**
2. **Log back in** with F&B credentials
3. **Try accessing Inventory page**

This refreshes the session with the new access rules.

### 3. Check Browser Console
Open browser DevTools (F12) and check for errors:

```
Access denied for <department> to page: Inventory
```

This will show exactly what department value is being used.

### 4. Verify Department Normalization
The code normalizes department names:
- `food_beverage` → `Food Beverage` ✅
- `Food & Beverage` → `Food & Beverage` ❌ (not normalized)

If stored as `Food & Beverage` with `&`, it won't match!

## Solution

### If Department is 'Food & Beverage' (with &):

Run this SQL to fix:

```sql
UPDATE user_profiles 
SET department = 'food_beverage' 
WHERE department = 'Food & Beverage';
```

### If Department is 'food_beverage' (correct):

Just log out and back in to refresh session.

## Test It

After fixing:

1. Log in as Food & Beverage staff
2. Check browser console: Should see normalized department
3. Navigate to `/inventory`
4. Should work! ✅

---

## Current Access List

Food Beverage department can access:
- ✅ Dashboard
- ✅ Tasks
- ✅ Restaurant
- ✅ Services
- ✅ **Inventory** ← Should work
- ✅ Settings

---

## Still Not Working?

Add debug logging to see what's happening:

1. Open `client/src/components/ProtectedRoute.js`
2. Look for the `console.log('Access denied for...')` line
3. Check what it says in the console
4. Send me the exact error message

---

**Last Updated**: 2025-11-09
