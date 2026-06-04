# ⚡ Quick Fix: Access Request RLS Error (30 seconds)

## Error You're Seeing
```
new row violates row-level security policy for table "access_requests"
```

## Quick Fix

### Copy & Paste This into Supabase SQL Editor:

```sql
DROP POLICY IF EXISTS "Anyone can insert access requests" ON access_requests;

CREATE POLICY "allow_access_request_submission" 
ON access_requests 
FOR INSERT 
TO public
WITH CHECK (true);
```

### Done! ✅

Now try submitting an access request again - it should work!

---

## What This Does
- Allows anonymous users to submit access requests
- Still keeps viewing/approving restricted to admins
- Fixes the RLS policy blocking public access

---

Need more help? See `ACCESS_REQUEST_FIX.md` for detailed troubleshooting.
