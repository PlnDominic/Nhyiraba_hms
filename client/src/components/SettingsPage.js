import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBell,
  faCamera,
  faLock,
  faUser,
  faGlobe,
  faSave,
  faEye,
  faEyeSlash,
  faCheckCircle,
  faTimesCircle,
  faSpinner
} from '@fortawesome/free-solid-svg-icons';
import DashboardLayout from './DashboardLayout';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import supabase from '../supabaseClient';
import { syncRoomStatus } from '../utils/DataSync';

const SettingsPage = () => {
  const { theme, toggleTheme } = useTheme();
  const { user, setCurrentUser } = useUser();
  const isDarkMode = theme === 'dark';

  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [previewUrl, setPreviewUrl] = useState('');
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [isSyncing, setIsSyncing] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: '',
    avatar: null,
    language: 'English',
    timezone: 'GMT+0',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12-hour',
    currency: 'GHS',
    theme: 'light',
    notifications: {
      email: true,
      sms: false,
      browser: true,
      app: true
    },
    security: {
      twoFactor: false,
      sessionTimeout: '30 minutes',
      changePassword: false,
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    }
  });

  // Load user data and settings when component mounts
  useEffect(() => {
    loadUserData();
    loadUserSettings();
  }, [user]);

  const loadUserData = async () => {
    if (!user) return;

    try {
      // Split full name into first and last name
      const nameParts = user.fullName ? user.fullName.split(' ') : ['', ''];
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      setFormData(prev => ({
        ...prev,
        firstName,
        lastName,
        email: user.email || '',
        phone: user.contactNumber || '',
        role: user.role || '',
      }));

      if (user.avatar_url) {
        setPreviewUrl(user.avatar_url);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadUserSettings = async () => {
    if (!user?.id) {
      setIsLoadingSettings(false);
      return;
    }

    try {
      // Get or create user settings
      let { data: settings, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        // If settings don't exist (PGRST116 = no rows returned), create default ones
        if (error.code === 'PGRST116') {
          await createDefaultSettings();
          // Reload settings after creating defaults
          const { data: newSettings } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', user.id)
            .single();
          if (newSettings) {
            settings = newSettings;
          }
        } else {
          console.error('Error loading settings:', error);
        }
      }

      if (settings) {
        // Load settings into form
        setFormData(prev => ({
          ...prev,
          language: settings.language || 'English',
          timezone: settings.timezone || 'GMT+0',
          dateFormat: settings.date_format || 'MM/DD/YYYY', // Map date_format to dateFormat
          timeFormat: settings.time_format || '12-hour', // Map time_format to timeFormat
          currency: settings.currency || 'GHS',
          theme: settings.theme || 'light',
          notifications: settings.notifications || {
            email: true,
            sms: false,
            browser: true,
            app: true
          },
          security: {
            ...prev.security,
            twoFactor: settings.two_factor_enabled || false,
            sessionTimeout: settings.session_timeout || '30 minutes'
          }
        }));

        // Apply theme if different
        if (settings.theme && settings.theme !== theme) {
          // Theme will be applied via the toggle if needed
        }
      }
    } catch (error) {
      console.error('Error loading user settings:', error);
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const createDefaultSettings = async () => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('user_settings')
        .insert({
          user_id: user.id,
          language: 'English',
          timezone: 'GMT+0',
          date_format: 'MM/DD/YYYY',
          time_format: '12-hour',
          currency: 'GHS',
          theme: 'light',
          notifications: {
            email: true,
            sms: false,
            browser: true,
            app: true
          },
          two_factor_enabled: false,
          session_timeout: '30 minutes'
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error creating default settings:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name.includes('.')) {
      const [section, field] = name.split('.');
      setFormData({
        ...formData,
        [section]: {
          ...formData[section],
          [field]: type === 'checkbox' ? checked : value
        }
      });
    } else {
      setFormData({
        ...formData,
        [name]: type === 'checkbox' ? checked : value
      });
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setMessage({ type: 'error', text: 'Please select an image file' });
        return;
      }

      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'Image size must be less than 5MB' });
        return;
      }

      setFormData({ ...formData, avatar: file });
      // Create a preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
      setMessage({ type: '', text: '' });
    }
  };

  const saveProfile = async () => {
    if (!user || !user.id) {
      setMessage({ type: 'error', text: 'User not authenticated' });
      return;
    }

    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const fullName = `${formData.firstName} ${formData.lastName}`.trim();
      const userId = user.id;

      // Update user profile in the database
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          full_name: fullName,
          contact_number: formData.phone,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (profileError) {
        throw profileError;
      }

      // Handle avatar upload if provided
      let avatarUrl = user.avatar_url;
      if (formData.avatar) {
        const fileName = `avatar-${userId}-${Date.now()}.${formData.avatar.name.split('.').pop()}`;
        const filePath = `public/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, formData.avatar, {
            upsert: true,
            cacheControl: '3600',
            contentType: formData.avatar.type
          });

        if (uploadError) {
          if (uploadError.message.includes('Bucket not found')) {
            throw new Error('Storage bucket "avatars" not found. Please contact an administrator to set up storage.');
          } else if (uploadError.message.includes('row-level security')) {
            throw new Error('Upload denied by security policy. Please run setup_storage_bucket.sql to configure permissions.');
          } else {
            throw new Error(`Upload failed: ${uploadError.message}`);
          }
        }

        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        if (urlData) {
          avatarUrl = urlData.publicUrl;

          const { error: avatarUpdateError } = await supabase
            .from('user_profiles')
            .update({ avatar_url: avatarUrl })
            .eq('user_id', userId);

          if (avatarUpdateError) {
            throw avatarUpdateError;
          }
        }
      }

      // Update user in context
      setCurrentUser({
        ...user,
        fullName,
        contactNumber: formData.phone,
        avatar_url: avatarUrl
      });

      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: error.message || 'Error updating profile' });
    } finally {
      setIsLoading(false);
    }
  };

  const savePreferences = async () => {
    if (!user?.id) {
      setMessage({ type: 'error', text: 'User not authenticated' });
      return;
    }

    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Apply theme if changed
      if (formData.theme !== theme) {
        if (formData.theme === 'dark' && theme === 'light') {
          toggleTheme();
        } else if (formData.theme === 'light' && theme === 'dark') {
          toggleTheme();
        }
      }

      // Upsert user settings (map camelCase to snake_case for database)
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          language: formData.language,
          timezone: formData.timezone,
          date_format: formData.dateFormat, // Map dateFormat to date_format
          time_format: formData.timeFormat, // Map timeFormat to time_format
          currency: formData.currency,
          theme: formData.theme,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Preferences saved successfully!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Error saving preferences:', error);
      setMessage({ type: 'error', text: error.message || 'Error saving preferences' });
    } finally {
      setIsLoading(false);
    }
  };

  const saveNotifications = async () => {
    if (!user?.id) {
      setMessage({ type: 'error', text: 'User not authenticated' });
      return;
    }

    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          notifications: formData.notifications,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Notification settings saved successfully!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Error saving notifications:', error);
      setMessage({ type: 'error', text: error.message || 'Error saving notification settings' });
    } finally {
      setIsLoading(false);
    }
  };

  const saveSecuritySettings = async () => {
    if (!user?.id) {
      setMessage({ type: 'error', text: 'User not authenticated' });
      return;
    }

    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Update security settings in user_settings table
      const { error: settingsError } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          two_factor_enabled: formData.security.twoFactor,
          session_timeout: formData.security.sessionTimeout,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (settingsError) throw settingsError;

      setMessage({ type: 'success', text: 'Security settings saved successfully!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Error saving security settings:', error);
      setMessage({ type: 'error', text: error.message || 'Error saving security settings' });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();

    if (!user?.id) {
      setMessage({ type: 'error', text: 'User not authenticated' });
      return;
    }

    // Validate passwords
    if (formData.security.newPassword !== formData.security.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    if (formData.security.newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters long' });
      return;
    }

    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Update password using Supabase Auth API
      const { error } = await supabase.auth.updateUser({
        password: formData.security.newPassword
      });

      if (error) throw error;

      // Reset password fields
      setFormData({
        ...formData,
        security: {
          ...formData.security,
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
          changePassword: false
        }
      });

      setMessage({ type: 'success', text: 'Password updated successfully!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Error updating password:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to update password' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncData = async () => {
    if (!user?.id) return;

    setIsSyncing(true);
    setMessage({ type: '', text: '' });

    try {
      const result = await syncRoomStatus();

      if (result.success) {
        setMessage({
          type: 'success',
          text: result.message
        });

        // If rooms were fixed, we might want to refresh the room context
        // But since we don't have access to it here, the user will see updates on refresh
      } else {
        setMessage({
          type: 'error',
          text: `Sync failed: ${result.message}`
        });
      }
    } catch (error) {
      console.error('Error syncing data:', error);
      setMessage({ type: 'error', text: 'An unexpected error occurred during sync' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSave = async () => {
    switch (activeTab) {
      case 'profile':
        await saveProfile();
        break;
      case 'preferences':
        await savePreferences();
        break;
      case 'notifications':
        await saveNotifications();
        break;
      case 'security':
        await saveSecuritySettings();
        break;
      default:
        break;
    }
  };

  if (isLoadingSettings) {
    return (
      <DashboardLayout title="Settings" activeLink="Settings">
        <div className="flex-1 flex items-center justify-center h-full">
          <div className="text-center">
            <FontAwesomeIcon icon={faSpinner} className="fa-spin text-4xl text-blue-500 mb-4" />
            <p className="text-lg">Loading settings...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Settings" activeLink="Settings">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Manage your profile, preferences, notifications, and security settings
          </p>
        </div>

        {/* Status Message */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-lg flex items-center space-x-3 ${message.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
            }`}>
            <FontAwesomeIcon
              icon={message.type === 'success' ? faCheckCircle : faTimesCircle}
              className="text-xl"
            />
            <span>{message.text}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-1">
          <div className="flex space-x-1">
            {[
              { id: 'profile', icon: faUser, label: 'Profile' },
              { id: 'preferences', icon: faGlobe, label: 'Preferences' },
              { id: 'notifications', icon: faBell, label: 'Notifications' },
              { id: 'security', icon: faLock, label: 'Security' },
              { id: 'system', icon: faSave, label: 'System' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3 px-4 rounded-md font-medium transition-all duration-200 flex items-center justify-center space-x-2 ${activeTab === tab.id
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
              >
                <FontAwesomeIcon icon={tab.icon} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold mb-6">Profile Information</h2>

              {/* Profile Picture */}
              <div className="flex flex-col items-center mb-8">
                <div className="relative w-32 h-32 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 mb-4 ring-4 ring-blue-500 ring-offset-2 dark:ring-offset-gray-800">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500 text-4xl font-bold">
                      {formData.firstName.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                  <label className="absolute bottom-0 right-0 w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:bg-blue-600 transition-colors">
                    <FontAwesomeIcon icon={faCamera} className="text-sm" />
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleFileChange}
                      accept="image/*"
                    />
                  </label>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Click the camera icon to upload a profile picture
                </p>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">First Name</label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your first name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Last Name</label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your last name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    disabled
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 mt-1">Contact an administrator to change your email</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Phone</label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your phone number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Role</label>
                  <input
                    type="text"
                    value={formData.role}
                    disabled
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 mt-1">Only administrators can change roles</p>
                </div>
              </div>
            </div>
          )}

          {/* Preferences Tab */}
          {activeTab === 'preferences' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold mb-6">Preferences</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Language</label>
                  <select
                    name="language"
                    value={formData.language}
                    onChange={handleChange}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="English">English</option>
                    <option value="Spanish">Spanish</option>
                    <option value="French">French</option>
                    <option value="German">German</option>
                    <option value="Portuguese">Portuguese</option>
                    <option value="Chinese">Chinese</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Time Zone</label>
                  <select
                    name="timezone"
                    value={formData.timezone}
                    onChange={handleChange}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="GMT+0">GMT+0 (London)</option>
                    <option value="GMT-5">GMT-5 (New York)</option>
                    <option value="GMT-8">GMT-8 (Los Angeles)</option>
                    <option value="GMT+1">GMT+1 (Paris)</option>
                    <option value="GMT+8">GMT+8 (Beijing)</option>
                    <option value="GMT+5:30">GMT+5:30 (Mumbai)</option>
                    <option value="GMT+0">GMT+0 (Accra)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Date Format</label>
                  <select
                    name="dateFormat"
                    value={formData.dateFormat}
                    onChange={handleChange}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Time Format</label>
                  <select
                    name="timeFormat"
                    value={formData.timeFormat}
                    onChange={handleChange}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="12-hour">12-hour (AM/PM)</option>
                    <option value="24-hour">24-hour</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Currency</label>
                  <select
                    name="currency"
                    value={formData.currency}
                    onChange={handleChange}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="GHS">GHS (GH₵)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="JPY">JPY (¥)</option>
                    <option value="NGN">NGN (₦)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Theme</label>
                  <select
                    name="theme"
                    value={formData.theme}
                    onChange={handleChange}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold mb-6">Notification Settings</h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div>
                    <label htmlFor="email-notifications" className="text-sm font-medium cursor-pointer">
                      Email Notifications
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Receive notifications via email
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      id="email-notifications"
                      name="notifications.email"
                      checked={formData.notifications.email}
                      onChange={handleChange}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* System Tab */}
          {activeTab === 'system' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold mb-6">System Maintenance</h2>

              <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-lg border border-gray-200 dark:border-gray-600">
                <h3 className="text-lg font-medium mb-2">Data Consistency</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Fix issues where rooms are marked as "Occupied" or "Reserved" but have no corresponding guest or reservation.
                  This can happen if an error occurred during check-in or reservation creation.
                </p>

                <button
                  onClick={handleSyncData}
                  disabled={isSyncing}
                  className={`px-4 py-2 rounded-lg text-white font-medium transition-colors flex items-center space-x-2 ${isSyncing
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-yellow-500 hover:bg-yellow-600'
                    }`}
                >
                  {isSyncing ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} className="fa-spin" />
                      <span>Fixing Data...</span>
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faCheckCircle} />
                      <span>Fix Data Inconsistency</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div>
            <label htmlFor="sms-notifications" className="text-sm font-medium cursor-pointer">
              SMS Notifications
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Receive notifications via SMS
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              id="sms-notifications"
              name="notifications.sms"
              checked={formData.notifications.sms}
              onChange={handleChange}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div>
            <label htmlFor="browser-notifications" className="text-sm font-medium cursor-pointer">
              Browser Notifications
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Receive browser push notifications
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              id="browser-notifications"
              name="notifications.browser"
              checked={formData.notifications.browser}
              onChange={handleChange}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div>
            <label htmlFor="app-notifications" className="text-sm font-medium cursor-pointer">
              In-App Notifications
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Show notifications within the application
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              id="app-notifications"
              name="notifications.app"
              checked={formData.notifications.app}
              onChange={handleChange}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>


        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold mb-6">Security Settings</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Session Timeout</label>
                <select
                  name="security.sessionTimeout"
                  value={formData.security.sessionTimeout}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="15 minutes">15 minutes</option>
                  <option value="30 minutes">30 minutes</option>
                  <option value="1 hour">1 hour</option>
                  <option value="2 hours">2 hours</option>
                  <option value="4 hours">4 hours</option>
                  <option value="Never">Never</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Automatically log out after period of inactivity
                </p>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div>
                  <label htmlFor="two-factor" className="text-sm font-medium cursor-pointer">
                    Two-Factor Authentication
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Add an extra layer of security to your account
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="two-factor"
                    name="security.twoFactor"
                    checked={formData.security.twoFactor}
                    onChange={handleChange}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium">Change Password</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Update your password to keep your account secure
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({
                      ...formData,
                      security: {
                        ...formData.security,
                        changePassword: !formData.security.changePassword
                      }
                    })}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                  >
                    {formData.security.changePassword ? 'Cancel' : 'Change Password'}
                  </button>
                </div>

                {formData.security.changePassword && (
                  <form onSubmit={handlePasswordChange} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">New Password</label>
                      <div className="relative">
                        <input
                          type={showPassword.new ? "text" : "password"}
                          name="security.newPassword"
                          value={formData.security.newPassword}
                          onChange={handleChange}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                          placeholder="Enter new password"
                          minLength={8}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword({ ...showPassword, new: !showPassword.new })}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          <FontAwesomeIcon icon={showPassword.new ? faEyeSlash : faEye} />
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Password must be at least 8 characters long
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Confirm New Password</label>
                      <div className="relative">
                        <input
                          type={showPassword.confirm ? "text" : "password"}
                          name="security.confirmPassword"
                          value={formData.security.confirmPassword}
                          onChange={handleChange}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                          placeholder="Confirm new password"
                          minLength={8}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword({ ...showPassword, confirm: !showPassword.confirm })}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          <FontAwesomeIcon icon={showPassword.confirm ? faEyeSlash : faEye} />
                        </button>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                    >
                      {isLoading ? 'Updating...' : 'Update Password'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        {activeTab !== 'security' || !formData.security.changePassword ? (
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
            >
              {isLoading ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} className="fa-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faSave} />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
