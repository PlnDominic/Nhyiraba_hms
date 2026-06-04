import React, { useState, useEffect } from 'react';
import { FaBell, FaTimes } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifications } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';

const NotificationPermissionPrompt = () => {
  const { theme } = useTheme();
  const { permission, isSupported, requestPermission } = useNotifications();
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const isDarkMode = theme === 'dark';

  useEffect(() => {
    // Check if user has already dismissed the prompt
    const hasDismissed = localStorage.getItem('notification-prompt-dismissed');
    const remindTime = localStorage.getItem('notification-prompt-remind');
    
    // Check if remind time has passed
    const shouldRemind = remindTime ? Date.now() > parseInt(remindTime) : true;
    
    // Show prompt if:
    // 1. Notifications are supported
    // 2. Permission is default (not granted or denied)
    // 3. User hasn't dismissed it permanently
    // 4. Remind time has passed (if set)
    // 5. Wait 3 seconds after page load (reduced for better UX)
    if (isSupported && permission === 'default' && !hasDismissed && shouldRemind) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isSupported, permission]);

  const handleEnable = async () => {
    const result = await requestPermission();
    if (result === 'granted') {
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem('notification-prompt-dismissed', 'true');
  };

  const handleRemindLater = () => {
    setShowPrompt(false);
    // Show again after 1 hour (better for testing, change to 24 hours for production)
    const remindTime = Date.now() + (1 * 60 * 60 * 1000);
    localStorage.setItem('notification-prompt-remind', remindTime.toString());
    // Clear the dismissed flag so it can show again
    localStorage.removeItem('notification-prompt-dismissed');
  };

  if (!isSupported || permission !== 'default' || dismissed) {
    return null;
  }

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-4 right-4 z-50 max-w-sm"
        >
          <div className={`rounded-lg shadow-2xl border p-6 ${
            isDarkMode
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-200'
          }`}>
            <div className="flex items-start space-x-4">
              <div className={`p-3 rounded-full ${
                isDarkMode ? 'bg-blue-900/30' : 'bg-blue-100'
              }`}>
                <FaBell className={`text-2xl ${
                  isDarkMode ? 'text-blue-400' : 'text-blue-600'
                }`} />
              </div>
              
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">
                  Enable Notifications
                </h3>
                <p className={`text-sm mb-4 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Stay updated with important hotel activities, new reservations, and task assignments.
                </p>
                
                <div className="flex flex-col space-y-2">
                  <button
                    onClick={handleEnable}
                    className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                      isDarkMode
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }`}
                  >
                    Enable Notifications
                  </button>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={handleRemindLater}
                      className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                        isDarkMode
                          ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                          : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                      }`}
                    >
                      Remind Later
                    </button>
                    
                    <button
                      onClick={handleDismiss}
                      className={`p-2 rounded-lg transition-colors ${
                        isDarkMode
                          ? 'hover:bg-gray-700 text-gray-400'
                          : 'hover:bg-gray-100 text-gray-500'
                      }`}
                      title="Don't show again"
                    >
                      <FaTimes />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NotificationPermissionPrompt;
