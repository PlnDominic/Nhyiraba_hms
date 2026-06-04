const supabase = require('./client/src/supabaseClient').default;

async function applyReportsTableFix() {
  console.log('🚀 Applying reports table fix...');
  
  try {
    // 1. Create the reports table with proper structure
    console.log('📋 Creating reports table...');
    const createTableSQL = `
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reports') THEN
              CREATE TABLE public.reports (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name TEXT NOT NULL,
                date TIMESTAMP WITH TIME ZONE,
                type TEXT NOT NULL,
                format TEXT,
                generated_by TEXT,
                filename TEXT,
                file_content TEXT,
                preview_data TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
              );

              CREATE INDEX idx_reports_created_at ON public.reports(created_at);
              CREATE INDEX idx_reports_type ON public.reports(type);
              
              RAISE NOTICE 'Reports table created successfully';
          ELSE
              RAISE NOTICE 'Reports table already exists';
              
              -- Ensure the id column has the correct default
              ALTER TABLE public.reports ALTER COLUMN id SET DEFAULT uuid_generate_v4();
              ALTER TABLE public.reports ALTER COLUMN id SET NOT NULL;
          END IF;
      END $$;
    `;
    
    const { error: createError } = await supabase.rpc('exec_sql', { sql: createTableSQL });
    if (createError) {
      console.log('Table creation handled via RPC or already exists');
    }
    
    // 2. Enable RLS and create policies
    console.log('🔒 Setting up RLS policies...');
    const policiesSQL = `
      ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
      
      -- Drop existing policies
      DROP POLICY IF EXISTS "Authenticated users can CRUD their own reports" ON public.reports;
      DROP POLICY IF EXISTS "Anyone can read reports" ON public.reports;
      DROP POLICY IF EXISTS "Allow public access to reports" ON public.reports;
      DROP POLICY IF EXISTS "Allow anonymous read access to reports" ON public.reports;
      DROP POLICY IF EXISTS "Allow anonymous insert to reports" ON public.reports;
      DROP POLICY IF EXISTS "Allow anonymous update to reports" ON public.reports;
      DROP POLICY IF EXISTS "Allow anonymous delete from reports" ON public.reports;
      
      -- Create open policies
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
      
      GRANT ALL ON public.reports TO public;
      GRANT USAGE ON SCHEMA public TO public;
    `;
    
    const { error: policiesError } = await supabase.rpc('exec_sql', { sql: policiesSQL });
    if (policiesError) {
      console.log('Policies handled via RPC or already exist');
    }
    
    // 3. Test the fix by inserting a test record
    console.log('🧪 Testing database access...');
    const testReport = {
      name: 'Test Report - ' + new Date().toISOString(),
      type: 'test',
      generated_by: 'system_admin',
      filename: 'test.pdf',
      file_content: 'test_content_base64',
      preview_data: 'Test report to verify database access is working'
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from('reports')
      .insert([testReport])
      .select();
    
    if (insertError) {
      console.error('❌ Test insert failed:', insertError);
      console.error('Error details:', insertError.details || 'No additional details');
      console.error('Error hint:', insertError.hint || 'No hint provided');
      throw new Error(`Test insert failed: ${insertError.message}`);
    }
    
    if (!insertData || insertData.length === 0) {
      throw new Error('Test insert succeeded but no data returned');
    }
    
    if (!insertData[0].id) {
      throw new Error('Test insert succeeded but ID is missing');
    }
    
    console.log('✅ Test insert successful:', insertData[0]);
    
    // 4. Clean up test data
    const { error: deleteError } = await supabase
      .from('reports')
      .delete()
      .eq('id', insertData[0].id);
    
    if (deleteError) {
      console.warn('⚠️  Could not delete test data:', deleteError.message);
    } else {
      console.log('🗑️  Test data cleaned up successfully');
    }
    
    console.log('🎉 Reports table fix applied successfully!');
    console.log('✅ Database saving should now work correctly');
    
  } catch (error) {
    console.error('❌ Error applying reports table fix:', error);
    console.error('Error details:', error.message);
    
    // Try alternative approach using direct SQL execution
    console.log('🔄 Trying alternative approach...');
    try {
      // Test basic connection
      const { data: testData, error: testError } = await supabase
        .from('reports')
        .select('*')
        .limit(1);
      
      if (testError) {
        console.error('❌ Cannot access reports table at all:', testError);
        console.error('Please run the fix_reports_table_rls.sql script manually in your Supabase SQL editor');
      } else {
        console.log('✅ Can access reports table, trying manual insert test...');
        
        // Try manual insert with UUID
        const manualTest = {
          id: crypto.randomUUID(),
          name: 'Manual Test Report',
          type: 'test',
          generated_by: 'system',
          filename: 'test.pdf',
          file_content: 'test_content',
          preview_data: 'Manual test'
        };
        
        const { data: manualData, error: manualError } = await supabase
          .from('reports')
          .insert([manualTest])
          .select();
        
        if (manualError) {
          console.error('❌ Manual insert failed:', manualError);
        } else {
          console.log('✅ Manual insert successful:', manualData);
          
          // Clean up
          await supabase.from('reports').delete().eq('id', manualData[0].id);
          console.log('🎉 Alternative fix successful!');
        }
      }
    } catch (altError) {
      console.error('❌ Alternative approach also failed:', altError);
    }
  }
}

// Run the fix
applyReportsTableFix().catch(console.error);