// Script to fix access_requests RLS policies
// Run this with: node run_access_requests_fix.js

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load Supabase configuration
const SUPABASE_CONFIG = require('./supabase-config.js');

// Create Supabase client with service role key (has admin privileges)
const supabase = createClient(
  SUPABASE_CONFIG.SUPABASE_URL,
  SUPABASE_CONFIG.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function fixAccessRequestsPolicies() {
  console.log('🔧 Starting access_requests RLS policy fix...\n');

  try {
    // Read the SQL fix script
    const sqlFilePath = path.join(__dirname, 'fix_access_requests_rls_complete.sql');
    const sqlScript = fs.readFileSync(sqlFilePath, 'utf8');

    console.log('📄 Loaded SQL script from:', sqlFilePath);
    console.log('📡 Connecting to Supabase...\n');

    // Execute the SQL script
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sqlScript });

    if (error) {
      // If exec_sql function doesn't exist, we need to run the script differently
      console.log('⚠️  exec_sql function not found. Running queries individually...\n');
      
      // Split the script into individual statements and run them
      // For now, we'll instruct the user to run it via Supabase dashboard
      console.log('❌ Cannot execute SQL script programmatically.');
      console.log('📋 Please run the SQL script manually:\n');
      console.log('1. Go to: https://supabase.com/dashboard');
      console.log('2. Select your project');
      console.log('3. Open SQL Editor');
      console.log('4. Copy and paste the contents of: fix_access_requests_rls_complete.sql');
      console.log('5. Click "Run"\n');
      return;
    }

    console.log('✅ RLS policies fixed successfully!');
    console.log('📊 Result:', data);

    // Verify the policies were created
    console.log('\n🔍 Verifying policies...');
    const { data: policies, error: policiesError } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'access_requests');

    if (policiesError) {
      console.error('⚠️  Could not verify policies:', policiesError.message);
    } else {
      console.log('\n📋 Current policies on access_requests table:');
      policies.forEach(policy => {
        console.log(`  - ${policy.policyname} (${policy.cmd})`);
      });
    }

    console.log('\n✨ All done! You should now be able to submit access requests.\n');

  } catch (err) {
    console.error('❌ Error running fix script:', err.message);
    console.error(err);
    
    console.log('\n📋 Manual fix required:');
    console.log('1. Go to: https://supabase.com/dashboard');
    console.log('2. Select your project (bviglsgfbwjhioeyhnin)');
    console.log('3. Open SQL Editor');
    console.log('4. Copy and paste the contents of: fix_access_requests_rls_complete.sql');
    console.log('5. Click "Run"\n');
  }
}

// Run the fix
fixAccessRequestsPolicies();
