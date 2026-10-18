// Registers the service worker (production builds only) and tells the UI when an update is waiting.
import { setState } from './state';

let waitingWorker = null;

const announce = (worker) => {
  waitingWorker = worker;
  setState({ updateAvailable: true });
};

/** The user chose "Reload": let the waiting worker take over (the page reloads on controllerchange). */
export const applyUpdate = () => {
  if (waitingWorker) waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  else window.location.reload();
};

export const registerServiceWorker = () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return;

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(`${process.env.PUBLIC_URL}/service-worker.js`);
      const hadController = Boolean(navigator.serviceWorker.controller); // false on the very first visit

      if (registration.waiting && hadController) announce(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) announce(installing);
        });
      });

      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || reloading) return; // first install claims the page: no reload needed
        reloading = true;
        window.location.reload();
      });

      const check = () => registration.update().catch(() => {});
      window.setInterval(check, 60 * 60 * 1000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    } catch (error) {
      console.error('Service worker registration failed:', error);
    }
  });
};
