import React, { useState } from 'react';
import { FaBell, FaCheckCircle, FaTimesCircle, FaExclamationTriangle, FaMobileAlt, FaApple, FaAndroid } from 'react-icons/fa';
import { motion } from 'framer-motion';
import { useNotifications } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';

const NotificationSettings = () => {
  const { theme } = useTheme();
  const {
    permission,
    requestPermission,
    isSupported,
    showNotification
  } = useNotifications();
  
  const [isRequesting, setIsRequesting] = useState(false);
  const isDarkMode = theme === 'dark';

  // Detect iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
  
  // Detect iOS version
  const getIOSVersion = () => {
    const match = navigator.userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/);
    if (match) {
      return parseFloat(`${match[1]}.${match[2]}`);
    }
    return 0;
  };

  const iosVersion = isIOS ? getIOSVersion() : 0;
  const supportsNotifications = iosVersion >= 16.4;

  const handleEnableNotifications = async () => {
    setIsRequesting(true);
    try {
      const result = await requestPermission();
      if (result === 'granted') {
        // Show a test notification
        await showNotification('Notifications Enabled!', {
          body: 'You will now receive important updates',
          icon: '/logo192.png',
          tag: 'welcome'
        });
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleTestNotification = async () => {
    await showNotification('Test Notification', {
      body: 'This is a test notification from Nhyiraba HMS',
      icon: '/logo192.png',
      tag: 'test',
      requireInteraction: false
    });
  };

  const getPermissionStatus = () => {
    switch (permission) {
      case 'granted':
        return {
          icon: <FaCheckCircle className="text-green-500 text-2xl" />,
          title: 'Notifications Enabled',
          message: 'You will receive important updates',
          color: 'green'
        };
      case 'denied':
        return {
          icon: <FaTimesCircle className="text-red-500 text-2xl" />,
          title: 'Notifications Blocked',
          message: 'Please enable notifications in your device settings',
          color: 'red'
        };
      default:
        return {
          icon: <FaBell className="text-amber-500 text-2xl" />,
          title: 'Notifications Disabled',
          message: 'Enable notifications to stay updated',
          color: 'amber'
        };
    }
  };

  const status = getPermissionStatus();

  if (!isSupported) {
    return (
      <div className={`p-6 rounded-lg border ${
        isDarkMode
          ? 'bg-gray-800 border-gray-700'
          : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-start space-x-4">
          <FaExclamationTriangle className="text-amber-500 text-2xl flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-lg mb-2">Notifications Not Supported</h3>
            <p className={`text-sm mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Your browser or device doesn't support web notifications.
            </p>
            
            {isIOS && (
              <div className={`p-4 rounded-lg ${
                isDarkMode ? 'bg-blue-900/20' : 'bg-blue-50'
              }`}>
                <div className="flex items-center space-x-2 mb-2">
                  <FaApple className="text-xl" />
                  <span className="font-medium">iOS Device Detected</span>
                </div>
                <ul className="text-sm space-y-1 ml-6 list-disc">
                  <li>iOS 16.4 or later required (You have: iOS {iosVersion})</li>
                  <li>Must use Safari browser</li>
                  <li>App must be added to home screen</li>
                  {!isStandalone && (
                    <li className="text-amber-600 font-medium">
                      ⚠️ Please add this app to your home screen first
                    </li>
                  )}
                </ul>
                
                {!isStandalone && (
                  <div className="mt-4 p-3 bg-white/10 rounded">
                    <p className="font-medium mb-2">How to add to home screen:</p>
                    <ol className="text-sm space-y-1 ml-4 list-decimal">
                      <li>Tap the Share button (square with arrow)</li>
                      <li>Scroll down and tap "Add to Home Screen"</li>
                      <li>Tap "Add"</li>
                      <li>Open the app from your home screen</li>
                    </ol>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 rounded-lg border ${
      isDarkMode
        ? 'bg-gray-800 border-gray-700'
        : 'bg-white border-gray-200'
    }`}>
      <h3 className="font-semibold text-lg mb-4 flex items-center">
        <FaBell className="mr-2" />
        Notification Settings
      </h3>

      {/* Status Card */}
      <div className={`p-4 rounded-lg mb-6 ${
        status.color === 'green'
          ? isDarkMode ? 'bg-green-900/20' : 'bg-green-50'
          : status.color === 'red'
          ? isDarkMode ? 'bg-red-900/20' : 'bg-red-50'
          : isDarkMode ? 'bg-amber-900/20' : 'bg-amber-50'
      }`}>
        <div className="flex items-start space-x-4">
          {status.icon}
          <div className="flex-1">
            <h4 className="font-medium mb-1">{status.title}</h4>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {status.message}
            </p>
          </div>
        </div>
      </div>

      {/* iOS-specific info */}
      {isIOS && (
        <div className={`p-4 rounded-lg mb-4 ${
          isDarkMode ? 'bg-blue-900/20' : 'bg-blue-50'
        }`}>
          <div className="flex items-center space-x-2 mb-2">
            <FaApple className="text-xl" />
            <span className="font-medium">iOS Device</span>
          </div>
          <div className="text-sm space-y-1">
            <p>✓ iOS Version: {iosVersion}</p>
            <p>✓ Safari: {navigator.userAgent.includes('Safari') ? 'Yes' : 'No'}</p>
            <p>✓ Installed to Home Screen: {isStandalone ? 'Yes' : 'No'}</p>
            <p>✓ Notifications Supported: {supportsNotifications ? 'Yes' : 'No (need iOS 16.4+)'}</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        {permission === 'default' && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleEnableNotifications}
            disabled={isRequesting}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
              isDarkMode
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isRequesting ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Requesting Permission...
              </span>
            ) : (
              'Enable Notifications'
            )}
          </motion.button>
        )}

        {permission === 'granted' && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleTestNotification}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
              isDarkMode
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            Send Test Notification
          </motion.button>
        )}

        {permission === 'denied' && (
          <div className={`p-4 rounded-lg ${
            isDarkMode ? 'bg-red-900/20' : 'bg-red-50'
          }`}>
            <p className="font-medium mb-2">How to enable notifications:</p>
            {isIOS ? (
              <ol className="text-sm space-y-1 ml-4 list-decimal">
                <li>Go to iPhone Settings</li>
                <li>Scroll down to find this app</li>
                <li>Tap "Notifications"</li>
                <li>Turn ON "Allow Notifications"</li>
                <li>Return to the app and refresh</li>
              </ol>
            ) : (
              <ol className="text-sm space-y-1 ml-4 list-decimal">
                <li>Click the lock icon in the address bar</li>
                <li>Find "Notifications" in the permissions list</li>
                <li>Change from "Block" to "Allow"</li>
                <li>Refresh the page</li>
              </ol>
            )}
          </div>
        )}
      </div>

      {/* Additional Info */}
      <div className={`mt-6 p-4 rounded-lg ${
        isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'
      }`}>
        <h4 className="font-medium mb-2 text-sm">What you'll receive:</h4>
        <ul className="text-sm space-y-1 ml-4 list-disc">
          <li>New reservation alerts</li>
          <li>Task assignments</li>
          <li>Inventory requests</li>
          <li>Order notifications</li>
          <li>Important system updates</li>
        </ul>
      </div>

      {/* Debug Info (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <details className={`mt-4 p-3 rounded text-xs ${
          isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
        }`}>
          <summary className="cursor-pointer font-medium">Debug Info</summary>
          <div className="mt-2 space-y-1 font-mono">
            <p>Permission: {permission}</p>
            <p>Supported: {isSupported ? 'Yes' : 'No'}</p>
            <p>iOS: {isIOS ? 'Yes' : 'No'}</p>
            <p>iOS Version: {iosVersion || 'N/A'}</p>
            <p>Standalone: {isStandalone ? 'Yes' : 'No'}</p>
            <p>User Agent: {navigator.userAgent.substring(0, 50)}...</p>
          </div>
        </details>
      )}
    </div>
  );
};

export default NotificationSettings;
