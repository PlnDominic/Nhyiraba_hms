import supabase from '../supabaseClient';

class NotificationService {
  constructor() {
    this.registration = null;
    this.permission = 'default';
  }

  // Initialize the service worker
  async init() {
    if ('serviceWorker' in navigator) {
      try {
        this.registration = await navigator.serviceWorker.register('/service-worker.js');
        console.log('Service Worker registered:', this.registration);
        
        // Check for updates
        this.registration.addEventListener('updatefound', () => {
          const newWorker = this.registration.installing;
          console.log('New Service Worker found');
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('New Service Worker installed, update available');
              // Notify user about update
              this.showLocalNotification('Update Available', {
                body: 'A new version is available. Refresh to update.',
                tag: 'update',
                requireInteraction: true
              });
            }
          });
        });

        return this.registration;
      } catch (error) {
        console.error('Service Worker registration failed:', error);
        throw error;
      }
    } else {
      console.warn('Service Workers are not supported');
      return null;
    }
  }

  // Request notification permission
  async requestPermission() {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      this.permission = 'granted';
      return 'granted';
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission;
    }

    this.permission = 'denied';
    return 'denied';
  }

  // Check if notifications are supported and permitted
  isSupported() {
    return 'Notification' in window && 'serviceWorker' in navigator;
  }

  isPermitted() {
    return Notification.permission === 'granted';
  }

  // Show a local notification (doesn't require push subscription)
  async showLocalNotification(title, options = {}) {
    if (!this.isSupported()) {
      console.warn('Notifications not supported');
      return;
    }

    if (!this.isPermitted()) {
      console.warn('Notification permission not granted');
      return;
    }

    if (!this.registration) {
      await this.init();
    }

    const defaultOptions = {
      icon: '/logo192.png',
      badge: '/logo192.png',
      vibrate: [200, 100, 200],
      tag: 'default',
      requireInteraction: false,
      data: {
        url: window.location.origin
      }
    };

    const notificationOptions = { ...defaultOptions, ...options };

    if (this.registration) {
      return this.registration.showNotification(title, notificationOptions);
    } else {
      // Fallback to regular notification if service worker not available
      return new Notification(title, notificationOptions);
    }
  }

  // Subscribe to push notifications
  async subscribeToPush(userId) {
    if (!this.registration) {
      await this.init();
    }

    if (!this.isPermitted()) {
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }
    }

    try {
      // Check if already subscribed
      let subscription = await this.registration.pushManager.getSubscription();

      if (!subscription) {
        // Create new subscription
        // Note: You'll need to generate VAPID keys for production
        // For now, using userVisibleOnly
        subscription = await this.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(
            process.env.REACT_APP_VAPID_PUBLIC_KEY || ''
          )
        });
      }

      // Save subscription to database
      if (userId && subscription) {
        await this.saveSubscription(userId, subscription);
      }

      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      throw error;
    }
  }

  // Unsubscribe from push notifications
  async unsubscribeFromPush(userId) {
    if (!this.registration) {
      return;
    }

    try {
      const subscription = await this.registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        
        // Remove subscription from database
        if (userId) {
          await this.removeSubscription(userId);
        }
      }
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      throw error;
    }
  }

  // Save push subscription to database
  async saveSubscription(userId, subscription) {
    try {
      const subscriptionData = {
        user_id: userId,
        endpoint: subscription.endpoint,
        keys: JSON.stringify(subscription.toJSON().keys),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('push_subscriptions')
        .upsert(subscriptionData, {
          onConflict: 'user_id'
        });

      if (error) throw error;
      console.log('Push subscription saved to database');
    } catch (error) {
      console.error('Error saving push subscription:', error);
      throw error;
    }
  }

  // Remove push subscription from database
  async removeSubscription(userId) {
    try {
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;
      console.log('Push subscription removed from database');
    } catch (error) {
      console.error('Error removing push subscription:', error);
      throw error;
    }
  }

  // Helper function to convert VAPID key
  urlBase64ToUint8Array(base64String) {
    if (!base64String) {
      return new Uint8Array(0);
    }

    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Send notification to specific user(s)
  async sendNotification(userIds, title, body, options = {}) {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert(
          userIds.map(userId => ({
            user_id: userId,
            title,
            body,
            type: options.type || 'info',
            data: options.data || {},
            url: options.url || '/',
            read: false,
            created_at: new Date().toISOString()
          }))
        );

      if (error) throw error;
      console.log('Notification sent to database');
      return true;
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  }

  // Get user notifications
  async getUserNotifications(userId, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
  }

  // Mark notification as read
  async markAsRead(notificationId) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  }

  // Mark all notifications as read
  async markAllAsRead(userId) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return false;
    }
  }

  // Delete notification
  async deleteNotification(notificationId) {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting notification:', error);
      return false;
    }
  }

  // Subscribe to real-time notifications
  subscribeToNotifications(userId, callback) {
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('New notification received:', payload);
          
          // Show local notification
          this.showLocalNotification(payload.new.title, {
            body: payload.new.body,
            tag: payload.new.id,
            data: {
              url: payload.new.url,
              ...payload.new.data
            }
          });

          // Call callback
          if (callback) {
            callback(payload.new);
          }
        }
      )
      .subscribe();

    return channel;
  }
}

// Export singleton instance
const notificationService = new NotificationService();
export default notificationService;
