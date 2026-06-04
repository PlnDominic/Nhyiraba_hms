# Admin User Setup Instructions
## Creating Admin Account: Seth Mensah (nhyirabahotel@gmail.com)

Follow these steps to create the admin user account.

---

## Step 1: Create Auth User in Supabase Dashboard

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project: `kqjoqkmcxvynqdsjekkc`

2. **Navigate to Authentication**
   - Click "Authentication" in the left sidebar
   - Click "Users" tab
   - Click the "Add User" button (green button at top right)

3. **Fill in User Details**
   ```
   Email: nhyirabahotel@gmail.com
   Password: [Choose a strong password - you'll need to remember this!]
   ```
   
   **IMPORTANT:** 
   - ✅ Check "Auto Confirm User" box (this skips email verification)
   - ✅ Make sure to save/remember the password you set

4. **Click "Create User"**
   - User will be created in Supabase Auth
   - Copy the User ID (UUID) that appears - you'll need it for verification

---

## Step 2: Run SQL Script to Create Profile & Permissions

1. **Open SQL Editor**
   - In Supabase Dashboard, click "SQL Editor" in left sidebar
   - Click "New Query"

2. **Run the Setup Script**
   - Open file: `create_admin_user.sql`
   - Copy **ALL** contents
   - Paste into SQL Editor
   - Click "Run" button

3. **Verify Results**
   The script will:
   - ✅ Create admin profile for Seth Mensah
   - ✅ Grant all 7 permissions
   - ✅ Show verification queries confirming setup

   You should see results showing:
   - User profile with role: 'admin'
   - 7 permissions assigned to the user

---

## Step 3: Test Admin Login

1. **Go to Login Page**
   - Open: https://nhyiraba-hms.vercel.app/login

2. **Login with Admin Credentials**
   ```
   Email: nhyirabahotel@gmail.com
   Password: [The password you set in Step 1]
   ```

3. **Verify Admin Access**
   - After successful login, you should be redirected to:
     `/admin/access-control`
   - You should see the Admin Access Control Panel
   - All admin features should be accessible

---

## What the Admin Account Has Access To:

### ✅ All Permissions:
- ✅ Manage Reservations
- ✅ Manage Rooms
- ✅ Manage Guests
- ✅ Manage Billing
- ✅ View Reports
- ✅ Manage Staff
- ✅ System Settings

### ✅ Admin-Only Features:
- Access Request Management (`/admin/access-control`)
- User Account Creation
- Permission Management
- Full System Access

---

## Troubleshooting

### Problem: "Invalid login credentials"
**Solution:**
1. Check email is exactly: `nhyirabahotel@gmail.com`
2. Verify password is correct
3. In Supabase Dashboard > Authentication > Users:
   - Find the user
   - Check "Email Confirmed" column shows a checkmark
   - If not confirmed, click the user and click "Confirm User"

### Problem: "Access denied" after login
**Solution:**
1. Go to Supabase SQL Editor
2. Run verification query:
   ```sql
   SELECT role FROM user_profiles 
   WHERE user_id = (SELECT id FROM auth.users WHERE email = 'nhyirabahotel@gmail.com');
   ```
3. Verify result shows `role = 'admin'`
4. If not, run:
   ```sql
   UPDATE user_profiles 
   SET role = 'admin' 
   WHERE user_id = (SELECT id FROM auth.users WHERE email = 'nhyirabahotel@gmail.com');
   ```

### Problem: "User not found in user_profiles"
**Solution:**
Re-run Step 2 of the SQL script (`create_admin_user.sql`)

### Problem: Can't see admin panel after login
**Solution:**
1. Clear browser cache
2. Open browser console (F12)
3. Check for errors
4. Try logout and login again

---

## Quick Reference

| Item | Value |
|------|-------|
| **Email** | nhyirabahotel@gmail.com |
| **Name** | Seth Mensah |
| **Role** | admin |
| **Position** | System Administrator |
| **Department** | Management |
| **Login URL** | https://nhyiraba-hms.vercel.app/login |
| **Admin Panel** | https://nhyiraba-hms.vercel.app/admin/access-control |

---

## Security Best Practices

1. **Use a Strong Password**
   - Minimum 12 characters
   - Mix of uppercase, lowercase, numbers, symbols
   - Don't share the password

2. **Update Contact Number**
   After first login, go to Settings and update the contact number

3. **Enable 2FA** (Optional)
   Supabase supports 2FA for additional security

4. **Regular Password Changes**
   Change the admin password every 90 days

---

**Setup Complete!** 🎉

Your admin account is ready. Login at https://nhyiraba-hms.vercel.app/login
