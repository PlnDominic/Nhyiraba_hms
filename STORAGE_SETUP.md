# Storage Bucket Setup Guide

This guide explains how to set up the storage bucket for user avatars in your Supabase project.

## Problem

If you're seeing this error:
```
StorageApiError: Bucket not found
```

It means the `avatars` storage bucket hasn't been created yet in your Supabase project.

## Solution

### Option 1: Automated Setup (Recommended)

1. **Make sure you have the service role key** in your `.env` file:
   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_KEY=your_service_role_key
   ```
   
   ⚠️ **Important**: You need the **service role key** (not the anon key) to create buckets. 
   - Get it from: Supabase Dashboard → Settings → API → `service_role` key

2. **Run the setup script**:
   ```bash
   node scripts/create_avatars_bucket.js
   ```

3. **Apply RLS policies**:
   ```sql
   -- Run this in Supabase SQL Editor
   -- Or use: scripts/setup_storage_bucket.sql
   ```

### Option 2: Manual Setup via Dashboard

1. **Go to Supabase Dashboard** → Your Project → **Storage**

2. **Click "New bucket"**

3. **Configure the bucket**:
   - **Name**: `avatars`
   - **Public bucket**: ✅ (checked - required for viewing avatars)
   - Click **"Create bucket"**

4. **Apply RLS policies**:
   - Go to **SQL Editor** in Supabase Dashboard
   - Copy and paste the contents of `scripts/setup_storage_bucket.sql`
   - Click **"Run"**

### Option 3: Using Supabase Management API

If you prefer using the API directly, you can use the Supabase Management API to create the bucket. See the [Supabase API documentation](https://supabase.com/docs/reference/api/createbucket) for details.

## Verification

After setting up the bucket, verify it works:

1. **Check bucket exists**:
   ```sql
   SELECT name, id, public, created_at 
   FROM storage.buckets 
   WHERE name = 'avatars';
   ```

2. **Check RLS policies**:
   ```sql
   SELECT * FROM pg_policies 
   WHERE tablename = 'objects' 
   AND schemaname = 'storage'
   AND policyname LIKE '%avatar%';
   ```

3. **Test upload**:
   - Go to Settings page in your app
   - Try uploading a profile picture
   - It should upload successfully without errors

## RLS Policies

The setup script creates the following RLS policies:

1. **Public access**: Anyone can view avatars (for displaying profile pictures)
2. **Authenticated upload**: Authenticated users can upload avatars to the `public/` folder
3. **Authenticated update**: Authenticated users can update/replace their avatars
4. **Authenticated delete**: Authenticated users can delete their avatars

## File Path Structure

Avatar files are stored with this structure:
```
avatars/
  └── public/
      └── avatar-{userId}-{timestamp}.{ext}
```

This structure ensures:
- All avatars are in the `public/` folder (required by RLS policies)
- Files are uniquely named per user and timestamp
- File extensions are preserved

## Troubleshooting

### Error: "Bucket not found"
- ✅ Run the setup script: `node scripts/create_avatars_bucket.js`
- ✅ Or create the bucket manually in the Supabase Dashboard

### Error: "new row violates row-level security policy"
- ✅ Run the RLS policy script: `scripts/setup_storage_bucket.sql`
- ✅ Make sure the bucket is set to **public**
- ✅ Verify policies are applied correctly

### Error: "Upload failed: Permission denied"
- ✅ Check that your user is authenticated
- ✅ Verify RLS policies allow authenticated users to upload
- ✅ Make sure files are uploaded to the `public/` folder

### Avatar not displaying after upload
- ✅ Check that the bucket is set to **public**
- ✅ Verify the public URL is correct
- ✅ Check browser console for CORS or loading errors

## Security Notes

- The `avatars` bucket is set to **public** to allow viewing profile pictures without authentication
- Upload is restricted to **authenticated users only**
- Files are stored in the `public/` folder within the bucket
- File size is limited to 5MB (configurable in bucket settings)
- Allowed MIME types: `image/jpeg`, `image/png`, `image/gif`, `image/webp`

## Support

If you continue to experience issues:
1. Check the browser console for detailed error messages
2. Verify your Supabase credentials are correct
3. Ensure you have the necessary permissions (service role key for bucket creation)
4. Check Supabase Dashboard → Storage for bucket status

