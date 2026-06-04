# Settings Page Setup Guide

This guide explains how to set up the user settings functionality for the Settings page.

## Overview

The Settings page has been completely redesigned and now includes fully functional:
- **Profile Settings**: Update name, phone, and avatar
- **Preferences**: Language, timezone, date format, time format, currency, and theme
- **Notifications**: Email, SMS, browser, and in-app notification preferences
- **Security**: Session timeout, two-factor authentication toggle, and password change

## Database Setup

### Step 1: Create the user_settings table

Run the SQL migration script to create the `user_settings` table:

```bash
# Option 1: Run in Supabase SQL Editor
# Copy and paste the contents of scripts/create_user_settings_table.sql into the Supabase SQL Editor and execute it

# Option 2: Use Supabase CLI (if you have it installed)
supabase db execute --file scripts/create_user_settings_table.sql
```

### Step 2: Verify the table was created

Run this query in the Supabase SQL Editor to verify:

```sql
SELECT * FROM user_settings LIMIT 1;
```

You should see the table structure with columns:
- `id` (UUID)
- `user_id` (UUID, references auth.users)
- `language`, `timezone`, `date_format`, `time_format`, `currency`, `theme`
- `notifications` (JSONB)
- `two_factor_enabled`, `session_timeout`
- `created_at`, `updated_at`

## Features

### Profile Settings
- **Name**: Update first and last name
- **Phone**: Update contact number
- **Avatar**: Upload and update profile picture
- **Email & Role**: Display only (cannot be changed by user)

### Preferences
- **Language**: Choose from English, Spanish, French, German, Portuguese, Chinese
- **Time Zone**: Select from various time zones (GMT+0, GMT-5, GMT-8, etc.)
- **Date Format**: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY
- **Time Format**: 12-hour (AM/PM) or 24-hour
- **Currency**: GHS, USD, EUR, GBP, JPY, NGN
- **Theme**: Light or Dark mode (automatically applies when saved)

### Notifications
- **Email Notifications**: Toggle email notifications
- **SMS Notifications**: Toggle SMS notifications
- **Browser Notifications**: Toggle browser push notifications
- **In-App Notifications**: Toggle in-app notifications

### Security
- **Session Timeout**: Set automatic logout time (15 min, 30 min, 1 hour, 2 hours, 4 hours, Never)
- **Two-Factor Authentication**: Toggle 2FA (currently saves preference, full implementation can be added later)
- **Change Password**: Update password with validation (minimum 8 characters)

## How It Works

### Loading Settings
When the Settings page loads:
1. User profile data is loaded from `user_profiles` table
2. User settings are loaded from `user_settings` table
3. If no settings exist, default settings are created automatically
4. Form fields are populated with loaded data

### Saving Settings
When the user clicks "Save Changes":
1. Data is validated
2. Settings are saved to the `user_settings` table using upsert (insert or update)
3. Profile updates are saved to the `user_profiles` table
4. Avatar uploads are saved to Supabase Storage (avatars bucket)
5. Success/error messages are displayed

### Theme Changes
When theme preference is changed and saved:
- Theme is automatically applied via the ThemeContext
- Preference is saved to the database
- Theme persists across sessions

## RLS Policies

The `user_settings` table has Row Level Security (RLS) enabled with these policies:

1. **Users can view their own settings**: `SELECT` policy allowing users to read their own settings
2. **Users can insert their own settings**: `INSERT` policy allowing users to create their own settings
3. **Users can update their own settings**: `UPDATE` policy allowing users to update their own settings

These policies ensure users can only access and modify their own settings.

## Troubleshooting

### Settings not loading
- Check that the `user_settings` table exists
- Verify RLS policies are set up correctly
- Check browser console for errors
- Ensure user is authenticated

### Settings not saving
- Check that RLS policies allow updates
- Verify user_id matches the authenticated user
- Check browser console for specific error messages
- Ensure the table was created with all required columns

### Theme not applying
- Check that ThemeContext is properly configured
- Verify theme value is being saved correctly
- Check browser console for errors
- Try refreshing the page after saving

### Avatar upload failing
- Ensure the `avatars` storage bucket exists (run `npm run setup:storage`)
- Verify storage bucket RLS policies are set up
- Check file size (must be less than 5MB)
- Verify file type (must be an image)

### Password change not working
- Ensure user is authenticated
- Check that password meets minimum requirements (8 characters)
- Verify new password and confirm password match
- Check browser console for specific error messages

## Testing

To test the Settings page:

1. **Profile Settings**:
   - Update first name and last name
   - Update phone number
   - Upload a profile picture
   - Verify changes are saved and displayed

2. **Preferences**:
   - Change language, timezone, date format, time format, currency
   - Change theme and verify it applies
   - Verify preferences persist after page refresh

3. **Notifications**:
   - Toggle each notification type
   - Verify settings are saved
   - Check database to confirm values

4. **Security**:
   - Change session timeout
   - Toggle two-factor authentication
   - Change password and verify it works

## Future Enhancements

Potential improvements for the Settings page:

1. **Two-Factor Authentication**: Full implementation with QR code generation and verification
2. **Email Verification**: Add email verification functionality
3. **Account Deletion**: Add option to delete account
4. **Export Data**: Add option to export user data
5. **Activity Log**: Show recent account activity
6. **Connected Devices**: Show and manage connected devices
7. **API Keys**: Manage API keys if applicable
8. **Billing**: Add billing and subscription management (if applicable)

## Support

If you encounter any issues:
1. Check the browser console for error messages
2. Verify database setup is correct
3. Check RLS policies are properly configured
4. Ensure all dependencies are installed
5. Check Supabase dashboard for any service issues

