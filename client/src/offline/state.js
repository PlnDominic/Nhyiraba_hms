// Observable connection / sync status shared by the fetch layer, the sync engine and the UI.

const initial = () => ({
  online: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  forcedOffline: false,   // a request actually failed even though the browser claims to be online
  queued: 0,              // changes waiting to upload
  needsAttention: 0,      // changes the server rejected (conflict / failed)
  syncing: false,
  lastSyncAt: null,
  authRequired: false,    // queued changes cannot upload until the user signs in again
  updateAvailable: false  // a new app version is waiting
});

let state = initial();
const listeners = new Set();

export const getState = () => state;

export const setState = (patch) => {
  const next = { ...state, ...patch };
  const changed = Object.keys(next).some((k) => next[k] !== state[k]);
  if (!changed) return;
  state = next;
  listeners.forEach((listener) => listener(state));
};

export const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const isOffline = () => state.forcedOffline || (typeof navigator !== 'undefined' && navigator.onLine === false);

export const resetStateForTests = () => { state = initial(); listeners.clear(); };
