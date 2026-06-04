# iOS Notification Setup Guide

## Important iOS Requirements

### iOS Version Requirements
- **iOS 16.4 or later** is required for web push notifications
- Earlier versions of iOS do not support web push notifications
- Check your iPhone settings: Settings → General → About → Software Version

### Safari Requirements
- Must use **Safari browser** (not Chrome or other browsers)
- The app must be **added to the home screen** as a PWA
- Notifications will NOT work in regular Safari browser tab

## Step-by-Step Setup for iPhone

### Step 1: Check iOS Version
1. Open **Settings** app
2. Go to **General** → **About**
3. Check **Software Version**
4. If below iOS 16.4, update your iPhone:
   - Settings → General → Software Update

### Step 2: Install PWA to Home Screen
1. Open **Safari** browser
2. Navigate to your hotel management system URL
3. Tap the **Share** button (square with arrow pointing up)
4. Scroll down and tap **"Add to Home Screen"**
5. Tap **"Add"** in the top right
6. The app icon will appear on your home screen

### Step 3: Open App from Home Screen
1. **Close Safari completely** (swipe up from bottom)
2. Find the app icon on your home screen
3. **Tap the app icon** to open it
4. The app should open in full-screen mode (no Safari UI)

### Step 4: Enable Notifications
1. Wait 3 seconds after opening the app
2. A notification prompt should appear at the bottom
3. Tap **"Enable Notifications"**
4. iOS will show a system permission dialog
5. Tap **"Allow"**

### Step 5: Verify Notifications are Enabled
1. Go to iPhone **Settings**
2. Scroll down to find your app name
3. Tap on it
4. Tap **"Notifications"**
5. Ensure **"Allow Notifications"** is ON

## Troubleshooting

### Prompt Not Showing?

#### Option 1: Clear Cache and Retry
1. Open Safari
2. Tap the book icon (bottom)
3. Tap the clock icon (History)
4. Tap "Clear" at bottom right
5. Select "All time"
6. Tap "Clear History"
7. Re-add app to home screen

#### Option 2: Use Manual Enable Button
1. Open the app
2. Go to **Settings** page
3. Look for **"Notification Settings"** section
4. Tap **"Enable Notifications"** button
5. Allow when iOS prompts

#### Option 3: Check Browser Console
1. Open Safari on your iPhone
2. Go to Settings → Safari → Advanced
3. Enable "Web Inspector"
4. Connect iPhone to Mac
5. Open Safari on Mac → Develop → [Your iPhone] → [Your App]
6. Check console for errors

### Permission Already Denied?

If you previously denied notifications:

1. Go to iPhone **Settings**
2. Scroll down to find your app
3. Tap **"Notifications"**
4. Turn ON **"Allow Notifications"**
5. Refresh the app

### Still Not Working?

#### Check These:
- [ ] iOS version is 16.4 or later
- [ ] Using Safari (not Chrome/Firefox)
- [ ] App is installed to home screen
- [ ] Opening from home screen icon (not Safari)
- [ ] App opens in full-screen (no Safari UI)
- [ ] Waited at least 3 seconds after opening
- [ ] Not in Private Browsing mode
- [ ] HTTPS is enabled (or localhost for dev)

## Testing Notifications on iPhone

### Test 1: Check Support
Open Safari console and run:
```javascript
console.log('Notification' in window); // Should be true
console.log(Notification.permission); // Should be 'default', 'granted', or 'denied'
console.log('serviceWorker' in navigator); // Should be true
```

### Test 2: Manual Permission Request
Add this button to your settings page:
```javascript
<button onClick={async () => {
  const permission = await Notification.requestPermission();
  alert('Permission: ' + permission);
}}>
  Request Permission
</button>
```

### Test 3: Send Test Notification
After permission is granted:
```javascript
new Notification('Test', {
  body: 'This is a test notification',
  icon: '/logo192.png'
});
```

## Common iOS Issues

### Issue 1: "Notification is not defined"
**Cause**: App not installed to home screen or iOS < 16.4
**Solution**: Install to home screen and ensure iOS 16.4+

### Issue 2: Permission prompt never appears
**Cause**: Multiple possible reasons
**Solutions**:
1. Clear Safari cache
2. Remove app from home screen and re-add
3. Check iOS version
4. Use manual enable button in settings

### Issue 3: Notifications work in Safari but not in PWA
**Cause**: Different contexts
**Solution**: Always test in the installed PWA, not Safari browser

### Issue 4: Service Worker not registering
**Cause**: HTTPS not enabled or iOS restrictions
**Solutions**:
1. Ensure HTTPS is enabled
2. Check service worker file is accessible
3. Clear cache and reinstall

## iOS-Specific Limitations

### What Works:
✅ Local notifications (when app is open)
✅ Push notifications (when app is closed)
✅ Notification badges
✅ Notification sounds
✅ Notification actions (tap to open)

### What Doesn't Work:
❌ Notifications in regular Safari browser
❌ Notifications on iOS < 16.4
❌ Rich media in notifications (images)
❌ Custom notification sounds
❌ Notification grouping

## Production Checklist for iOS

- [ ] HTTPS enabled (required for production)
- [ ] Valid SSL certificate
- [ ] Service worker accessible at /service-worker.js
- [ ] Manifest.json properly configured
- [ ] Icons in correct sizes (192x192, 512x512)
- [ ] App name and description set
- [ ] Test on actual iOS device (not simulator)
- [ ] Test with iOS 16.4+
- [ ] Test with iOS 17+ (latest)

## Alternative: Manual Enable Button

If the automatic prompt doesn't work, add this to your Settings page:

```javascript
import { useNotifications } from '../context/NotificationContext';

function NotificationSettings() {
  const { permission, requestPermission, isSupported } = useNotifications();

  if (!isSupported) {
    return (
      <div className="p-4 bg-yellow-100 rounded">
        <p>Notifications are not supported on this device.</p>
        <p>Please ensure you're using iOS 16.4+ and Safari.</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h3>Notification Settings</h3>
      <p>Current permission: {permission}</p>
      
      {permission === 'default' && (
        <button
          onClick={requestPermission}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Enable Notifications
        </button>
      )}
      
      {permission === 'granted' && (
        <p className="text-green-600">✓ Notifications enabled</p>
      )}
      
      {permission === 'denied' && (
        <div className="text-red-600">
          <p>Notifications blocked</p>
          <p>Go to Settings → [App Name] → Notifications to enable</p>
        </div>
      )}
    </div>
  );
}
```

## Quick Debug Commands

Run these in Safari console on iPhone:

```javascript
// Check if notifications are supported
console.log('Supported:', 'Notification' in window);

// Check current permission
console.log('Permission:', Notification.permission);

// Check if service worker is registered
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('Service Workers:', regs.length);
});

// Request permission manually
Notification.requestPermission().then(p => console.log('Result:', p));

// Check if app is in standalone mode (installed to home screen)
console.log('Standalone:', window.navigator.standalone);

// Check iOS version
console.log('User Agent:', navigator.userAgent);
```

## Support Resources

- [Apple Web Push Documentation](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [Can I Use - Web Push](https://caniuse.com/push-api)
- [MDN - Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)

## Need More Help?

1. Check iOS version (must be 16.4+)
2. Verify app is installed to home screen
3. Clear Safari cache and reinstall
4. Use manual enable button in settings
5. Check browser console for errors
6. Test on different iOS device if available
