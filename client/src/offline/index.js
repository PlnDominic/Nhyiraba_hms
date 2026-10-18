// Public surface of the offline layer.
import { clearReadCache } from './cache';
import { getCurrentUserId } from './identity';
import * as queue from './queue';
import { createOfflineFetch } from './offlineFetch';
import { getState, setState, subscribe } from './state';
import { configureSync, discardEntry, flush, flushSoon, listNeedsAttention, refreshCounts, retryEntry, startSyncEngine } from './sync';

const SMS_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/**
 * Wrap the Supabase fetch and start syncing. Called once from supabaseClient.js.
 *  baseFetch    the fetch the Supabase client used before (logging, 401 refresh)
 *  rawFetch     plain network fetch used to replay queued changes
 *  getSupabase  () => the Supabase client (created after this call, hence lazy)
 */
export const initOffline = ({ baseFetch, rawFetch, supabaseUrl, anonKey, getSupabase }) => {
  configureSync({
    baseFetch: rawFetch,
    supabaseUrl,
    anonKey,
    getAccessToken: async () => (await getSupabase().auth.getSession())?.data?.session?.access_token || null,
    refreshAccessToken: async () => (await getSupabase().auth.refreshSession())?.data?.session?.access_token || null
  });
  const offlineFetch = createOfflineFetch({
    baseFetch,
    restBase: `${supabaseUrl}/rest/v1/`,
    onQueueChanged: async () => { await refreshCounts(); flushSoon(); }
  });
  if (typeof window !== 'undefined') startSyncEngine();
  return offlineFetch;
};

/** Queue an SMS for when the connection returns (sent through the app's own API). */
export const enqueueSms = async (event, phone, data) => {
  await queue.addEntry({
    kind: 'sms',
    userId: getCurrentUserId(),
    event,
    phone,
    data,
    expiresAt: Date.now() + SMS_MAX_AGE_MS
  });
  await refreshCounts();
  flushSoon();
};

export { discardEntry, flush as flushNow, getState as getOfflineState, listNeedsAttention, retryEntry, setState as setOfflineState, subscribe as subscribeOffline };

/** Called on sign-out: forget cached data (privacy on shared computers). Unsynced changes are kept. */
export const clearOfflineData = () => clearReadCache().catch(() => {});

export const unsyncedCount = async () => (await queue.countEntries(getCurrentUserId())).pending;
