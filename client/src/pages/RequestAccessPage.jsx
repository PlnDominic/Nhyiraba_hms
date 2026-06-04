import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUser,
  faEnvelope,
  faPhone,
  faBriefcase,
  faBuilding,
  faFileAlt,
  faCheckCircle,
  faTimesCircle,
  faSpinner,
  faArrowLeft,
  faShieldAlt,
  faPaperPlane
} from '@fortawesome/free-solid-svg-icons';
import { useTheme } from '../context/ThemeContext';
import supabase from '../supabaseClient';
import { createAccessRequest } from '../api/accessRequestService';

const RequestAccessPage = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    position: '',
    department: '',
    contact_number: '',
    reason: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [touched, setTouched] = useState({});

  // Available departments
  const departments = [
    { value: 'front_desk', label: 'Front Desk' },
    { value: 'housekeeping', label: 'Housekeeping' },
    { value: 'food_beverage', label: 'Food & Beverage' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'management', label: 'Management' },
    { value: 'supermarket', label: 'Supermarket' },
    { value: 'hr', label: 'Human Resources' },
    { value: 'other', label: 'Other' }
  ];

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  // Handle field blur
  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
  };

  // Validate email
  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  // Validate phone
  const validatePhone = (phone) => {
    const re = /^[\d\s\-\+\(\)]+$/;
    return re.test(phone) && phone.replace(/\D/g, '').length >= 10;
  };

  // Submit the access request
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Mark all fields as touched
    setTouched({
      full_name: true,
      email: true,
      position: true,
      department: true,
      contact_number: true,
      reason: true
    });

    // Validation
    if (!formData.full_name.trim()) {
      setError('Please enter your full name');
      return;
    }

    if (!formData.email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (!validateEmail(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!formData.position.trim()) {
      setError('Please enter your position');
      return;
    }

    if (!formData.department) {
      setError('Please select your department');
      return;
    }

    if (!formData.contact_number.trim()) {
      setError('Please enter your contact number');
      return;
    }

    if (!validatePhone(formData.contact_number)) {
      setError('Please enter a valid contact number (at least 10 digits)');
      return;
    }

    if (!formData.reason.trim()) {
      setError('Please provide a reason for access');
      return;
    }

    if (formData.reason.trim().length < 10) {
      setError('Please provide a more detailed reason (at least 10 characters)');
      return;
    }

    setIsSubmitting(true);

    try {
      // Use the service function to create access request
      const result = await createAccessRequest({
        full_name: formData.full_name.trim(),
        email: formData.email.trim().toLowerCase(),
        position: formData.position.trim(),
        department: formData.department,
        contact_number: formData.contact_number.trim(),
        reason: formData.reason.trim()
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to submit access request');
      }

      // Show success message
      setSuccess(true);

      // Clear form
      setFormData({
        full_name: '',
        email: '',
        position: '',
        department: '',
        contact_number: '',
        reason: ''
      });
      setTouched({});

      // Redirect to landing page after 3 seconds
      setTimeout(() => {
        navigate('/landing');
      }, 3000);

    } catch (error) {
      console.error('Error submitting access request:', error);
      setError(error.message || 'Failed to submit access request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get field error
  const getFieldError = (fieldName) => {
    if (!touched[fieldName]) return null;

    const value = formData[fieldName];

    switch (fieldName) {
      case 'email':
        if (!value) return 'Email is required';
        if (!validateEmail(value)) return 'Invalid email format';
        return null;
      case 'contact_number':
        if (!value) return 'Contact number is required';
        if (!validatePhone(value)) return 'Invalid phone number (at least 10 digits)';
        return null;
      case 'full_name':
        if (!value) return 'Full name is required';
        return null;
      case 'position':
        if (!value) return 'Position is required';
        return null;
      case 'department':
        if (!value) return 'Department is required';
        return null;
      case 'reason':
        if (!value) return 'Reason is required';
        if (value.length < 10) return 'Reason must be at least 10 characters';
        return null;
      default:
        return null;
    }
  };

  // Success screen
  if (success) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: '#e94e00' }}
      >
        <div className="max-w-md w-full">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 text-center">
            <div className="mb-6">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: '#e94e00' }}
              >
                <FontAwesomeIcon icon={faCheckCircle} className="text-4xl text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Request Submitted!
              </h2>
              <p className="text-gray-600">
                Your access request has been submitted successfully.
              </p>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-700">
                A manager will review your request and get back to you shortly. You'll be redirected to the home page in a few seconds.
              </p>
            </div>

            <Link
              to="/landing"
              className="inline-flex items-center space-x-2 px-6 py-3 text-white font-semibold rounded-lg transition-all transform hover:scale-105 shadow-lg"
              style={{ background: '#e94e00' }}
            >
              <FontAwesomeIcon icon={faArrowLeft} />
              <span>Back to Home</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen py-8 px-4"
      style={{ background: '#e94e00' }}
    >


      <div className="max-w-2xl mx-auto">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div 
            className="bg-white p-6 shadow-2xl border-4"
            style={{
              borderRadius: '16px',
              borderColor: '#ffffff',
            }}
          >
            <img
              src="/logo256.png"
              alt="Nhyiraba HMS Logo"
              className="w-20 h-20 object-contain"
            />
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 
            className="text-white text-4xl mb-2"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontWeight: '900',
              textShadow: '0 4px 20px rgba(0,0,0,0.3)',
            }}
          >
            Request Access
          </h1>
          <p className="text-white/80 text-lg max-w-md mx-auto">
            Fill out the form below to request access to the system
          </p>
        </div>

        {/* Main Form Card */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden">
          {/* Form Header */}
          <div 
            className="px-6 py-4"
            style={{ background: '#e94e00' }}
          >
            <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
              <FontAwesomeIcon icon={faUser} />
              <span>Personal Information</span>
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="p-6 md:p-8">
            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
                <FontAwesomeIcon icon={faTimesCircle} className="text-red-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">{error}</p>
                </div>
              </div>
            )}

            <div className="space-y-6">
              {/* Full Name */}
              <div>
                <label htmlFor="full_name" className="block text-sm font-semibold text-gray-700 mb-2">
                  <FontAwesomeIcon icon={faUser} className="mr-2" style={{ color: '#e94e00' }} />
                  Full Name
                </label>
                <input
                  type="text"
                  id="full_name"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
                  placeholder="John Doe"
                  disabled={isSubmitting}
                />
                {getFieldError('full_name') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('full_name')}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                  <FontAwesomeIcon icon={faEnvelope} className="mr-2" style={{ color: '#e94e00' }} />
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
                  placeholder="john@example.com"
                  disabled={isSubmitting}
                />
                {getFieldError('email') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('email')}</p>
                )}
              </div>

              {/* Position */}
              <div>
                <label htmlFor="position" className="block text-sm font-semibold text-gray-700 mb-2">
                  <FontAwesomeIcon icon={faBriefcase} className="mr-2" style={{ color: '#e94e00' }} />
                  Position
                </label>
                <input
                  type="text"
                  id="position"
                  name="position"
                  value={formData.position}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
                  placeholder="e.g., Front Desk Agent"
                  disabled={isSubmitting}
                />
                {getFieldError('position') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('position')}</p>
                )}
              </div>

              {/* Department */}
              <div>
                <label htmlFor="department" className="block text-sm font-semibold text-gray-700 mb-2">
                  <FontAwesomeIcon icon={faBuilding} className="mr-2" style={{ color: '#e94e00' }} />
                  Department
                </label>
                <select
                  id="department"
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
                  disabled={isSubmitting}
                >
                  <option value="">Select a department</option>
                  {departments.map(dept => (
                    <option key={dept.value} value={dept.value}>
                      {dept.label}
                    </option>
                  ))}
                </select>
                {getFieldError('department') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('department')}</p>
                )}
              </div>

              {/* Contact Number */}
              <div>
                <label htmlFor="contact_number" className="block text-sm font-semibold text-gray-700 mb-2">
                  <FontAwesomeIcon icon={faPhone} className="mr-2" style={{ color: '#e94e00' }} />
                  Contact Number
                </label>
                <input
                  type="tel"
                  id="contact_number"
                  name="contact_number"
                  value={formData.contact_number}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
                  placeholder="+1 (555) 123-4567"
                  disabled={isSubmitting}
                />
                {getFieldError('contact_number') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('contact_number')}</p>
                )}
              </div>

              {/* Reason */}
              <div>
                <label htmlFor="reason" className="block text-sm font-semibold text-gray-700 mb-2">
                  <FontAwesomeIcon icon={faFileAlt} className="mr-2" style={{ color: '#e94e00' }} />
                  Reason for Access
                </label>
                <textarea
                  id="reason"
                  name="reason"
                  value={formData.reason}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  rows="4"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent resize-none"
                  placeholder="Please explain why you need access to the system..."
                  disabled={isSubmitting}
                />
                {getFieldError('reason') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('reason')}</p>
                )}
              </div>
            </div>

            {/* Buttons */}
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <Link
                to="/landing"
                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-all text-center"
              >
                <FontAwesomeIcon icon={faArrowLeft} className="mr-2" />
                Back to Home
              </Link>
              <button
                type="submit"
                className="flex-1 px-6 py-3 text-white font-semibold rounded-lg transition-all transform hover:scale-105 shadow-lg disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center"
                style={{ background: '#e94e00' }}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faPaperPlane} className="mr-2" />
                    Submit Request
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-white/60 text-sm">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-semibold text-white hover:underline"
            >
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RequestAccessPage;
