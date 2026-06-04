import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import NotificationPermissionPrompt from './NotificationPermissionPrompt';
import { useTheme } from '../context/ThemeContext';

/**
 * DashboardLayout provides a consistent layout for all dashboard pages
 * It includes the sidebar, navbar, and main content area
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - The page content to render
 * @param {string} props.activeLink - The active sidebar link
 * @param {string} props.title - The page title shown in the navbar
 */
const DashboardLayout = ({ children, activeLink, title }) => {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  // Initialize sidebar state based on screen width
  // Default to closed on mobile (< 768px), open on desktop
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return true; // Default to open for SSR/initial render
  });

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className={`flex h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-800'}`}>
      <Sidebar
        activeLink={activeLink}
        isOpen={sidebarOpen}
        toggleSidebar={toggleSidebar}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar
          title={title}
          toggleSidebar={toggleSidebar}
          isSidebarOpen={sidebarOpen}
        />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
      {/* Notification Permission Prompt */}
      <NotificationPermissionPrompt />
    </div>
  );
};

export default DashboardLayout; 