import supabase from '../supabaseClient';

/**
 * Check if a user with the given email already exists
 * @param {string} email - The email to check
 * @returns {Promise<boolean>} - True if user exists, false otherwise
 */
export const checkUserExists = async (email) => {
  try {
    console.log(`Checking if user with email ${email} already exists...`);

    // First try the most reliable method - check the user_profiles table
    // We're storing email in profiles, so this should work most of the time
    console.log('Checking user_profiles table first...');
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select('user_id, email')
      .eq('email', email)
      .maybeSingle();

    if (profileError) {
      console.warn('Error checking user_profiles table:', profileError);
    } else if (profileData) {
      console.log('User found in user_profiles table:', profileData);
      return true;
    }

    // Try the Supabase auth API (this might not have the required permissions)
    try {
      console.log('Trying Supabase auth admin API...');
      const { data, error } = await supabase.auth.admin.getUserByEmail(email);

      if (error) {
        console.warn('Error using admin API:', error);
      } else if (data && data.user) {
        console.log('User found via admin API:', data.user.id);
        return true;
      }
    } catch (err) {
      console.warn('Admin API not available:', err);
    }

    // Try a sign-in attempt that doesn't create a user
    try {
      console.log('Trying sign-in attempt...');
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          shouldCreateUser: false
        }
      });

      // If we get a "User not found" error, then the user doesn't exist
      // If we get any other error, it's likely the user exists
      if (signInError) {
        if (signInError.message.includes('User not found')) {
          console.log('User not found via sign-in attempt');
          return false;
        } else {
          // Other errors might indicate user exists but something else went wrong
          console.log('Sign-in error, user might exist:', signInError);
        }
      } else {
        // If no error, user exists and OTP was sent
        console.log('OTP sent, user exists');
        return true;
      }
    } catch (err) {
      console.warn('Sign-in attempt failed:', err);
    }

    // If we've tried everything and haven't returned, assume user does not exist
    console.log('All checks completed, assuming user does not exist');
    return false;
  } catch (error) {
    console.error('Error checking if user exists:', error);
    // In case of error, return false to allow the attempt to create
    // but log a clear message
    console.warn('Due to error, defaulting to assume user does not exist');
    return false;
  }
};

/**
 * Create a new user account with profile
 * @param {Object} userData - The user data containing email, password, role, etc.
 * @returns {Promise<Object>} - The created user data or error
 */
export const createUserAccount = async (userData) => {
  try {
    console.log('Starting createUserAccount for email:', userData.email);

    // First check if user already exists
    const userExists = await checkUserExists(userData.email);
    if (userExists) {
      console.log('User already exists, returning error code');
      return {
        success: false,
        error: 'User already registered',
        code: 'USER_ALREADY_EXISTS',
        message: `A user with email ${userData.email} is already registered in the system.`
      };
    }

    console.log('User does not exist, proceeding with account creation');

    // Step 1: Create auth user via signUp
    console.log('Step 1: Creating auth user via signUp');
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: {
          full_name: userData.fullName,
          role: userData.role
        }
      }
    });

    if (authError) {
      console.error('Error creating auth user:', authError);

      // Check if error indicates user already exists
      if (authError.message.includes('already registered')) {
        return {
          success: false,
          error: 'User already registered',
          code: 'USER_ALREADY_EXISTS',
          message: `A user with email ${userData.email} is already registered in the system.`
        };
      }

      throw authError;
    }

    console.log('Auth user created successfully:', authData.user.id);

    // Step 2: Create the user profile
    console.log('Step 2: Creating user profile');
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .insert([
        {
          user_id: authData.user.id,
          full_name: userData.fullName,
          role: userData.role,
          position: userData.position,
          department: userData.department,
          contact_number: userData.contactNumber,
          password_change_required: true,
          email: userData.email // Store email in profile for easier queries
        }
      ])
      .select('*')
      .single();

    if (profileError) {
      console.error("Error creating user profile:", profileError);

      // Check if profile already exists (unique constraint violation)
      if (profileError.code === '23505') { // PostgreSQL unique constraint violation
        console.log('Profile already exists, returning USER_ALREADY_EXISTS');
        return {
          success: false,
          error: 'User already registered',
          code: 'USER_ALREADY_EXISTS',
          message: `A profile for user ${userData.email} already exists.`
        };
      }

      throw profileError;
    }

    console.log('User profile created successfully');

    // Passwords are never stored by the app. The temporary password is emailed once and
    // the user must replace it at first sign-in (password_change_required).

    // Step 3: Save explicit permissions to user_permissions table
    console.log('Step 3: Saving explicit user permissions');
    if (userData.permissions && userData.permissions.length > 0) {
      try {
        // First, get permission IDs from permission names
        const { data: permissionsData, error: permError } = await supabase
          .from('permissions')
          .select('id, name')
          .in('name', userData.permissions);

        if (permError) {
          console.warn("Warning: Could not fetch permissions:", permError);
        } else if (permissionsData && permissionsData.length > 0) {
          // Insert permissions into user_permissions table
          const permissionInserts = permissionsData.map(perm => ({
            user_id: authData.user.id,
            permission_id: perm.id
          }));

          const { error: userPermError } = await supabase
            .from('user_permissions')
            .insert(permissionInserts);

          if (userPermError) {
            console.warn("Warning: Could not insert user permissions:", userPermError);
          } else {
            console.log(`Successfully saved ${permissionInserts.length} permissions for user`);
          }
        }
      } catch (permErr) {
        console.warn("Warning: Error processing permissions:", permErr);
        // Don't throw - continue even if permissions fail
      }
    } else {
      console.log("No permissions specified, skipping permission assignment");
    }

    console.log('User account creation completed successfully');
    return {
      success: true,
      user: {
        ...authData.user,
        profile: profileData
      },
      message: `User account for ${userData.email} created successfully`
    };
  } catch (error) {
    console.error('Error creating user account:', error);

    // Check for common error patterns
    if (error.message && error.message.includes('already registered')) {
      return {
        success: false,
        error: 'User already registered',
        code: 'USER_ALREADY_EXISTS',
        message: `A user with email ${userData.email} is already registered.`
      };
    }

    return {
      success: false,
      error: error.message || 'Failed to create user account',
      code: error.code || 'UNKNOWN_ERROR'
    };
  }
};

/**
 * Get all users with their profiles
 * @returns {Promise<Array>} - List of users or error
 */
export const getAllUsers = async () => {
  try {
    // Step 1: Get user profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesError) throw profilesError;

    if (!profiles || profiles.length === 0) {
      return {
        success: true,
        data: []
      };
    }

    // Step 2: Get all user permissions
    // Get user IDs from profiles
    const userIds = profiles.map(p => p.user_id);

    // Fetch user_permissions for these users (just the IDs, no nested query)
    const { data: userPermissions, error: userPermError } = await supabase
      .from('user_permissions')
      .select('user_id, permission_id')
      .in('user_id', userIds);

    if (userPermError) {
      console.warn('Error fetching user permissions:', userPermError);
      // Continue even if permissions fetch fails - users will just have empty permissions
    }

    // Step 3: Get all permissions to map IDs to names
    const { data: allPermissions, error: permError } = await supabase
      .from('permissions')
      .select('id, name, description');

    if (permError) {
      console.warn('Error fetching permissions:', permError);
    }

    // Step 4: Create a map of permission_id -> permission name
    const permissionIdToName = {};
    if (allPermissions) {
      allPermissions.forEach(perm => {
        permissionIdToName[perm.id] = perm.name;
      });
    }

    // Step 5: Create a map of user_id -> permissions array (names)
    const permissionsMap = {};
    if (userPermissions) {
      userPermissions.forEach(up => {
        if (!permissionsMap[up.user_id]) {
          permissionsMap[up.user_id] = [];
        }
        const permissionName = permissionIdToName[up.permission_id];
        if (permissionName) {
          permissionsMap[up.user_id].push(permissionName);
        }
      });
    }

    // Step 6: Merge profiles with permissions
    // Note: Email may or may not be in user_profiles table depending on schema
    const usersWithPermissions = profiles.map(profile => ({
      ...profile,
      permissions: permissionsMap[profile.user_id] || []
    }));

    return {
      success: true,
      data: usersWithPermissions
    };
  } catch (error) {
    console.error('Error getting users:', error);
    return {
      success: false,
      error: error.message || 'Failed to get users'
    };
  }
};

/**
 * Update user profile
 * @param {string} userId - The user ID
 * @param {Object} profileData - The profile data to update
 * @returns {Promise<Object>} - The updated profile or error
 */
export const updateUserProfile = async (userId, profileData) => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        ...profileData,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select('*');

    if (error) throw error;

    // Check if any rows were updated
    if (!data || data.length === 0) {
      throw new Error('No profile found to update. You may not have permission to update this user or the user does not exist.');
    }

    return {
      success: true,
      data: data[0]
    };
  } catch (error) {
    console.error('Error updating user profile:', error);
    return {
      success: false,
      error: error.message || 'Failed to update user profile'
    };
  }
};

/**
 * Update user permissions
 * @param {string} userId - The user ID
 * @param {Array<string>} permissionNames - Array of permission names to assign
 * @returns {Promise<Object>} - Success status or error
 */
export const updateUserPermissions = async (userId, permissionNames) => {
  try {
    // Step 1: Get permission IDs from permission names
    const { data: permissionsData, error: permError } = await supabase
      .from('permissions')
      .select('id, name')
      .in('name', permissionNames);

    if (permError) throw permError;

    if (!permissionsData || permissionsData.length === 0) {
      // If no permissions found, just clear all permissions for this user
      const { error: deleteError } = await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      return {
        success: true,
        message: 'User permissions cleared'
      };
    }

    // Step 2: Delete existing permissions for this user
    const { error: deleteError } = await supabase
      .from('user_permissions')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.warn('Warning: Could not delete existing permissions:', deleteError);
      // Continue anyway - we'll use upsert below
    }

    // Step 3: Insert new permissions
    const permissionInserts = permissionsData.map(perm => ({
      user_id: userId,
      permission_id: perm.id
    }));

    if (permissionInserts.length > 0) {
      const { error: insertError } = await supabase
        .from('user_permissions')
        .insert(permissionInserts);

      if (insertError) throw insertError;
    }

    return {
      success: true,
      message: `Updated ${permissionInserts.length} permissions for user`
    };
  } catch (error) {
    console.error('Error updating user permissions:', error);
    return {
      success: false,
      error: error.message || 'Failed to update user permissions'
    };
  }
};

/**
 * Update user profile and permissions
 * @param {string} userId - The user ID
 * @param {Object} profileData - The profile data to update
 * @param {Array<string>} permissions - Array of permission names to assign
 * @returns {Promise<Object>} - Success status or error
 */
export const updateUser = async (userId, profileData, permissions = null) => {
  try {
    // Update profile
    const profileResult = await updateUserProfile(userId, profileData);
    if (!profileResult.success) {
      return profileResult;
    }

    // Update permissions if provided
    if (permissions !== null) {
      const permResult = await updateUserPermissions(userId, permissions);
      if (!permResult.success) {
        console.warn('Warning: Profile updated but permissions update failed:', permResult.error);
        // Return success for profile update, but note the permission issue
        return {
          success: true,
          warning: permResult.error,
          data: profileResult.data
        };
      }
    }

    return {
      success: true,
      data: profileResult.data
    };
  } catch (error) {
    console.error('Error updating user:', error);
    return {
      success: false,
      error: error.message || 'Failed to update user'
    };
  }
};

/**
 * Delete a user account
 * @param {string} userId - The user ID to delete
 * @returns {Promise<Object>} - Success status or error
 */
export const deleteUserAccount = async (userId) => {
  try {
    // First mark the user profile as inactive instead of trying to delete auth user
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ active: false })
      .eq('user_id', userId);

    if (updateError) throw updateError;

    return {
      success: true
    };
  } catch (error) {
    console.error('Error deactivating user account:', error);
    return {
      success: false,
      error: error.message || 'Failed to deactivate user account'
    };
  }
};
