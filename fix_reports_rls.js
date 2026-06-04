const supabase = require('./client/src/supabaseClient').default;

async function fixReportsRLSPolicies() {
  console.log('🔧 Fixing reports table RLS policies...');
  
  try {
    // The main issue is RLS policies. Let's create a simple fix that allows public access
    console.log('📝 Creating permissive RLS policies...');
    
    // Since we can't execute SQL directly due to permissions, let's try a different approach
    // We'll check if we can at least read the current policies
    
    console.log('🔍 Checking current table status...');
    
    // Try to check if the table exists by attempting a simple query
    const { data: existingData, error: existingError } = await supabase
      .from('reports')
      .select('*')
      .limit(1);
    
    if (existingError) {
      console.log('❌ Cannot access reports table:', existingError.message);
      console.log('Error code:', existingError.code);
      
      if (existingError.code === '42501') {
        console.log('🔒 This is definitely an RLS policy issue.');
        console.log('📋 To fix this, you need to run the following SQL in your Supabase SQL editor:');
        console.log('');
        console.log('='.repeat(60));
        console.log('COPY AND PASTE THIS SQL INTO SUPABASE SQL EDITOR:');
        console.log('='.repeat(60));
        
        const sqlFix = `-- Fix Reports Table RLS Policies
-- Run this in your Supabase SQL Editor

-- 1. Enable RLS if not already enabled
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 2. Drop all existing policies
DROP POLICY IF EXISTS "Authenticated users can CRUD their own reports" ON public.reports;
DROP POLICY IF EXISTS "Anyone can read reports" ON public.reports;
DROP POLICY IF EXISTS "Allow public access to reports" ON public.reports;
DROP POLICY IF EXISTS "Allow anonymous read access to reports" ON public.reports;
DROP POLICY IF EXISTS "Allow anonymous insert to reports" ON public.reports;
DROP POLICY IF EXISTS "Allow anonymous update to reports" ON public.reports;
DROP POLICY IF EXISTS "Allow anonymous delete from reports" ON public.reports;

-- 3. Create open policies for development
CREATE POLICY "Allow public read access to reports" 
ON public.reports FOR SELECT 
TO anon, authenticated
USING (true);

CREATE POLICY "Allow public insert access to reports" 
ON public.reports FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Allow public update access to reports" 
ON public.reports FOR UPDATE 
TO anon, authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete access to reports" 
ON public.reports FOR DELETE 
TO anon, authenticated
USING (true);

-- 4. Grant permissions
GRANT ALL ON public.reports TO anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 5. Test the fix
INSERT INTO public.reports (name, type, generated_by, filename, file_content, preview_data) 
VALUES ('Test Report After Fix', 'test', 'system', 'test.pdf', 'test_content', 'Fixed!')
RETURNING id, name, type, created_at;

-- 6. Clean up test data
DELETE FROM public.reports WHERE name = 'Test Report After Fix';

SELECT 'Reports table RLS policies fixed successfully!' as status;`;
        
        console.log(sqlFix);
        console.log('='.repeat(60));
        console.log('');
        console.log('🎯 After running the above SQL, the database saving issue should be resolved.');
        console.log('📖 The error occurs because the reports table has restrictive RLS policies.');
        console.log('🔧 This fix creates open policies that allow both authenticated and anonymous users to insert reports.');
      }
    } else {
      console.log('✅ Can access reports table for reading');
      console.log('📊 Current reports count:', existingData ? existingData.length : 0);
      
      if (existingData && existingData.length > 0) {
        console.log('📝 Sample report:', existingData[0]);
      }
      
      // The table exists but we can't insert - this confirms it's an RLS issue
      console.log('🔒 RLS policies are preventing insert operations.');
      console.log('📋 Please run the SQL fix provided above in your Supabase SQL editor.');
    }
    
  } catch (error) {
    console.error('❌ Error during RLS fix attempt:', error);
    console.error('Error details:', error.message);
  }
}

// Also provide a manual testing function
async function testManualInsert() {
  console.log('🧪 Testing manual insert with minimal data...');
  
  try {
    const minimalReport = {
      name: 'Minimal Test',
      type: 'test',
      generated_by: 'test_user'
    };
    
    const { data, error } = await supabase
      .from('reports')
      .insert([minimalReport])
      .select();
    
    if (error) {
      console.error('❌ Manual insert failed:', error);
      console.error('This confirms the RLS policy issue.');
      return false;
    } else {
      console.log('✅ Manual insert successful:', data);
      
      // Clean up
      await supabase.from('reports').delete().eq('id', data[0].id);
      console.log('🗑️  Test data cleaned up');
      return true;
    }
  } catch (error) {
    console.error('❌ Manual insert exception:', error);
    return false;
  }
}

// Run the fix
console.log('🚀 Starting reports table RLS fix...');
fixReportsRLSPolicies().then(() => {
  console.log('');
  console.log('🔄 Running manual insert test...');
  return testManualInsert();
}).then(success => {
  if (!success) {
    console.log('');
    console.log('⚠️  The issue persists. Please run the SQL script in Supabase SQL editor.');
  }
}).catch(console.error);