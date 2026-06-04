import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import notificationService from '../services/notificationService';
import { useUser } from './UserContext';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const { user } = useUser();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [permission, setPermission] = useState('default');
  const [isSupported, setIsSupported] = useState(false);
  const [channel, setChannel] = useState(null);

  // Initialize notification service
  useEffect(() => {
    const init = async () => {
      try {
        await notificationService.init();
        setIsSupported(notificationService.isSupported());
        setPermission(Notification.permission);
      } catch (error) {
        console.error('Failed to initialize notification service:', error);
      }
    };

    init();
  }, []);

  // Load user notifications
  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;

    try {
      const data = await notificationService.getUserNotifications(user.id);
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.read).length);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  }, [user?.id]);

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!user?.id) return;

    loadNotifications();

    // Subscribe to real-time updates
    const newChannel = notificationService.subscribeToNotifications(
      user.id,
      (newNotification) => {
        setNotifications(prev => [newNotification, ...prev]);
        setUnreadCount(prev => prev + 1);
      }
    );

    setChannel(newChannel);

    return () => {
      if (newChannel) {
        newChannel.unsubscribe();
      }
    };
  }, [user?.id, loadNotifications]);

  // Request notification permission
  const requestPermission = async () => {
    try {
      const result = await notificationService.requestPermission();
      setPermission(result);
      
      if (result === 'granted' && user?.id) {
        // Subscribe to push notifications
        await notificationService.subscribeToPush(user.id);
      }
      
      return result;
    } catch (error) {
      console.error('Failed to request permission:', error);
      return 'denied';
    }
  };

  // Show local notification
  const showNotification = async (title, options) => {
    try {
      await notificationService.showLocalNotification(title, options);
    } catch (error) {
      console.error('Failed to show notification:', error);
    }
  };

  // Send notification to user(s)
  const sendNotification = async (userIds, title, body, options) => {
    try {
      await notificationService.sendNotification(userIds, title, body, options);
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    if (!user?.id) return;

    try {
      await notificationService.markAllAsRead(user.id);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId) => {
    try {
      await notificationService.deleteNotification(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      const notification = notifications.find(n => n.id === notificationId);
      if (notification && !notification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const value = {
    notifications,
    unreadCount,
    permission,
    isSupported,
    requestPermission,
    showNotification,
    sendNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    loadNotifications
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationContext;
