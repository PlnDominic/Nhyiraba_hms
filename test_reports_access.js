// Test script to verify reports table access and UUID generation
// Run this in your browser console after applying the RLS fix

// Test function to check reports table access
async function testReportsAccess() {
  console.log('🧪 Testing reports table access...');
  
  try {
    // Test 1: Check if we can read from the table
    console.log('📖 Testing SELECT access...');
    const { data: readData, error: readError } = await supabase
      .from('reports')
      .select('*')
      .limit(1);
    
    if (readError) {
      console.error('❌ SELECT failed:', readError);
      return false;
    }
    console.log('✅ SELECT successful:', readData);
    
    // Test 2: Check if we can insert into the table (without specifying ID)
    console.log('📝 Testing INSERT access (auto-generated UUID)...');
    const testReport = {
      name: 'Test Report - ' + new Date().toISOString(),
      type: 'test',
      generated_by: 'test_user',
      filename: 'test.pdf',
      file_content: 'test_content',
      preview_data: 'test_preview'
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from('reports')
      .insert([testReport])
      .select();
    
    if (insertError) {
      console.error('❌ INSERT failed:', insertError);
      console.error('Error details:', insertError.details || 'No additional details');
      console.error('Error hint:', insertError.hint || 'No hint provided');
      return false;
    }
    
    if (!insertData || insertData.length === 0) {
      console.error('❌ INSERT succeeded but no data returned');
      return false;
    }
    
    if (!insertData[0].id) {
      console.error('❌ INSERT succeeded but ID is missing:', insertData[0]);
      return false;
    }
    
    console.log('✅ INSERT successful with auto-generated UUID:', insertData[0].id);
    
    // Test 3: Check if we can update the table
    console.log('✏️ Testing UPDATE access...');
    const reportId = insertData[0].id;
    const { data: updateData, error: updateError } = await supabase
      .from('reports')
      .update({ name: 'Updated Test Report' })
      .eq('id', reportId)
      .select();
    
    if (updateError) {
      console.error('❌ UPDATE failed:', updateError);
      return false;
    }
    console.log('✅ UPDATE successful:', updateData);
    
    // Test 4: Check if we can delete from the table
    console.log('🗑️ Testing DELETE access...');
    const { error: deleteError } = await supabase
      .from('reports')
      .delete()
      .eq('id', reportId);
    
    if (deleteError) {
      console.error('❌ DELETE failed:', deleteError);
      return false;
    }
    console.log('✅ DELETE successful');
    
    console.log('🎉 All tests passed! Reports table is fully accessible with proper UUID generation.');
    return true;
    
  } catch (error) {
    console.error('💥 Test failed with unexpected error:', error);
    return false;
  }
}

// Test function to check current user authentication
async function checkUserAuth() {
  console.log('🔐 Checking user authentication status...');
  
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('❌ Error getting session:', error);
      return false;
    }
    
    if (session) {
      console.log('✅ User is authenticated:', {
        userId: session.user.id,
        email: session.user.email,
        role: session.user.role
      });
      return true;
    } else {
      console.log('⚠️ No active session found - user is anonymous');
      return false;
    }
  } catch (error) {
    console.error('💥 Error checking authentication:', error);
    return false;
  }
}

// Test function to specifically test UUID generation
async function testUUIDGeneration() {
  console.log('🔑 Testing UUID generation specifically...');
  
  try {
    // Test 1: Try to insert with explicit UUID
    console.log('📝 Testing INSERT with explicit UUID...');
    const testUUID = crypto.randomUUID(); // Generate UUID in browser
    const testReport = {
      id: testUUID,
      name: 'Test Report with Explicit UUID',
      type: 'test',
      generated_by: 'test_user',
      filename: 'test.pdf',
      file_content: 'test_content',
      preview_data: 'test_preview'
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from('reports')
      .insert([testReport])
      .select();
    
    if (insertError) {
      console.error('❌ INSERT with explicit UUID failed:', insertError);
      return false;
    }
    
    console.log('✅ INSERT with explicit UUID successful:', insertData[0].id);
    
    // Test 2: Try to insert without specifying ID (should auto-generate)
    console.log('📝 Testing INSERT without ID (auto-generation)...');
    const autoGenReport = {
      name: 'Test Report - Auto Generated UUID',
      type: 'test',
      generated_by: 'test_user',
      filename: 'test.pdf',
      file_content: 'test_content',
      preview_data: 'test_preview'
    };
    
    const { data: autoGenData, error: autoGenError } = await supabase
      .from('reports')
      .insert([autoGenReport])
      .select();
    
    if (autoGenError) {
      console.error('❌ Auto-generated UUID INSERT failed:', autoGenError);
      return false;
    }
    
    if (!autoGenData[0].id) {
      console.error('❌ Auto-generated UUID INSERT succeeded but no ID returned');
      return false;
    }
    
    console.log('✅ Auto-generated UUID INSERT successful:', autoGenData[0].id);
    
    // Clean up both test records
    await supabase.from('reports').delete().eq('id', testUUID);
    await supabase.from('reports').delete().eq('id', autoGenData[0].id);
    
    console.log('🎉 UUID generation tests passed!');
    return true;
    
  } catch (error) {
    console.error('💥 UUID generation test failed:', error);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting comprehensive reports table access tests...\n');
  
  // Check authentication first
  const isAuthenticated = await checkUserAuth();
  console.log('');
  
  // Test UUID generation specifically
  const uuidWorking = await testUUIDGeneration();
  console.log('');
  
  // Test general table access
  const tableAccessible = await testReportsAccess();
  console.log('');
  
  // Summary
  console.log('📊 Test Summary:');
  console.log(`   Authentication: ${isAuthenticated ? '✅ Authenticated' : '⚠️ Anonymous'}`);
  console.log(`   UUID Generation: ${uuidWorking ? '✅ Working' : '❌ Failed'}`);
  console.log(`   Table Access: ${tableAccessible ? '✅ Full Access' : '❌ Access Denied'}`);
  
  if (uuidWorking && tableAccessible) {
    console.log('\n🎯 Both the UUID issue and 403 error should now be resolved!');
    console.log('   Try generating and saving a report in your application.');
  } else if (!uuidWorking) {
    console.log('\n❌ UUID generation is still not working.');
    console.log('   Run the fix_reports_uuid_issue.sql script in Supabase SQL Editor.');
  } else {
    console.log('\n❌ There are still issues with table access.');
    console.log('   Check the error messages above and ensure the RLS fix script was run correctly.');
  }
}

// Export functions for manual testing
window.testReportsAccess = testReportsAccess;
window.checkUserAuth = checkUserAuth;
window.testUUIDGeneration = testUUIDGeneration;
window.runAllTests = runAllTests;

// Auto-run tests if this script is loaded
console.log('🧪 Reports table test script loaded. Run runAllTests() to test access and UUID generation.');
console.log('   Or run individual tests: testReportsAccess(), checkUserAuth(), testUUIDGeneration()');
