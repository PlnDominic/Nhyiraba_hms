-- ============================================================================
-- Setup Storage Bucket for User Avatars
-- ============================================================================
-- 
-- IMPORTANT: Storage buckets cannot be created via SQL in Supabase.
-- You must create the bucket first using one of these methods:
--
-- METHOD 1: Use the Node.js script (Recommended)
--   Run: node scripts/create_avatars_bucket.js
--
-- METHOD 2: Create manually in Supabase Dashboard
--   1. Go to Storage in your Supabase Dashboard
--   2. Click "New bucket"
--   3. Name: "avatars"
--   4. Make it public: ✅ (checked)
--   5. Click "Create bucket"
--
-- METHOD 3: Use Supabase Management API
--   See: https://supabase.com/docs/reference/api/createbucket
--
-- After creating the bucket, run this SQL script to set up RLS policies.
-- ============================================================================

-- Enable Row Level Security on storage.objects if not already enabled
-- (This is usually enabled by default in Supabase)

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow public access to avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete avatars" ON storage.objects;

-- ============================================================================
-- POLICY 1: Allow public access to view avatars
-- ============================================================================
-- This policy allows anyone (authenticated or not) to view avatar images.
-- This is necessary for displaying profile pictures in the UI.
CREATE POLICY "Allow public access to avatars"
ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');

-- ============================================================================
-- POLICY 2: Allow authenticated users to upload avatars
-- ============================================================================
-- This policy allows authenticated users to upload avatar images to the
-- 'public' folder within the avatars bucket.
-- The path structure should be: public/avatar-{userId}-{timestamp}
CREATE POLICY "Allow authenticated users to upload avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = 'public'
);

-- ============================================================================
-- POLICY 3: Allow users to update/replace their avatars
-- ============================================================================
-- This policy allows authenticated users to update (replace) avatar images
-- they have uploaded. This uses upsert functionality.
CREATE POLICY "Allow users to update avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = 'public'
)
WITH CHECK (
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = 'public'
);

-- ============================================================================
-- POLICY 4: Allow users to delete their avatars
-- ============================================================================
-- This policy allows authenticated users to delete avatar images.
-- Note: The current implementation uses upsert, so deletion may not be
-- necessary, but it's good to have for cleanup.
CREATE POLICY "Allow users to delete avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = 'public'
);

-- ============================================================================
-- Verification Query
-- ============================================================================
-- Run this query to verify the bucket exists and policies are set:
-- 
-- SELECT 
--   name, 
--   id, 
--   public, 
--   created_at 
-- FROM storage.buckets 
-- WHERE name = 'avatars';
--
-- To check policies:
-- SELECT * FROM pg_policies 
-- WHERE tablename = 'objects' 
-- AND schemaname = 'storage'
-- AND policyname LIKE '%avatar%';
-- ============================================================================

