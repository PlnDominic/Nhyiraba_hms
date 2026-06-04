/**
 * Script to create the 'avatars' storage bucket in Supabase
 * 
 * This script creates the storage bucket needed for user profile avatars.
 * Run this script once to set up the bucket before users can upload avatars.
 * 
 * Usage:
 *   node scripts/create_avatars_bucket.js
 * 
 * Requirements:
 *   - SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env file
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) {
  console.error('❌ Error: SUPABASE_URL is not set in .env file');
  process.exit(1);
}

if (!supabaseServiceKey) {
  console.error('❌ Error: SUPABASE_SERVICE_KEY is not set in .env file');
  console.error('   You need the service role key (not the anon key) to create buckets.');
  process.exit(1);
}

// Create Supabase client with service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAvatarsBucket() {
  console.log('🚀 Starting avatars bucket creation...\n');

  try {
    // Check if bucket already exists
    const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('❌ Error listing buckets:', listError.message);
      throw listError;
    }

    const avatarsBucket = existingBuckets.find(bucket => bucket.name === 'avatars');
    
    if (avatarsBucket) {
      console.log('✅ Bucket "avatars" already exists!');
      console.log('   Bucket ID:', avatarsBucket.id);
      console.log('   Public:', avatarsBucket.public);
      console.log('\n⚠️  If you\'re still getting errors, make sure:');
      console.log('   1. The bucket is set to public (or RLS policies are correctly set)');
      console.log('   2. RLS policies are applied (run fix_user_profiles_rls.sql)');
      return;
    }

    // Create the bucket
    console.log('📦 Creating "avatars" bucket...');
    const { data, error } = await supabase.storage.createBucket('avatars', {
      public: true, // Make bucket public so avatars can be viewed
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
      fileSizeLimit: 5242880 // 5MB limit
    });

    if (error) {
      console.error('❌ Error creating bucket:', error.message);
      throw error;
    }

    console.log('✅ Successfully created "avatars" bucket!');
    console.log('   Bucket ID:', data.id);
    console.log('   Public:', data.public);
    console.log('\n📝 Next steps:');
    console.log('   1. Run the RLS policy script: fix_user_profiles_rls.sql');
    console.log('   2. Test avatar upload in the Settings page');
    
  } catch (error) {
    console.error('\n❌ Failed to create bucket:', error.message);
    console.error('\n💡 Alternative: Create the bucket manually in Supabase Dashboard:');
    console.error('   1. Go to Storage in your Supabase Dashboard');
    console.error('   2. Click "New bucket"');
    console.error('   3. Name: "avatars"');
    console.error('   4. Make it public: ✅');
    console.error('   5. Click "Create bucket"');
    console.error('   6. Then run: fix_user_profiles_rls.sql');
    process.exit(1);
  }
}

// Run the script
createAvatarsBucket()
  .then(() => {
    console.log('\n✨ Setup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Unexpected error:', error);
    process.exit(1);
  });

