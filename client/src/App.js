import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import SplashScreen from './components/SplashScreen';
import { UserProvider } from './context/UserContext';
import { ThemeProvider } from './context/ThemeContext';
import { RoomReservationProvider } from './context/RoomReservationContext';
import { ModalProvider } from './context/ModalContext';
import { GuestProvider } from './context/GuestContext';
import { RoomProvider } from './context/RoomContext';
import { ReservationProvider } from './context/ReservationContext';
import { StaffProvider } from './context/StaffContext';
import { InventoryProvider } from './context/InventoryContext';
import { RestaurantProvider } from './context/RestaurantContext';
import { NotificationProvider } from './context/NotificationContext';
import Home from './pages/Home';
import RoomsPage from './components/RoomsPage';
import ReservationsPage from './components/ReservationsPage';
import ConditionalProfileModal from './components/ConditionalProfileModal';
import SettingsPage from './components/SettingsPage';
import { Toaster } from 'react-hot-toast';
import ProtectedRoute from './components/ProtectedRoute';
import DebugUserContext from './components/DebugUserContext';

// Use lazy loading for route components
const LandingPage = lazy(() => import('./components/LandingPage'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const GuestsPage = lazy(() => import('./components/GuestsPage'));
const GuestProfilesPage = lazy(() => import('./components/GuestProfilesPage'));
const CommunicationCenterPage = lazy(() => import('./components/CommunicationCenterPage'));
const TasksPage = lazy(() => import('./components/TasksPage'));
const BillingPage = lazy(() => import('./components/BillingPage'));
const ServicesPage = lazy(() => import('./components/ServicesPage'));
const AdminAccessControl = lazy(() => import('./components/AdminAccessControl'));
const ManagerAccessControl = lazy(() => import('./components/ManagerAccessControl'));
const TestAccessRequests = lazy(() => import('./pages/TestAccessRequests'));
const ReportsPage = lazy(() => import('./components/Reports'));
const RequestAccessPage = lazy(() => import('./pages/RequestAccessPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage'));
const NotFound = lazy(() => import('./components/NotFound'));
const RealAccountSetup = lazy(() => import('./components/RealAccountSetup'));
const StaffPage = lazy(() => import('./components/StaffPage'));
const StaffTimeAttendancePage = lazy(() => import('./components/staff/StaffTimeAttendancePage'));
const InventoryPage = lazy(() => import('./components/inventory/InventoryPage'));
const RestaurantPage = lazy(() => import('./components/restaurant/RestaurantPage'));
const SupermarketPage = lazy(() => import('./components/supermarket/SupermarketPage'));
const PoolPage = lazy(() => import('./components/PoolPage'));
const PoolCheckInForm = lazy(() => import('./components/pool/PoolCheckInForm'));
const OfflineDatabaseTest = lazy(() => import('./components/OfflineDatabaseTest'));
const SimpleDatabaseTest = lazy(() => import('./components/SimpleDatabaseTest'));
const OfflineRoomsManager = lazy(() => import('./components/OfflineRoomsManager'));
const OfflineEnabledRoomsPage = lazy(() => import('./components/OfflineEnabledRoomsPage'));
const OfflineEnabledDashboard = lazy(() => import('./components/OfflineEnabledDashboard'));
const RevenuePage = lazy(() => import('./components/revenue/RevenuePage'));
const ReservationOperationsPage = lazy(() => import('./components/ReservationOperationsPage'));

// Loading component for Suspense
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen p-5 bg-gray-100 min-w-screen">
    <div className="flex space-x-2 animate-pulse">
      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
    </div>
  </div>
);

const App = () => {
  const location = useLocation();
  const [showSplash, setShowSplash] = useState(true);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  // Check if this is the first load
  useEffect(() => {
    const hasSeenSplash = sessionStorage.getItem('hasSeenSplash');
    if (hasSeenSplash) {
      setShowSplash(false);
      setIsFirstLoad(false);
    }
  }, []);

  // Handle splash screen completion
  const handleSplashComplete = () => {
    setShowSplash(false);
    sessionStorage.setItem('hasSeenSplash', 'true');
  };

  // Preload critical components 
  useEffect(() => {
    // Preload these components as they're commonly used
    import('./components/Dashboard');
    import('./components/ReservationsPage');
    import('./components/RoomsPage');
  }, []);

  // Force re-render when route changes with optimized transition
  useEffect(() => {
    // Scroll to top when page changes
    window.scrollTo(0, 0);

    // Clear any lingering tooltips or popovers
    const tooltips = document.querySelectorAll('.tooltip, .popover');
    if (tooltips.length) {
      tooltips.forEach(el => el.remove());
    }

    // Remove the forced redraw which can cause flickering
    // document.body.style.display = 'none';
    // const reflow = document.body.offsetHeight; 
    // document.body.style.display = '';

    // Add instant transition to body to prevent FOUC
    document.body.classList.add('no-transition');

    // Remove the class after a short delay
    setTimeout(() => {
      document.body.classList.remove('no-transition');
    }, 50);
  }, [location.pathname]);

  // Create memoized routes to prevent unnecessary re-renders
  const routes = useMemo(() => (
    <Routes>
      <Route path="/" element={<Home key="home-route" />} />
      <Route path="/pool-checkin" element={<PoolCheckInForm />} />
      <Route path="/landing" element={<LandingPage key="landing-route" />} />
      <Route path="/login" element={<LoginPage key="login-route" />} />
      <Route path="/request-access" element={<RequestAccessPage key="request-access-route" />} />

      {/* Protected Routes - Add key prop for forced re-rendering */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard key="dashboard" />
        </ProtectedRoute>
      } />
      <Route path="/rooms" element={
        <ProtectedRoute>
          <RoomsPage key="rooms" />
        </ProtectedRoute>
      } />
      <Route path="/reservations" element={
        <ProtectedRoute>
          <ReservationsPage key="reservations" />
        </ProtectedRoute>
      } />
      <Route path="/guests" element={
        <ProtectedRoute>
          <GuestsPage key="guests" />
        </ProtectedRoute>
      } />
      <Route path="/guest-profiles" element={
        <ProtectedRoute>
          <GuestProfilesPage key="guest-profiles" />
        </ProtectedRoute>
      } />
      <Route path="/communications" element={
        <ProtectedRoute>
          <CommunicationCenterPage key="communications" />
        </ProtectedRoute>
      } />
      <Route path="/staff" element={
        <ProtectedRoute>
          <StaffPage key="staff" />
        </ProtectedRoute>
      } />
      <Route path="/tasks" element={
        <ProtectedRoute>
          <TasksPage key="tasks" />
        </ProtectedRoute>
      } />
      <Route path="/billing" element={
        <ProtectedRoute>
          <BillingPage key="billing" />
        </ProtectedRoute>
      } />
      <Route path="/services" element={
        <ProtectedRoute>
          <ServicesPage key="services" />
        </ProtectedRoute>
      } />
      <Route path="/inventory" element={
        <ProtectedRoute>
          <InventoryPage key="inventory" />
        </ProtectedRoute>
      } />
      <Route path="/reports" element={
        <ProtectedRoute>
          <ReportsPage key="reports" />
        </ProtectedRoute>
      } />
      <Route path="/revenue" element={
        <ProtectedRoute>
          <RevenuePage key="revenue" />
        </ProtectedRoute>
      } />
      <Route path="/operations" element={
        <ProtectedRoute>
          <ReservationOperationsPage key="operations" />
        </ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute>
          <ConditionalProfileModal key="profile" />
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <SettingsPage key="settings" />
        </ProtectedRoute>
      } />
      <Route path="/admin/access-control" element={
        <ProtectedRoute>
          <AdminAccessControl key="admin-access" />
        </ProtectedRoute>
      } />
      <Route path="/manager/access-control" element={
        <ProtectedRoute>
          <ManagerAccessControl key="manager-access" />
        </ProtectedRoute>
      } />
      <Route path="/test-access-requests" element={
        <ProtectedRoute>
          <TestAccessRequests key="test-access" />
        </ProtectedRoute>
      } />
      <Route path="/time-attendance" element={
        <ProtectedRoute>
          <StaffTimeAttendancePage key="time-attendance" />
        </ProtectedRoute>
      } />
      <Route path="/restaurant" element={
        <ProtectedRoute>
          <RestaurantPage />
        </ProtectedRoute>
      } />

      <Route path="/supermarket" element={
        <ProtectedRoute>
          <SupermarketPage />
        </ProtectedRoute>
      } />

      <Route path="/pool" element={
        <ProtectedRoute>
          <PoolPage />
        </ProtectedRoute>
      } />

      <Route path="/offline-test" element={
        <OfflineDatabaseTest key="offline-test" />
      } />

      <Route path="/simple-test" element={
        <SimpleDatabaseTest key="simple-test" />
      } />

      <Route path="/offline-rooms" element={
        <OfflineRoomsManager key="offline-rooms" />
      } />

      <Route path="/offline/rooms" element={
        <ProtectedRoute>
          <OfflineEnabledRoomsPage key="offline-rooms" />
        </ProtectedRoute>
      } />

      <Route path="/offline/dashboard" element={
        <ProtectedRoute>
          <OfflineEnabledDashboard key="offline-dashboard" />
        </ProtectedRoute>
      } />

      <Route path="/offline/*" element={
        <OfflineRoomsManager key="offline-hotel" />
      } />

      <Route path="/setup-accounts" element={
        <RealAccountSetup key="setup-accounts" />
      } />

      <Route path="/debug-user-context" element={
        <DebugUserContext key="debug-user-context" />
      } />

      <Route path="/forgot-password" element={
        <ForgotPasswordPage key="forgot-password" />
      } />

      <Route path="/change-password" element={
        <ProtectedRoute>
          <ChangePasswordPage key="change-password" />
        </ProtectedRoute>
      } />
      <Route path="/reset-password" element={
        <ResetPasswordPage key="reset-password" />
      } />

      <Route path="*" element={<NotFound key="not-found" />} />
    </Routes>
  ), []);

  return (
    <>
      {/* Show splash screen only on first load */}
      {showSplash && isFirstLoad && (
        <SplashScreen onComplete={handleSplashComplete} />
      )}
      
    <ThemeProvider>
      <UserProvider>
        <NotificationProvider>
          <RoomReservationProvider>
            <RoomProvider>
              <ReservationProvider>
                <ModalProvider>
                  <GuestProvider>
                    <StaffProvider>
                      <InventoryProvider>
                        <RestaurantProvider>
                        <style jsx global>{`
                          .no-transition {
                            transition: none !important;
                          }
                        `}</style>
                        <Suspense fallback={<LoadingFallback />}>
                          {routes}
                        </Suspense>
                        <Toaster position="top-right" toastOptions={{
                          style: {
                            background: '#333',
                            color: '#fff',
                          },
                          success: {
                            duration: 3000,
                            style: {
                              background: 'green',
                            },
                          },
                          error: {
                            duration: 4000,
                            style: {
                              background: 'red',
                            },
                          },
                        }} />
                        </RestaurantProvider>
                      </InventoryProvider>
                    </StaffProvider>
                  </GuestProvider>
                </ModalProvider>
              </ReservationProvider>
            </RoomProvider>
          </RoomReservationProvider>
        </NotificationProvider>
      </UserProvider>
    </ThemeProvider>
    </>
  );
};

export default App;
