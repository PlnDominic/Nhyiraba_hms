/* eslint-disable no-restricted-globals */
// Service worker for Nhyiraba HMS.
//
// Offline strategy
//  * App shell: every file of the production build is precached (the build injects the list as
//    self.__WB_MANIFEST) and any page navigation falls back to the cached index.html, so the
//    React app starts without a network.
//  * Data: NOT handled here. Supabase reads/writes go through the offline layer in the page
//    (src/offline), which needs the user's session to replay queued changes.
//  * Updates: a new version waits until the user clicks "Reload" (an immediate swap could pull the
//    old build's lazy-loaded files out from under open tabs).
import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate } from 'workbox-strategies';

clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Single-page app: every navigation (that is not a file) is answered with the cached shell
const fileExtension = /[^/?]+\.[^/]+$/;
registerRoute(
  ({ request, url }) => request.mode === 'navigate'
    && !url.pathname.startsWith('/_')
    && !url.pathname.startsWith('/api/')
    && !fileExtension.test(url.pathname),
  createHandlerBoundToURL(`${process.env.PUBLIC_URL}/index.html`)
);

// Images that are not part of the build (uploads, hero pictures)
registerRoute(
  ({ url }) => url.origin === self.location.origin && /\.(?:png|jpe?g|gif|svg|webp|ico)$/i.test(url.pathname),
  new StaleWhileRevalidate({ cacheName: 'hms-images', plugins: [new ExpirationPlugin({ maxEntries: 80 })] })
);

// Fonts / icon CSS from CDNs so the UI keeps its look offline
registerRoute(
  ({ url }) => ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com'].includes(url.hostname),
  new StaleWhileRevalidate({ cacheName: 'hms-cdn', plugins: [new ExpirationPlugin({ maxEntries: 40 })] })
);

// ---------------------------------------------------------------------------
// Messages from the page
// ---------------------------------------------------------------------------
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options = {} } = event.data;
    self.registration.showNotification(title, {
      ...options,
      icon: options.icon || '/logo192.png',
      badge: options.badge || '/logo192.png'
    });
  }
});

// ---------------------------------------------------------------------------
// Background sync: wake any open tab so it replays the offline queue
// (the page holds the session needed to authenticate the replay)
// ---------------------------------------------------------------------------
self.addEventListener('sync', (event) => {
  if (event.tag === 'hms-sync' || event.tag === 'sync-data') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((windows) => windows.forEach((client) => client.postMessage({ type: 'FLUSH_QUEUE' })))
    );
  }
});

// ---------------------------------------------------------------------------
// Push notifications
// ---------------------------------------------------------------------------
self.addEventListener('push', (event) => {
  let notificationData = {
    title: 'Nhyiraba HMS',
    body: 'You have a new notification',
    icon: '/logo192.png',
    badge: '/logo192.png',
    vibrate: [200, 100, 200],
    tag: 'default',
    requireInteraction: false,
    data: { url: '/' }
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        ...notificationData,
        ...data,
        icon: data.icon || '/logo192.png',
        badge: data.badge || '/logo192.png',
        vibrate: data.vibrate || [200, 100, 200],
        tag: data.tag || 'default',
        requireInteraction: data.requireInteraction || false,
        data: { url: data.url || '/', ...data.data }
      };
    } catch (error) {
      console.error('[Service Worker] Error parsing push data:', error);
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      vibrate: notificationData.vibrate,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      data: notificationData.data,
      actions: notificationData.actions || []
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i += 1) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow ? self.clients.openWindow(urlToOpen) : undefined;
    })
  );
});
