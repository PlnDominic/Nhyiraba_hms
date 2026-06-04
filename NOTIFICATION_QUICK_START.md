# PWA Notification System - Quick Start Guide

## 🚀 5-Minute Setup

### Step 1: Database Setup (2 minutes)
1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy and paste contents of `notifications_migration.sql`
4. Click "Run"
5. Verify tables created: `notifications` and `push_subscriptions`

### Step 2: Integrate into App (2 minutes)

#### Update `App.js`:
```javascript
import { NotificationProvider } from './context/NotificationContext';

function App() {
  return (
    <NotificationProvider>
      {/* Your existing app code */}
    </NotificationProvider>
  );
}
```

#### Update your Navbar/Header component:
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

#### Update your DashboardLayout:
```javascript
import NotificationPermissionPrompt from './components/NotificationPermissionPrompt';

function DashboardLayout({ children }) {
  return (
    <div>
      {children}
      <NotificationPermissionPrompt />
    </div>
  );
}
```

### Step 3: Test (1 minute)

#### Test in Browser Console:
```javascript
// Send a test notification
const { data, error } = await supabase
  .from('notifications')
  .insert({
    user_id: 'your-user-id', // Replace with actual user ID
    title: 'Test Notification',
    body: 'This is a test!',
    type: 'info',
    url: '/dashboard'
  });
```

## 📱 Mobile Testing

### iOS (iPhone/iPad)
1. Open Safari → Navigate to your app
2. Tap Share button → "Add to Home Screen"
3. Open app from home screen
4. Allow notifications when prompted

### Android
1. Open Chrome → Navigate to your app
2. Tap menu → "Install app"
3. Open app from home screen
4. Allow notifications when prompted

## 💡 Common Use Cases

### 1. New Reservation Notification
```javascript
import { notifyNewReservation } from './utils/notificationHelpers';

// When a new reservation is created
await notifyNewReservation({
  id: reservation.id,
  roomNumber: '101',
  guestName: 'John Doe'
});
```

### 2. Task Assignment Notification
```javascript
import { notifyNewTask } from './utils/notificationHelpers';

// When assigning a task to staff
await notifyNewTask(
  {
    id: task.id,
    description: 'Clean room',
    room: '205',
    priority: 'High'
  },
  staffUserId
);
```

### 3. Low Stock Alert
```javascript
import { notifyLowStock } from './utils/notificationHelpers';

// When inventory is low
await notifyLowStock('Towels', 5, 20);
```

### 4. Custom Notification
```javascript
import { useNotifications } from './context/NotificationContext';

function MyComponent() {
  const { sendNotification } = useNotifications();

  const sendCustomNotification = async () => {
    await sendNotification(
      ['user-id-1', 'user-id-2'], // Array of user IDs
      'Custom Title',
      'Custom message body',
      {
        type: 'success', // info, success, warning, error
        url: '/custom-page',
        data: { customField: 'value' }
      }
    );
  };
}
```

## 🔔 Notification Types

| Type | Icon | Color | Use For |
|------|------|-------|---------|
| `info` | ℹ️ | Blue | General updates, new items |
| `success` | ✅ | Green | Completions, approvals |
| `warning` | ⚠️ | Amber | Alerts, attention needed |
| `error` | ❌ | Red | Errors, critical issues |

## 🎯 Department Notifications

Send to entire department:
```sql
SELECT send_notification_to_department(
  'Housekeeping',
  'Department Meeting',
  'Team meeting at 3 PM in conference room',
  'info',
  '{}'::jsonb,
  '/dashboard'
);
```

## 👥 Role-Based Notifications

Send to all managers:
```sql
SELECT send_notification_to_role(
  'manager',
  'Daily Report Ready',
  'Your daily performance report is available',
  'success',
  '{}'::jsonb,
  '/reports'
);
```

## 🛠️ Troubleshooting

### Notifications not showing?
1. Check browser console for errors
2. Verify service worker is registered
3. Check notification permission (should be "granted")
4. Ensure HTTPS is enabled (or localhost for dev)

### Permission denied?
1. Go to browser settings
2. Find site settings
3. Reset notification permission
4. Refresh page and try again

### Not working on mobile?
1. Ensure app is installed to home screen
2. Check device notification settings
3. For iOS: Requires iOS 16.4+ and Safari
4. For Android: Should work on all modern versions

## 📊 Check Notification Status

```javascript
import { useNotifications } from './context/NotificationContext';

function NotificationStatus() {
  const { permission, isSupported, unreadCount } = useNotifications();

  return (
    <div>
      <p>Supported: {isSupported ? 'Yes' : 'No'}</p>
      <p>Permission: {permission}</p>
      <p>Unread: {unreadCount}</p>
    </div>
  );
}
```

## 🔐 Production Checklist

- [ ] Run database migration
- [ ] Integrate NotificationProvider
- [ ] Add NotificationBell to UI
- [ ] Add permission prompt
- [ ] Test on desktop browser
- [ ] Test on iOS device
- [ ] Test on Android device
- [ ] Generate VAPID keys (for production push)
- [ ] Enable HTTPS
- [ ] Test real-time updates
- [ ] Configure notification cleanup job

## 📚 Full Documentation

For complete documentation, see:
- `NOTIFICATION_SYSTEM_SETUP.md` - Complete setup guide
- `notifications_migration.sql` - Database schema
- `client/src/utils/notificationHelpers.js` - Helper functions

## 🆘 Need Help?

1. Check browser console for errors
2. Review `NOTIFICATION_SYSTEM_SETUP.md`
3. Test with browser console commands
4. Verify database tables and RLS policies
5. Check Supabase real-time logs

## 🎉 You're Done!

Your PWA now has full notification support! Staff can receive real-time updates on their phones.
