import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUser,
  faUsers,
  faUserShield,
  faEnvelope,
  faPhone,
  faBuilding,
  faBriefcase,
  faCheckCircle,
  faTimesCircle,
  faSpinner,
  faShieldAlt,
  faEdit,
  faSave,
  faXmark,
  faEye,
  faEyeSlash
} from '@fortawesome/free-solid-svg-icons';
import DashboardLayout from './DashboardLayout';
import { getPendingAccessRequests } from '../api/accessRequestService';
import { createUserAccount, getAllUsers, updateUser } from '../services/userService';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import supabase from '../supabaseClient';

const AdminAccessControl = () => {
  const { user } = useUser();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isDarkMode = theme === 'dark';

  // State for requests, permissions, and form data
  const [pendingRequests, setPendingRequests] = useState([]);
  const [availablePermissions, setAvailablePermissions] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [activeTab, setActiveTab] = useState('requests'); // 'requests' or 'users'
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    role: 'staff',
    department: '',
    position: '',
    contactNumber: '',
    permissions: []
  });

  // Loading and error states
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const [users, setUsers] = useState([]);

  // Edit user states
  const [editingUser, setEditingUser] = useState(null);
  const [editFormData, setEditFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    position: '',
    department: '',
    role: 'staff',
    permissions: []
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Available roles
  const availableRoles = [
    { id: 'staff', label: 'Staff', color: 'blue' },
    { id: 'manager', label: 'Manager', color: 'purple' },
    { id: 'admin', label: 'Administrator', color: 'red' }
  ];

  // Fetch data function
  const fetchData = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch pending requests
      const requestsResult = await getPendingAccessRequests();
      if (requestsResult.success) {
        setPendingRequests(requestsResult.data || []);
      } else {
        setError(requestsResult.error || 'Failed to fetch pending requests');
      }

      // Fetch all users
      const usersResult = await getAllUsers();
      if (usersResult.success) {
        setUsers(usersResult.data || []);
      } else {
        setError(usersResult.error || 'Failed to fetch users');
      }
    } catch (err) {
      console.error('Unexpected error in fetchData:', err);
      setError('An unexpected error occurred. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Load permissions from database
  useEffect(() => {
    const loadPermissions = async () => {
      try {
        const { data, error } = await supabase
          .from('permissions')
          .select('id, name, description')
          .order('name');

        if (error) {
          console.error('Error loading permissions:', error);
          // Fallback to default permissions
          setAvailablePermissions([
            { id: 'view_guests', label: 'View Guests', description: 'View guest information' },
            { id: 'edit_guests', label: 'Edit Guests', description: 'Edit guest information' },
            { id: 'delete_guests', label: 'Delete Guests', description: 'Delete guest records' },
            { id: 'view_rooms', label: 'View Rooms', description: 'View room information' },
            { id: 'edit_rooms', label: 'Edit Rooms', description: 'Edit room details' },
            { id: 'view_reservations', label: 'View Reservations', description: 'View reservation details' },
            { id: 'edit_reservations', label: 'Edit Reservations', description: 'Edit reservations' },
            { id: 'view_reports', label: 'View Reports', description: 'Access reports and analytics' },
            { id: 'manage_users', label: 'Manage Users', description: 'Manage user accounts' }
          ]);
        } else if (data) {
          setAvailablePermissions(data.map(perm => ({
            id: perm.name,
            label: perm.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            description: perm.description || ''
          })));
        }
      } catch (err) {
        console.error('Error loading permissions:', err);
      }
    };

    loadPermissions();
  }, []);

  // Check if user is authenticated and is admin
  useEffect(() => {
    if (!user) {
      setError('Please log in to access this page.');
      setTimeout(() => navigate('/dashboard'), 2000);
      return;
    }

    if (user.role !== 'admin') {
      setError('Access denied. Admin privileges required.');
      setTimeout(() => navigate('/dashboard'), 2000);
      return;
    }

    fetchData();
  }, [user, navigate, fetchData]);

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle permission checkbox changes
  const handlePermissionChange = (permissionId) => {
    setFormData(prev => {
      const permissions = [...prev.permissions];
      if (permissions.includes(permissionId)) {
        return { ...prev, permissions: permissions.filter(id => id !== permissionId) };
      } else {
        return { ...prev, permissions: [...permissions, permissionId] };
      }
    });
  };

  // Handle selecting a request to process
  const handleSelectRequest = (request) => {
    setSelectedRequest(request);
    setFormData({
      email: request.email,
      password: '',
      confirmPassword: '',
      role: 'staff',
      permissions: [],
      fullName: request.full_name,
      position: request.position,
      department: request.department,
      contactNumber: request.contact_number || ''
    });
  };

  // Send approval email
  const sendApprovalEmail = async (email, fullName, password) => {
    try {
      const response = await fetch('http://localhost:5000/api/send-approval-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          fullName,
          password,
          hotelName: 'Nhyiraba Hotel Management System'
        })
      });

      const data = await response.json();

      if (data.skipped) {
        console.warn('⚠️ Email service not configured - email not sent');
        return { success: true, skipped: true };
      }

      if (!data.success) {
        console.error('Failed to send email:', data.error);
        return { success: false, error: data.error };
      }

      console.log('✅ Approval email sent successfully');
      return { success: true };

    } catch (error) {
      console.error('Error sending approval email:', error);
      // Don't fail the entire operation if email fails
      return { success: false, error: error.message };
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const result = await createUserAccount({
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        role: formData.role,
        permissions: formData.permissions,
        department: formData.department,
        position: formData.position,
        contactNumber: formData.contactNumber
      });

      if (!result.success && (result.error === 'User already registered' || result.code === 'USER_ALREADY_EXISTS')) {
        if (selectedRequest) {
          await supabase
            .from('access_requests')
            .update({ status: 'approved' })
            .eq('id', selectedRequest.id);

          setSuccess(`User with email ${formData.email} already exists. Access request approved!`);
          resetForm();
          await fetchData();
          setIsSubmitting(false);
          return;
        } else {
          throw new Error('User with this email already exists');
        }
      }

      if (!result.success) {
        throw new Error(result.error || 'Failed to create user account');
      }

      // Update the access request status
      if (selectedRequest) {
        await supabase
          .from('access_requests')
          .update({ status: 'approved' })
          .eq('id', selectedRequest.id);
      }

      // Send approval email with credentials
      const emailResult = await sendApprovalEmail(
        formData.email,
        formData.fullName,
        formData.password
      );

      let successMessage = `User account for ${formData.email} created successfully!`;

      if (emailResult.success && !emailResult.skipped) {
        successMessage += ' A notification email has been sent with login credentials.';
      } else if (emailResult.skipped) {
        successMessage += ' (Email notification skipped - not configured)';
      } else {
        successMessage += ' (Note: Failed to send email notification)';
      }

      setSuccess(successMessage);
      resetForm();
      await fetchData();

    } catch (error) {
      console.error('Error creating user:', error);
      if (error.message && (error.message.includes('already registered') || error.message.includes('already exists'))) {
        setError('User with this email already exists. Please use a different email or update the existing account.');
      } else {
        setError(error.message || 'Failed to create user account. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      fullName: '',
      role: 'staff',
      department: '',
      position: '',
      contactNumber: '',
      permissions: []
    });
    setSelectedRequest(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  // Format department name for display
  const formatDepartment = (dept) => {
    if (!dept) return 'N/A';
    const deptMap = {
      'front_desk': 'Front Desk',
      'housekeeping': 'Housekeeping',
      'food_beverage': 'Food & Beverage',
      'maintenance': 'Maintenance',
      'management': 'Management',
      'supermarket': 'Supermarket',
      'hr': 'Human Resources'
    };
    return deptMap[dept] || dept.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get role color
  const getRoleColor = (role) => {
    const roleMap = {
      'admin': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      'manager': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      'staff': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
    };
    return roleMap[role] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  };

  // Handle edit user
  const handleEditUser = (userItem) => {
    setEditingUser(userItem);
    setEditFormData({
      fullName: userItem.full_name || '',
      email: userItem.email || '',
      phone: userItem.contact_number || '',
      position: userItem.position || '',
      department: userItem.department || '',
      role: userItem.role || 'staff',
      permissions: Array.isArray(userItem.permissions) ? [...userItem.permissions] : []
    });
    setEditError('');
    setEditSuccess('');
    setIsEditing(true);
  };

  // Handle edit form changes
  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({ ...prev, [name]: value }));
    setEditError('');
  };

  // Handle edit permission changes
  const handleEditPermissionChange = (permissionId) => {
    setEditFormData(prev => {
      const permissions = [...prev.permissions];
      if (permissions.includes(permissionId)) {
        return { ...prev, permissions: permissions.filter(id => id !== permissionId) };
      } else {
        return { ...prev, permissions: [...permissions, permissionId] };
      }
    });
  };

  // Handle save user edits
  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    setEditError('');
    setEditSuccess('');
    setIsSubmitting(true);

    try {
      // Prepare profile data
      const profileData = {
        full_name: editFormData.fullName.trim(),
        contact_number: editFormData.phone.trim(),
        position: editFormData.position.trim(),
        department: editFormData.department,
        role: editFormData.role
      };

      // Update user
      const result = await updateUser(
        editingUser.user_id,
        profileData,
        editFormData.permissions
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to update user');
      }

      setEditSuccess('User updated successfully!');

      // Refresh users list
      await fetchData();

      // Close edit modal after a delay
      setTimeout(() => {
        setIsEditing(false);
        setEditingUser(null);
        setEditSuccess('');
      }, 1500);

    } catch (error) {
      console.error('Error updating user:', error);
      setEditError(error.message || 'Failed to update user. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingUser(null);
    setEditFormData({
      fullName: '',
      email: '',
      phone: '',
      position: '',
      department: '',
      role: 'staff',
      permissions: []
    });
    setEditError('');
    setEditSuccess('');
  };

  // Validate form
  const validateForm = () => {
    if (!formData.email || !formData.password || !formData.fullName || !formData.role) {
      setError('Please fill in all required fields');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return false;
    }

    return true;
  };

  // If user is not admin, show access denied
  if (user?.role !== 'admin') {
    return (
      <DashboardLayout title="Access Control" activeLink="Access Control">
        <div className="flex-1 flex items-center justify-center h-full">
          <div className="text-center p-8 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <FontAwesomeIcon icon={faTimesCircle} className="text-4xl text-red-500 mb-4" />
            <h2 className="text-2xl font-bold text-red-800 dark:text-red-300 mb-2">Access Denied</h2>
            <p className="text-red-600 dark:text-red-400">You don't have permission to access this page.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Access Control" activeLink="Access Control">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Access Control</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Manage access requests, create user accounts, and assign permissions
          </p>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800 flex items-center space-x-3">
            <FontAwesomeIcon icon={faTimesCircle} className="text-xl" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800 flex items-center space-x-3">
            <FontAwesomeIcon icon={faCheckCircle} className="text-xl" />
            <span>{success}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-1">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('requests')}
              className={`flex-1 py-3 px-4 rounded-md font-medium transition-all duration-200 flex items-center justify-center space-x-2 ${activeTab === 'requests'
                ? 'bg-blue-500 text-white shadow-md'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
            >
              <FontAwesomeIcon icon={faUserShield} />
              <span>Access Requests</span>
              {pendingRequests.length > 0 && (
                <span className="bg-white text-blue-500 rounded-full px-2 py-0.5 text-xs font-bold">
                  {pendingRequests.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`flex-1 py-3 px-4 rounded-md font-medium transition-all duration-200 flex items-center justify-center space-x-2 ${activeTab === 'users'
                ? 'bg-blue-500 text-white shadow-md'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
            >
              <FontAwesomeIcon icon={faUsers} />
              <span>All Users</span>
              <span className="bg-white text-blue-500 rounded-full px-2 py-0.5 text-xs font-bold">
                {users.length}
              </span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <FontAwesomeIcon icon={faSpinner} className="fa-spin text-4xl text-blue-500" />
          </div>
        ) : activeTab === 'requests' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Pending Requests List */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
                <FontAwesomeIcon icon={faUserShield} className="text-blue-500" />
                <span>Pending Access Requests</span>
              </h2>

              {pendingRequests.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <FontAwesomeIcon icon={faUserShield} className="text-4xl mb-4 opacity-50" />
                  <p>No pending requests</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingRequests.map(request => (
                    <div
                      key={request.id}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedRequest?.id === request.id
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 shadow-md'
                        : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                        }`}
                      onClick={() => handleSelectRequest(request)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white">{request.full_name}</h3>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(request.request_date)}</span>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                        <div className="flex items-center space-x-2">
                          <FontAwesomeIcon icon={faEnvelope} className="text-xs" />
                          <span>{request.email}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <FontAwesomeIcon icon={faBriefcase} className="text-xs" />
                          <span>{request.position}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <FontAwesomeIcon icon={faBuilding} className="text-xs" />
                          <span>{formatDepartment(request.department)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Create Account Form */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
                <FontAwesomeIcon icon={faUser} className="text-blue-500" />
                <span>Create User Account</span>
              </h2>

              {!selectedRequest ? (
                <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                  <FontAwesomeIcon icon={faUser} className="text-6xl mb-4 opacity-50" />
                  <p>Select a request from the list to create an account</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Selected Request Info */}
                  <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3">{selectedRequest.full_name}</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-300">
                        <FontAwesomeIcon icon={faBriefcase} className="text-xs" />
                        <span><strong>Position:</strong> {selectedRequest.position}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-300">
                        <FontAwesomeIcon icon={faBuilding} className="text-xs" />
                        <span><strong>Department:</strong> {formatDepartment(selectedRequest.department)}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-300">
                        <FontAwesomeIcon icon={faEnvelope} className="text-xs" />
                        <span><strong>Email:</strong> {selectedRequest.email}</span>
                      </div>
                      {selectedRequest.contact_number && (
                        <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-300">
                          <FontAwesomeIcon icon={faPhone} className="text-xs" />
                          <span><strong>Contact:</strong> {selectedRequest.contact_number}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium mb-2">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                      disabled={isSubmitting}
                    />
                  </div>

                  {/* Password Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="password" className="block text-sm font-medium mb-2">
                        Password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          id="password"
                          name="password"
                          value={formData.password}
                          onChange={handleChange}
                          className="w-full px-4 py-2 pr-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                          disabled={isSubmitting}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                          disabled={isSubmitting}
                        >
                          <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
                        Confirm Password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          id="confirmPassword"
                          name="confirmPassword"
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          className="w-full px-4 py-2 pr-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                          disabled={isSubmitting}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                          disabled={isSubmitting}
                        >
                          <FontAwesomeIcon icon={showConfirmPassword ? faEyeSlash : faEye} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Role */}
                  <div>
                    <label htmlFor="role" className="block text-sm font-medium mb-2">
                      Role <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="role"
                      name="role"
                      value={formData.role}
                      onChange={handleChange}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                      disabled={isSubmitting}
                    >
                      <option value="staff">Staff</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>

                  {/* Permissions */}
                  <div>
                    <label className="block text-sm font-medium mb-3 flex items-center space-x-2">
                      <FontAwesomeIcon icon={faShieldAlt} />
                      <span>Permissions</span>
                      <span className="text-xs text-gray-500">(Select explicitly)</span>
                    </label>
                    <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-4 space-y-2">
                      {availablePermissions.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                          Loading permissions...
                        </p>
                      ) : (
                        availablePermissions.map(permission => (
                          <div key={permission.id} className="flex items-start space-x-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded">
                            <input
                              type="checkbox"
                              id={`permission-${permission.id}`}
                              checked={formData.permissions.includes(permission.id)}
                              onChange={() => handlePermissionChange(permission.id)}
                              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              disabled={isSubmitting}
                            />
                            <label htmlFor={`permission-${permission.id}`} className="flex-1 cursor-pointer">
                              <div className="font-medium text-sm text-gray-900 dark:text-white">{permission.label}</div>
                              {permission.description && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">{permission.description}</div>
                              )}
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                    {formData.permissions.length === 0 && (
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                        ⚠️ No permissions selected. User will have no access.
                      </p>
                    )}
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      type="submit"
                      className={`px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors flex items-center space-x-2 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
                        }`}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <FontAwesomeIcon icon={faSpinner} className="fa-spin" />
                          <span>Creating...</span>
                        </>
                      ) : (
                        <>
                          <FontAwesomeIcon icon={faCheckCircle} />
                          <span>Create Account</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        ) : (
          /* Users List */
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center space-x-2">
              <FontAwesomeIcon icon={faUsers} className="text-blue-500" />
              <span>All Users ({users.length})</span>
            </h2>

            {users.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <FontAwesomeIcon icon={faUsers} className="text-6xl mb-4 opacity-50" />
                <p>No users found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {users.map(userItem => (
                  <div
                    key={userItem.user_id}
                    className="p-4 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:shadow-lg transition-all relative group"
                  >
                    {/* Edit Button */}
                    <button
                      onClick={() => handleEditUser(userItem)}
                      className="absolute top-3 right-3 p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                      title="Edit User"
                    >
                      <FontAwesomeIcon icon={faEdit} className="text-sm" />
                    </button>

                    <div className="flex items-center space-x-4 mb-4">
                      {/* Avatar */}
                      <div className="relative">
                        {userItem.avatar_url ? (
                          <img
                            src={userItem.avatar_url}
                            alt={userItem.full_name || 'User'}
                            className="w-12 h-12 rounded-full object-cover border-2 border-blue-500"
                            onError={(e) => {
                              // Hide the image and show fallback
                              e.target.style.display = 'none';
                              const fallback = e.target.parentElement.querySelector('.avatar-fallback');
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div
                          className={`w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-lg border-2 border-blue-600 shadow-md avatar-fallback ${userItem.avatar_url ? 'hidden' : 'flex'
                            }`}
                        >
                          {(userItem.full_name || userItem.email || 'U').charAt(0).toUpperCase()}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 pr-8">
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                          {userItem.full_name || 'Unknown User'}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {userItem.email || 'No email'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Role:</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getRoleColor(userItem.role)}`}>
                          {userItem.role || 'staff'}
                        </span>
                      </div>

                      {userItem.position && (
                        <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                          <FontAwesomeIcon icon={faBriefcase} className="text-xs" />
                          <span className="truncate">{userItem.position}</span>
                        </div>
                      )}

                      {userItem.department && (
                        <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                          <FontAwesomeIcon icon={faBuilding} className="text-xs" />
                          <span className="truncate">{formatDepartment(userItem.department)}</span>
                        </div>
                      )}

                      {userItem.contact_number && (
                        <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                          <FontAwesomeIcon icon={faPhone} className="text-xs" />
                          <span className="truncate">{userItem.contact_number}</span>
                        </div>
                      )}

                      {userItem.permissions && userItem.permissions.length > 0 && (
                        <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                          <div className="flex items-center space-x-2 mb-2">
                            <FontAwesomeIcon icon={faShieldAlt} className="text-xs text-gray-500" />
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                              Permissions ({userItem.permissions.length})
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {userItem.permissions.slice(0, 3).map(perm => (
                              <span
                                key={perm}
                                className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded"
                              >
                                {perm.replace(/_/g, ' ')}
                              </span>
                            ))}
                            {userItem.permissions.length > 3 && (
                              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-400 text-xs rounded">
                                +{userItem.permissions.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {userItem.created_at && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-600">
                          Joined: {formatDate(userItem.created_at)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Edit User Modal */}
        {isEditing && editingUser && (
          <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4 rounded-t-2xl flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
                  <FontAwesomeIcon icon={faEdit} />
                  <span>Edit User: {editingUser.full_name || editingUser.email}</span>
                </h2>
                <button
                  onClick={handleCancelEdit}
                  className="text-white hover:text-gray-200 transition-colors p-2 hover:bg-white/20 rounded-lg"
                >
                  <FontAwesomeIcon icon={faXmark} className="text-xl" />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleSaveUser} className="p-6">
                {/* Status Messages */}
                {editError && (
                  <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center space-x-3">
                    <FontAwesomeIcon icon={faTimesCircle} className="text-red-500" />
                    <span className="text-sm text-red-800 dark:text-red-300">{editError}</span>
                  </div>
                )}

                {editSuccess && (
                  <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center space-x-3">
                    <FontAwesomeIcon icon={faCheckCircle} className="text-green-500" />
                    <span className="text-sm text-green-800 dark:text-green-300">{editSuccess}</span>
                  </div>
                )}

                <div className="space-y-6">
                  {/* User Info Section */}
                  <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">User Information</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Full Name */}
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Full Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="fullName"
                          value={editFormData.fullName}
                          onChange={handleEditChange}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                          disabled={isSubmitting}
                        />
                      </div>

                      {/* Email */}
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Email
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={editFormData.email || editingUser.email || 'N/A'}
                          disabled
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {editFormData.email || editingUser.email
                            ? 'Email cannot be changed'
                            : 'Email not available in profile'}
                        </p>
                      </div>

                      {/* Phone */}
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Contact Number
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          value={editFormData.phone}
                          onChange={handleEditChange}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={isSubmitting}
                        />
                      </div>

                      {/* Position */}
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Position
                        </label>
                        <input
                          type="text"
                          name="position"
                          value={editFormData.position}
                          onChange={handleEditChange}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={isSubmitting}
                        />
                      </div>

                      {/* Department */}
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Department
                        </label>
                        <select
                          name="department"
                          value={editFormData.department}
                          onChange={handleEditChange}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={isSubmitting}
                        >
                          <option value="">Select Department</option>
                          <option value="front_desk">Front Desk</option>
                          <option value="housekeeping">Housekeeping</option>
                          <option value="food_beverage">Food & Beverage</option>
                          <option value="maintenance">Maintenance</option>
                          <option value="management">Management</option>
                          <option value="supermarket">Supermarket</option>
                          <option value="hr">Human Resources</option>
                          <option value="other">Other</option>
                        </select>
                      </div>

                      {/* Role */}
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Role <span className="text-red-500">*</span>
                        </label>
                        <select
                          name="role"
                          value={editFormData.role}
                          onChange={handleEditChange}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                          disabled={isSubmitting}
                        >
                          <option value="staff">Staff</option>
                          <option value="manager">Manager</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Permissions Section */}
                  <div>
                    <label className="block text-sm font-semibold mb-3 flex items-center space-x-2">
                      <FontAwesomeIcon icon={faShieldAlt} />
                      <span>Permissions</span>
                      <span className="text-xs text-gray-500 font-normal">(Select explicitly)</span>
                    </label>
                    <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-4 space-y-2 bg-gray-50 dark:bg-gray-700/50">
                      {availablePermissions.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                          Loading permissions...
                        </p>
                      ) : (
                        availablePermissions.map(permission => (
                          <div key={permission.id} className="flex items-start space-x-3 p-2 hover:bg-white dark:hover:bg-gray-600 rounded">
                            <input
                              type="checkbox"
                              id={`edit-permission-${permission.id}`}
                              checked={editFormData.permissions.includes(permission.id)}
                              onChange={() => handleEditPermissionChange(permission.id)}
                              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              disabled={isSubmitting}
                            />
                            <label htmlFor={`edit-permission-${permission.id}`} className="flex-1 cursor-pointer">
                              <div className="font-medium text-sm text-gray-900 dark:text-white">{permission.label}</div>
                              {permission.description && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">{permission.description}</div>
                              )}
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                    {editFormData.permissions.length === 0 && (
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                        ⚠️ No permissions selected. User will have no access.
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      disabled={isSubmitting}
                      className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={`px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center space-x-2 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
                        }`}
                    >
                      {isSubmitting ? (
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
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminAccessControl;
