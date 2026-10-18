// Replays the offline queue against the server, oldest change first.
//
//  * runs when the browser comes back online, when the tab becomes visible, and on a timer
//  * only one tab replays at a time (Web Locks) so a change is never sent twice
//  * numeric temporary ids are swapped for the real ones as rows are created, and later queued
//    changes that mention them are rewritten before they are sent
//  * outcomes: success -> removed; network/5xx -> retry later with backoff (order is preserved);
//    data conflict or rejection -> kept for the user to Retry or Discard; 401 -> paused until sign-in
import * as cache from './cache';
import { API_BASE_URL } from './config';
import { getCurrentUserId } from './identity';
import { isTempId } from './ids';
import * as queue from './queue';
import { getState, isOffline, setState } from './state';

const POLL_MS = 20000;

let config = null;
let running = false;
let retryTimer = null;
let channel = null;

export const configureSync = (next) => { config = next; };

const friendly = (status, err) => {
  if (err.code === '23P01') return 'Another booking took this room for those dates while you were offline.';
  if (err.code === '23503') return 'A record this change depends on no longer exists.';
  if (err.code === '23505') return 'A record with the same unique value already exists.';
  if (err.code === '42501' || status === 403) return 'You no longer have permission to make this change.';
  return err.message || `The server rejected this change (HTTP ${status}).`;
};

const readError = async (res) => {
  try {
    const body = await res.clone().json();
    return { code: body.code || null, message: body.message || body.error || res.statusText, details: body.details || '' };
  } catch (e) {
    return { code: null, message: res.statusText || '', details: '' };
  }
};

export const refreshCounts = async () => {
  try {
    const { pending, needsAttention } = await queue.countEntries(getCurrentUserId());
    setState({ queued: pending, needsAttention });
    if (channel) channel.postMessage('queue-changed');
  } catch (e) { /* IndexedDB unavailable */ }
};

const stripTempIds = (body) => {
  const parsed = JSON.parse(body);
  const clean = (row) => {
    if (row && typeof row === 'object' && isTempId(row.id)) { const { id, ...rest } = row; return rest; }
    return row;
  };
  return JSON.stringify(Array.isArray(parsed) ? parsed.map(clean) : clean(parsed));
};

const withRepresentation = (headers) => {
  const tokens = (headers.get('prefer') || '').split(',').map((t) => t.trim()).filter((t) => t && !t.startsWith('return='));
  headers.set('prefer', [...tokens, 'return=representation'].join(','));
};

const buildRestRequest = (entry, token) => {
  const headers = new Headers(entry.headers);
  headers.set('apikey', config.anonKey);
  headers.set('Authorization', `Bearer ${token}`);
  let { body } = entry;
  if (entry.tempIds?.length && body) {
    body = stripTempIds(body);
    withRepresentation(headers); // we need the real ids back
  }
  return { method: entry.method, headers, body: body || undefined };
};

// After a numeric-id row is created, later queued changes may still refer to its temporary id.
const rewriteTempIds = async (userId, mapping) => {
  const entries = await queue.listEntries(userId);
  for (const entry of entries) {
    let { url, body } = entry;
    let changed = false;
    Object.entries(mapping).forEach(([temp, real]) => {
      if (url.includes(temp)) { url = url.split(temp).join(String(real)); changed = true; }
      if (body && body.includes(temp)) { body = body.split(temp).join(String(real)); changed = true; }
    });
    if (changed) await queue.updateEntry(entry.id, { url, body });
  }
};

// Returns { outcome: 'done'|'retry'|'conflict'|'failed'|'auth', error? }
const sendRest = async (entry, token) => {
  let res;
  try {
    res = await config.baseFetch(entry.url, buildRestRequest(entry, token));
  } catch (e) {
    return { outcome: 'retry', error: 'No connection' };
  }
  if (res.ok) {
    if (entry.tempIds?.length) {
      const rows = await res.json().catch(() => []);
      const mapping = {};
      entry.tempIds.forEach(({ index, id }) => { if (rows[index]?.id !== undefined) mapping[String(id)] = rows[index].id; });
      await rewriteTempIds(entry.userId, mapping);
    }
    return { outcome: 'done' };
  }
  if (res.status === 401) return { outcome: 'auth' };
  const err = await readError(res);
  // A replayed insert whose client-generated id already exists means the first attempt got through
  if (res.status === 409 && err.code === '23505' && entry.method === 'POST' && /Key \(id\)=/.test(err.details || '')) return { outcome: 'done' };
  if (res.status >= 500 || res.status === 429 || res.status === 408) return { outcome: 'retry', error: err.message };
  if (res.status === 409 || err.code === '23503') return { outcome: 'conflict', error: friendly(res.status, err) };
  return { outcome: 'failed', error: friendly(res.status, err) };
};

const sendSms = async (entry, token) => {
  if (Date.now() > entry.expiresAt) return { outcome: 'failed', error: 'Not sent: the message was too old to deliver when the connection returned.' };
  let res;
  try {
    res = await config.baseFetch(`${API_BASE_URL}/sms/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ event: entry.event, phone: entry.phone, data: entry.data })
    });
  } catch (e) {
    return { outcome: 'retry', error: 'No connection' };
  }
  if (res.ok) return { outcome: 'done' };
  if (res.status === 401) return { outcome: 'auth' };
  if (res.status >= 500 || res.status === 429) return { outcome: 'retry', error: 'The SMS service is busy' };
  const err = await readError(res);
  return { outcome: 'failed', error: err.message || 'The SMS could not be sent' };
};

const backoff = (attempts) => Math.min(60000, 2000 * 2 ** Math.min(attempts, 5));

const runFlush = async () => {
  const userId = getCurrentUserId();
  if (userId === 'anon') return;
  let token = await config.getAccessToken();
  if (!token) { setState({ authRequired: true }); return; }

  let refreshedOnce = false;
  let progressed = false;
  const tablesTouched = new Set();

  for (;;) {
    const entries = (await queue.listEntries(userId)).filter((e) => e.status === 'pending');
    const entry = entries[0];
    if (!entry) break;
    if (entry.nextAttemptAt && entry.nextAttemptAt > Date.now()) break;

    // eslint-disable-next-line no-await-in-loop
    const result = entry.kind === 'sms' ? await sendSms(entry, token) : await sendRest(entry, token);

    if (result.outcome === 'auth') {
      const fresh = refreshedOnce ? null : await config.refreshAccessToken();
      refreshedOnce = true;
      if (fresh) { token = fresh; continue; }
      setState({ authRequired: true });
      break;
    }
    setState({ authRequired: false });

    if (result.outcome === 'done') {
      await queue.removeEntry(entry.id);
      progressed = true;
      if (entry.table) tablesTouched.add(entry.table);
    } else if (result.outcome === 'retry') {
      const attempts = (entry.attempts || 0) + 1;
      await queue.updateEntry(entry.id, { attempts, error: result.error, nextAttemptAt: Date.now() + backoff(attempts) });
      if (result.error === 'No connection') setState({ forcedOffline: true });
      break; // keep order: nothing after this may overtake it
    } else {
      await queue.updateEntry(entry.id, { status: result.outcome, error: result.error });
      if (entry.table) await cache.invalidateTable(userId, entry.table); // drop optimistic rows the server refused
      progressed = true;
      if (entry.table) tablesTouched.add(entry.table);
    }
  }

  if (progressed) {
    setState({ lastSyncAt: Date.now() });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hms-data-synced', { detail: { tables: [...tablesTouched] } }));
    }
  }
};

export const flush = async () => {
  if (!config || running) return;
  if (isOffline() && !(await probe())) return;
  running = true;
  setState({ syncing: true });
  try {
    const locked = typeof navigator !== 'undefined' && navigator.locks
      ? await navigator.locks.request('hms-offline-sync', { ifAvailable: true }, async (lock) => { if (!lock) return false; await runFlush(); return true; })
      : (await runFlush(), true);
    if (!locked) return; // another tab is syncing
  } catch (e) {
    console.warn('Offline sync failed:', e);
  } finally {
    running = false;
    setState({ syncing: false });
    await refreshCounts();
    scheduleRetry();
  }
};

/** Is the server reachable? (navigator.onLine can say yes on a dead network.) */
export const probe = async () => {
  if (!config) return !isOffline();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    await config.baseFetch(`${config.supabaseUrl}/auth/v1/health`, { headers: { apikey: config.anonKey }, cache: 'no-store', signal: controller.signal });
    setState({ forcedOffline: false, online: true });
    return true;
  } catch (e) {
    setState({ forcedOffline: true });
    return false;
  } finally {
    clearTimeout(timer);
  }
};

function scheduleRetry() {
  clearTimeout(retryTimer);
  retryTimer = null;
  if (getState().queued > 0 || getState().forcedOffline) {
    retryTimer = setTimeout(() => flush(), 5000);
  }
}

export const flushSoon = () => { if (!isOffline()) setTimeout(() => flush(), 50); else scheduleRetry(); };

// ---- user actions on entries that need attention -------------------------------------------
export const retryEntry = async (id) => {
  await queue.updateEntry(id, { status: 'pending', error: null, attempts: 0, nextAttemptAt: null });
  await refreshCounts();
  flush();
};

export const discardEntry = async (id) => {
  const entry = await queue.getEntry(id);
  await queue.removeEntry(id);
  if (entry?.table) await cache.invalidateTable(entry.userId, entry.table);
  await refreshCounts();
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('hms-data-synced', { detail: { tables: entry?.table ? [entry.table] : [] } }));
};

export const listNeedsAttention = async () => (await queue.listEntries(getCurrentUserId())).filter((e) => e.status !== 'pending');

// ---- lifecycle ---------------------------------------------------------------------------
let started = false;
export const startSyncEngine = () => {
  if (started || typeof window === 'undefined') return;
  started = true;
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel('hms-offline');
    channel.onmessage = () => { queue.countEntries(getCurrentUserId()).then(({ pending, needsAttention }) => setState({ queued: pending, needsAttention })); };
  }
  window.addEventListener('online', () => { setState({ online: true, forcedOffline: false }); flush(); });
  window.addEventListener('offline', () => setState({ online: false }));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') flush(); });
  window.setInterval(() => { if (getState().queued > 0 || getState().forcedOffline) flush(); }, POLL_MS);
  navigator.serviceWorker?.addEventListener('message', (event) => { if (event.data?.type === 'FLUSH_QUEUE') flush(); });
  refreshCounts().then(() => { if (getState().queued > 0) flush(); });
};

export const _resetForTests = () => { config = null; running = false; started = false; clearTimeout(retryTimer); channel = null; };
