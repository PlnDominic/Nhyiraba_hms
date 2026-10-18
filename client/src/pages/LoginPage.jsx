import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import supabase from '../supabaseClient';
import { toast } from 'react-hot-toast';
// Import debug utilities

const LoginPage = () => {
  const navigate = useNavigate();
  const { user, setCurrentUser } = useUser();
  const { theme } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  // Redirect if user is already logged in
  useEffect(() => {
    if (user) {
      redirectBasedOnRole(user.role, user.department);
    }
  }, [user]);

  const redirectBasedOnRole = (role, department = null) => {
    // According to new requirement: All staff should see Time & Attendance page first
    // regardless of their role or department
    navigate('/time-attendance');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Enhanced logging
    console.log(`Attempting to login with email: ${formData.email}`);

    try {
      // Try regular Supabase auth
      console.log("Attempting Supabase auth login...");
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (authError) {
        console.error("Auth error details:", authError);
        throw authError;
      }

      console.log("Login successful, user ID:", data.user.id);

      // If login is successful, get user profile data
      console.log("Fetching user profile...");
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', data.user.id)
        .single();

      if (profileError) {
        console.error("Profile error:", profileError);
        throw profileError;
      }

      console.log("Profile data retrieved:", profileData);

      // Combine auth and profile data
      setCurrentUser({
        id: data.user.id,
        email: data.user.email,
        role: profileData.role || 'staff',
        fullName: profileData.full_name,
        position: profileData.position,
        department: profileData.department,
        contactNumber: profileData.contact_number,
        permissions: profileData.permissions || [],
        avatar_url: profileData.avatar_url,
        passwordChangeRequired: Boolean(profileData.password_change_required)
      });

      toast.success('Login successful!');
      redirectBasedOnRole(profileData.role || 'staff', profileData.department);

    } catch (err) {
      console.error('Login error:', err);

      // Enhanced error output
      if (err.message === 'Invalid login credentials') {
        console.log('This typically means either:');
        console.log('1. Password is incorrect');
        console.log('2. User email is not confirmed');
        console.log('3. User does not exist in Supabase Auth');
      }

      const offline = (typeof navigator !== 'undefined' && navigator.onLine === false) || /failed to fetch|network/i.test(err.message || '');
      setError(offline
        ? "You're offline. Signing in needs a connection. Once you have signed in on this device, the app keeps working without one."
        : err.message || 'Invalid email or password');
      toast.error(offline ? "You're offline" : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{ background: '#e94e00' }}
    >


      {/* Main Content */}
      <div className="max-w-md w-full">
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

        {/* Title */}
        <div className="text-center mb-8">
          <h1 
            className="text-white text-4xl mb-2"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontWeight: '900',
              textShadow: '0 4px 20px rgba(0,0,0,0.3)',
            }}
          >
            Welcome Back
          </h1>
          <p className="text-white/80 text-lg">
            Sign in to access the system
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-white/20 backdrop-blur-sm border-l-4 border-white rounded-lg shadow-lg">
            <div className="flex items-center text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Login Form */}
        <div className="bg-white/95 backdrop-blur-sm shadow-2xl rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                </div>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                  style={{ 
                    focusRingColor: '#e94e00',
                  }}
                  placeholder="you@example.com"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                  style={{ 
                    focusRingColor: '#e94e00',
                  }}
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                  onClick={togglePasswordVisibility}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                      <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Links */}
            <div className="flex items-center justify-between text-sm">
              <Link
                to="/landing"
                className="font-medium hover:underline"
                style={{ color: '#e94e00' }}
              >
                ← Back to Home
              </Link>
              <Link
                to="/forgot-password"
                className="font-medium hover:underline"
                style={{ color: '#e94e00' }}
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full flex justify-center items-center py-3 px-4 rounded-lg text-white font-semibold transition-all transform hover:scale-105 shadow-lg disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
              style={{ 
                background: '#e94e00',
              }}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Request Access Link */}
          <div className="mt-6 pt-6 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link
                to="/request-access"
                className="font-semibold hover:underline"
                style={{ color: '#e94e00' }}
              >
                Request Access
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-white/60 text-xs">
            © {new Date().getFullYear()} Nhyiraba HMS • Powered by <span className="font-semibold text-white">Ecstasy Geospatial Services</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
