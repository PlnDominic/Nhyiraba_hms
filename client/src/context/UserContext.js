import React, { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../supabaseClient';

// Create a simple user context without authentication
const UserContext = createContext();

export const UserProvider = ({ children }) => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [permissions, setPermissions] = useState([]); // New state for user permissions
    const [loading, setLoading] = useState(true); // Start with loading true
    const [error, setError] = useState(null);

    // Simulate fetching permissions based on user role
    const fetchPermissionsForRole = async (role) => {
        // In a real application, this would be an API call to fetch permissions
        // based on the user's role or specific user ID.
        return new Promise(resolve => {
            setTimeout(() => {
                switch (role) {
                    case 'admin':
                        resolve(['manage_users', 'manage_settings', 'view_reports', 'edit_content', 'access_admin_dashboard']);
                        break;
                    case 'staff':
                        resolve(['view_reports', 'edit_content', 'access_staff_dashboard']);
                        break;
                    case 'guest':
                        resolve(['view_content']);
                        break;
                    default:
                        resolve([]);
                }
            }, 100); // Simulate network delay
        });
    };

    // Simple user management without authentication
    const setCurrentUser = async (userData) => {
        console.log('UserContext: Setting current user data:', userData);
        setUser(userData);

        if (userData) {
            // If userData already contains permissions, use them. Otherwise, fetch.
            let userPermissions = userData.permissions || [];
            if (!userData.permissions && userData.role) {
                userPermissions = await fetchPermissionsForRole(userData.role);
            }
            setPermissions(userPermissions);

            // Persist user data and permissions to localStorage
            localStorage.setItem('currentUser', JSON.stringify({ ...userData, permissions: userPermissions }));
        } else {
            setPermissions([]);
            localStorage.removeItem('currentUser');
        }
    };

    // Simple navigation helper
    const navigateTo = (path) => {
        navigate(path);
    };

    // Logout user
    const logoutUser = () => {
        setCurrentUser(null); // This will also clear permissions and localStorage
        navigate('/landing');
    };

    // Helper function to determine redirect path based on role and department
    const getRedirectPath = (role, department) => {
        // New requirement: All users should be redirected to Time & Attendance page first
        return '/time-attendance';
    };

    // Login user
    const loginUser = async (userData) => {
        console.log('Logging in user:', userData);
        setLoading(true);
        setError(null);
        try {
            await setCurrentUser(userData); // setCurrentUser now handles permission fetching
            const redirectPath = getRedirectPath(userData.role, userData.department);
            navigate(redirectPath);
        } catch (err) {
            console.error('Login error:', err);
            setError('Failed to log in. Please try again.');
            setCurrentUser(null);
        } finally {
            setLoading(false);
        }
    };

    // Error during login
    const loginError = (err) => {
        setError(err);
        setCurrentUser(null);
    };

    // Demo login (for development/testing)
    const demoLogin = async (role = 'staff', department = 'Front Desk') => {
        setLoading(true);
        setError(null);
        try {
            const demoUser = {
                id: `demo-${role}-id`,
                email: `${role}@example.com`,
                role: role,
                department: department,
                fullName: `Demo ${role.charAt(0).toUpperCase() + role.slice(1)}`,
                createdAt: new Date().toISOString()
            };
            await setCurrentUser(demoUser); // setCurrentUser now handles permission fetching
            const redirectPath = getRedirectPath(role, department);
            navigate(redirectPath);
        } catch (err) {
            console.error('Demo login error:', err);
            setError('Failed to perform demo login.');
            setCurrentUser(null);
        } finally {
            setLoading(false);
        }
    };

    // Demo logout
    const demoLogout = () => {
        setCurrentUser(null);
        navigate('/landing');
    };

    // Function to refresh current user data and permissions
    const refreshCurrentUser = async () => {
        if (user && user.id) {
            setLoading(true);
            setError(null);
            try {
                // In a real app, this would be an API call to get the latest user data
                // For this demo, we'll just re-fetch permissions based on the current role
                console.log('Refreshing current user data and permissions...');
                const updatedPermissions = await fetchPermissionsForRole(user.role);
                const updatedUser = { ...user, permissions: updatedPermissions };
                setUser(updatedUser);
                setPermissions(updatedPermissions);
                localStorage.setItem('currentUser', JSON.stringify(updatedUser));
                console.log('User and permissions refreshed.');
            } catch (err) {
                console.error('Error refreshing user:', err);
                setError('Failed to refresh user data.');
                // Optionally, log out if refresh fails critically
                // logoutUser();
            } finally {
                setLoading(false);
            }
        }
    };

    // Restore user state from localStorage on component mount
    useEffect(() => {
        const restoreUser = async () => {
            try {
                const savedUser = localStorage.getItem('currentUser');
                if (savedUser) {
                    const userData = JSON.parse(savedUser);
                    console.log('UserContext: Restoring user from localStorage:', userData);

                    // A saved user is only trusted while the server still accepts their session.
                    // Offboarded (banned) staff have their sessions ended, so drop them here.
                    // Network failures keep the user, so offline mode is unaffected.
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session) {
                        const { error: sessionError } = await supabase.auth.getUser();
                        if (sessionError && [401, 403].includes(sessionError.status)) {
                            console.warn('UserContext: session rejected by server, signing out');
                            await supabase.auth.signOut({ scope: 'local' });
                            await setCurrentUser(null);
                            return;
                        }
                    }
                    // setCurrentUser will handle setting user and fetching/setting permissions
                    await setCurrentUser(userData);
                }
            } catch (err) {
                console.error('Error restoring user from localStorage:', err);
                localStorage.removeItem('currentUser');
                setUser(null);
                setPermissions([]);
                setError('Failed to restore session.');
            } finally {
                setLoading(false);
            }
        };

        restoreUser();
    }, []);

    return (
        <UserContext.Provider value={{
            user,
            currentUser: user, // Add currentUser alias for backward compatibility
            permissions, // Provide permissions
            loading,
            setLoading,
            setCurrentUser,
            navigateTo,
            logoutUser,
            loginUser,
            loginError,
            demoLogin,
            demoLogout,
            refreshCurrentUser, // Provide refresh function
            error
        }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};