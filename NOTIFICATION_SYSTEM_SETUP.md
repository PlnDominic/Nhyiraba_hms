# PWA Push Notification System Setup Guide

## Overview
This notification system enables push notifications for the Nhyiraba Hotel Management System PWA, allowing staff to receive real-time updates on their phones (iOS and Android).

## Features Implemented

### 1. Service Worker
- **File**: `client/public/service-worker.js`
- Handles push notifications
- Manages offline caching
- Background sync support
- Notification click handling

### 2. Notification Service
- **File**: `client/src/services/notificationService.js`
- Manages notification permissions
- Handles push subscriptions
- Sends and receives notifications
- Real-time notification updates via Supabase

### 3. Notification Context
- **File**: `client/src/context/NotificationContext.js`
- Global notification state management
- Real-time notification subscription
- Unread count tracking
- Mark as read/delete functionality

### 4. UI Components
- **NotificationBell**: `client/src/components/NotificationBell.js`
  - Bell icon with unread badge
  - Dropdown notification list
  - Mark as read/delete actions
  
- **NotificationPermissionPrompt**: `client/src/components/NotificationPermissionPrompt.js`
  - User-friendly permission request
  - Remind later functionality
  - Dismissible prompt

## Database Setup

### Step 1: Run SQL Migration
1. Open your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy the contents of `notifications_migration.sql`
4. Paste and run the SQL script
5. Verify tables are created:
   - `notifications`
   - `push_subscriptions`

### Step 2: Verify RLS Policies
The migration automatically creates Row Level Security policies:
- Users can only view/manage their own notifications
- Authenticated users can send notifications
- Department and role-based notification functions

## Integration Steps

### Step 1: Add NotificationProvider to App.js

```javascript
import { NotificationProvider } from './context/NotificationContext';

function App() {
  return (
    <NotificationProvider>
      {/* Your app components */}
    </NotificationProvider>
  );
}
```

### Step 2: Add NotificationBell to Navbar/Header

```javascript
import NotificationBell from './components/NotificationBell';

function Navbar() {
  return (
    <nav>
      {/* Other nav items */}
      <NotificationBell />
    </nav>
  );
}
```

### Step 3: Add NotificationPermissionPrompt to Main Layout

```javascript
import NotificationPermissionPrompt from './components/NotificationPermissionPrompt';

function DashboardLayout() {
  return (
    <div>
      {/* Your layout */}
      <NotificationPermissionPrompt />
    </div>
  );
}
```

## Usage Examples

### Sending Notifications

#### 1. Send to Specific User(s)
```javascript
import { useNotifications } from '../context/NotificationContext';

function MyComponent() {
  const { sendNotification } = useNotifications();

  const notifyUser = async () => {
    await sendNotification(
      ['user-id-1', 'user-id-2'], // Array of user IDs
      'New Reservation',
      'Room 101 has been reserved for tonight',
      {
        type: 'info',
        url: '/reservations',
        data: { roomId: '101' }
      }
    );
  };
}
```

#### 2. Send to Department (using SQL function)
```sql
SELECT send_notification_to_department(
  'Housekeeping',
  'Room Cleaning Required',
  'Room 205 needs immediate cleaning',
  'warning',
  '{"room": "205"}'::jsonb,
  '/tasks'
);
```

#### 3. Send to Role (using SQL function)
```sql
SELECT send_notification_to_role(
  'manager',
  'Daily Report Ready',
  'Your daily performance report is now available',
  'success',
  '{}'::jsonb,
  '/reports'
);
```

### Showing Local Notifications

```javascript
import { useNotifications } from '../context/NotificationContext';

function MyComponent() {
  const { showNotification } = useNotifications();

  const showAlert = async () => {
    await showNotification('Task Completed', {
      body: 'Room cleaning has been marked as complete',
      icon: '/logo192.png',
      tag: 'task-complete',
      requireInteraction: false
    });
  };
}
```

### Listening to Notifications

```javascript
import { useNotifications } from '../context/NotificationContext';
import { useEffect } from 'react';

function MyComponent() {
  const { notifications, unreadCount } = useNotifications();

  useEffect(() => {
    console.log(`You have ${unreadCount} unread notifications`);
  }, [unreadCount]);

  return (
    <div>
      {notifications.map(notification => (
        <div key={notification.id}>
          <h4>{notification.title}</h4>
          <p>{notification.body}</p>
        </div>
      ))}
    </div>
  );
}
```

## Notification Types

| Type | Color | Use Case |
|------|-------|----------|
| **info** | Blue | General information, updates |
| **success** | Green | Successful operations, completions |
| **warning** | Amber | Warnings, attention needed |
| **error** | Red | Errors, critical issues |

## Notification Flow

### 1. User Enables Notifications
```
User clicks "Enable Notifications"
  ↓
Request permission from browser
  ↓
Permission granted
  ↓
Subscribe to push notifications
  ↓
Save subscription to database
  ↓
Listen for real-time notifications
```

### 2. Sending a Notification
```
Event occurs (new reservation, task assigned, etc.)
  ↓
Insert notification into database
  ↓
Supabase real-time triggers
  ↓
NotificationContext receives update
  ↓
Show local notification via Service Worker
  ↓
Update UI (bell icon, unread count)
```

### 3. User Interacts with Notification
```
User clicks notification
  ↓
Service Worker handles click
  ↓
Navigate to notification URL
  ↓
Mark notification as read
  ↓
Update unread count
```

## Mobile PWA Setup

### iOS (iPhone/iPad)
1. Open Safari and navigate to your hotel management system
2. Tap the Share button (square with arrow)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add"
5. Open the app from home screen
6. Grant notification permission when prompted

**Note**: iOS has limitations with web push notifications. For full push support on iOS, consider:
- Using Safari 16.4+ (iOS 16.4+)
- Ensuring HTTPS is enabled
- Users must add to home screen first

### Android
1. Open Chrome and navigate to your hotel management system
2. Tap the menu (three dots)
3. Tap "Add to Home screen" or "Install app"
4. Tap "Install"
5. Open the app from home screen
6. Grant notification permission when prompted

## Testing Notifications

### Test in Browser Console
```javascript
// Show a test notification
if ('serviceWorker' in navigator && 'Notification' in window) {
  Notification.requestPermission().then(permission => {
    if (permission === 'granted') {
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification('Test Notification', {
          body: 'This is a test notification',
          icon: '/logo192.png',
          badge: '/logo192.png',
          vibrate: [200, 100, 200]
        });
      });
    }
  });
}
```

### Test via Supabase
```sql
-- Send test notification to yourself
INSERT INTO notifications (user_id, title, body, type, url)
VALUES (
  'your-user-id',
  'Test Notification',
  'This is a test notification from Supabase',
  'info',
  '/dashboard'
);
```

## Troubleshooting

### Notifications Not Showing

**Issue**: Permission denied
- **Solution**: Check browser settings → Site settings → Notifications
- Reset permission and request again

**Issue**: Service worker not registered
- **Solution**: Check browser console for errors
- Ensure `/service-worker.js` is accessible
- Clear cache and reload

**Issue**: Notifications not appearing on mobile
- **Solution**: 
  - Ensure app is installed to home screen
  - Check device notification settings
  - Verify HTTPS is enabled
  - For iOS, ensure iOS 16.4+ and Safari

### Database Issues

**Issue**: RLS policies blocking notifications
- **Solution**: Verify user is authenticated
- Check user_id matches auth.uid()
- Review RLS policies in Supabase

**Issue**: Notifications not real-time
- **Solution**: Check Supabase real-time is enabled
- Verify channel subscription is active
- Check network connection

## Security Considerations

### 1. Row Level Security (RLS)
- All notification tables have RLS enabled
- Users can only access their own notifications
- Push subscriptions are user-specific

### 2. VAPID Keys (Production)
For production push notifications, generate VAPID keys:

```bash
npx web-push generate-vapid-keys
```

Add to `.env`:
```
REACT_APP_VAPID_PUBLIC_KEY=your-public-key
REACT_APP_VAPID_PRIVATE_KEY=your-private-key
```

### 3. HTTPS Required
- Push notifications require HTTPS
- Localhost works for development
- Production must use SSL certificate

## Performance Optimization

### 1. Notification Cleanup
Automatically clean old read notifications:

```sql
-- Run daily via cron job
SELECT clean_old_notifications();
```

### 2. Limit Notification History
```javascript
// Load only recent notifications
const notifications = await getUserNotifications(userId, 50);
```

### 3. Batch Notifications
```javascript
// Send to multiple users at once
await sendNotification(
  [userId1, userId2, userId3],
  title,
  body,
  options
);
```

## Browser Support

| Browser | Desktop | Mobile | Push Notifications |
|---------|---------|--------|-------------------|
| Chrome | ✅ | ✅ | ✅ |
| Firefox | ✅ | ✅ | ✅ |
| Safari | ✅ | ✅ (16.4+) | ✅ (16.4+) |
| Edge | ✅ | ✅ | ✅ |
| Opera | ✅ | ✅ | ✅ |

## Future Enhancements

### Planned Features
1. **Rich Notifications**
   - Images and action buttons
   - Custom notification sounds
   - Priority levels

2. **Notification Preferences**
   - User settings for notification types
   - Quiet hours
   - Channel subscriptions

3. **Analytics**
   - Notification delivery rates
   - Click-through rates
   - User engagement metrics

4. **Advanced Features**
   - Scheduled notifications
   - Recurring notifications
   - Notification templates

## Support

For issues or questions:
1. Check browser console for errors
2. Verify database tables and RLS policies
3. Test notification permissions
4. Check service worker registration
5. Review Supabase real-time logs

## Version History

- **v1.0** (Current)
  - Initial implementation
  - Basic push notification support
  - Real-time notifications via Supabase
  - Notification bell UI
  - Permission prompt
  - Database integration
