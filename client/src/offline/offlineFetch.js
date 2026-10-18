// A drop-in `fetch` for the Supabase client that makes the app usable without a connection.
//
//  GET   online : forwarded, response copied to the device for later
//        offline: answered from the device (exact response, else filtered from the table mirror)
//  POST/PATCH/PUT/DELETE
//        online : forwarded (and the device copy updated)
//        offline: stored in a queue and answered as if it had succeeded; cached rows are updated
//                 so the user sees their own changes. The queue is replayed by sync.js.
//  Everything else (auth, storage, functions, rpc) is forwarded untouched.
import * as cache from './cache';
import { isIdbAvailable } from './idb';
import { idKindFor, tempId, uuid } from './ids';
import { getCurrentUserId } from './identity';
import { affectedRows, applyToCaches } from './localStore';
import {
  contentRange,
  errorResponse,
  isFullTableQuery,
  jsonResponse,
  parseRestRequest,
  parseSelect,
  preferTokens,
  projectRow,
  queryRows,
  rowsFromBody,
  wantsSingleObject
} from './postgrest';
import * as queue from './queue';
import { getState, isOffline, setState } from './state';

const READ_TIMEOUT_MS = 8000;
const WRITE_TIMEOUT_MS = 20000;
const KEEP_HEADERS = ['content-type', 'prefer', 'accept', 'accept-profile', 'content-profile', 'range', 'range-unit'];

const isNetworkError = (error) => error && (error.name === 'TypeError' || error.name === 'AbortError' || /network|fetch|load failed/i.test(error.message || ''));

const OFFLINE_MESSAGE = "You're offline and this data hasn't been saved on this device yet.";

export const createOfflineFetch = ({ baseFetch, restBase, onQueueChanged = () => {} }) => {
  const markOffline = () => setState({ forcedOffline: true });
  const markOnline = () => { if (getState().forcedOffline) setState({ forcedOffline: false }); };

  const withTimeout = async (url, init, ms) => {
    const controller = new AbortController();
    const outer = init?.signal;
    if (outer) {
      if (outer.aborted) controller.abort();
      else outer.addEventListener('abort', () => controller.abort(), { once: true });
    }
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      return await baseFetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };

  // ------------------------------------------------------------------ reads
  const rememberRead = async (userId, url, req, single, res) => {
    try {
      const text = await res.text();
      await cache.saveRead(userId, req.table, url, single, { status: res.status, body: text, contentRange: res.headers.get('content-range') });
      const parsed = JSON.parse(text);
      const rows = single ? [parsed] : parsed;
      if (Array.isArray(rows) && rows.every((r) => r && typeof r === 'object') && parseSelect(req.params.get('select')).all) {
        await cache.mergeIntoMirror(userId, req.table, rows, !single && isFullTableQuery(req.params));
      }
    } catch (e) { /* caching is best-effort */ }
  };

  const readResponse = ({ rows, total, single, count, head, source }) => {
    const extra = { 'X-Offline-Source': source };
    if (single) {
      if (rows.length !== 1) return errorResponse(406, 'PGRST116', 'JSON object requested, multiple (or no) rows returned', `The result contains ${rows.length} rows`);
      return jsonResponse(rows[0], { headers: extra });
    }
    const headers = count ? { ...extra, 'Content-Range': contentRange(rows.length, total) } : extra;
    return head ? new Response(null, { status: 200, headers }) : jsonResponse(rows, { headers });
  };

  const serveFromDevice = async (url, init, req) => {
    const userId = getCurrentUserId();
    const headers = new Headers(init?.headers);
    const single = wantsSingleObject(headers);
    const count = preferTokens(headers).count;
    const head = (init?.method || 'GET').toUpperCase() === 'HEAD';

    const exact = await cache.loadRead(userId, url, single);
    if (exact) {
      const body = JSON.parse(exact.body);
      const rows = single ? [body] : body;
      const total = Number(String(exact.contentRange || '').split('/')[1]) || rows.length;
      return readResponse({ rows, total, single, count, head, source: 'exact' });
    }

    const mirror = await cache.loadMirror(userId, req.table);
    if (mirror) {
      const result = queryRows(mirror.rows, req.params);
      if (result.supported) return readResponse({ rows: result.rows, total: result.total, single, count, head, source: 'mirror' });
    }
    return errorResponse(503, 'OFFLINE', OFFLINE_MESSAGE);
  };

  const handleRead = async (url, init, req) => {
    const userId = getCurrentUserId();
    if (!isOffline()) {
      try {
        const res = await withTimeout(url, init, READ_TIMEOUT_MS);
        markOnline();
        const method = (init?.method || 'GET').toUpperCase();
        if (res.ok && method === 'GET') {
          const single = wantsSingleObject(new Headers(init?.headers));
          rememberRead(userId, url, req, single, res.clone());
        }
        return res;
      } catch (error) {
        if (init?.signal?.aborted || !isNetworkError(error)) throw error;
        markOffline();
      }
    }
    return serveFromDevice(url, init, req);
  };

  // ----------------------------------------------------------------- writes
  const synthesize = ({ method, rows, affected, prefer, single, params }) => {
    const wantsRows = prefer.return === 'representation';
    const created = method === 'POST' || method === 'PUT';
    if (!wantsRows) return new Response(null, { status: created ? 201 : 204 });
    const select = parseSelect(params.get('select'));
    const projection = select.supported ? select : { all: true };
    const out = (created ? rows : affected).map((r) => projectRow(r, projection));
    if (single) {
      if (out.length !== 1) return errorResponse(406, 'PGRST116', 'JSON object requested, multiple (or no) rows returned', `The result contains ${out.length} rows`);
      return jsonResponse(out[0], { status: created ? 201 : 200 });
    }
    return jsonResponse(out, { status: created ? 201 : 200 });
  };

  const enqueue = async (url, init, req, method) => {
    const userId = getCurrentUserId();
    const headers = new Headers(init?.headers);
    const prefer = preferTokens(headers);
    const single = wantsSingleObject(headers);
    const bodyText = typeof init?.body === 'string' ? init.body : null;

    let body = bodyText;
    const tempIds = [];
    if ((method === 'POST' || method === 'PUT') && bodyText) {
      const parsed = JSON.parse(bodyText);
      const mirror = await cache.loadMirror(userId, req.table);
      const kind = idKindFor(req.table, mirror?.rows || []);
      const keyed = Boolean(req.params.get('on_conflict')); // upserts on other columns do not need an invented id
      const give = (row, index) => {
        if (!row || typeof row !== 'object' || (row.id !== undefined && row.id !== null) || keyed) return row;
        if (kind === 'uuid') return { ...row, id: uuid() };
        if (kind === 'number') { const id = tempId(); tempIds.push({ index, id }); return { ...row, id }; }
        return row;
      };
      body = JSON.stringify(Array.isArray(parsed) ? parsed.map(give) : give(parsed, 0));
    }

    const mutation = { method, params: req.params, body, prefer };
    const affected = await affectedRows(userId, req.table, mutation);

    const entry = await queue.addEntry({
      kind: 'rest',
      userId,
      method,
      url,
      table: req.table,
      headers: Object.fromEntries(KEEP_HEADERS.filter((h) => headers.has(h)).map((h) => [h, headers.get(h)])),
      body,
      tempIds
    });

    await applyToCaches(userId, req.table, mutation);
    await onQueueChanged(entry);

    return synthesize({ method, rows: rowsFromBody(body), affected, prefer, single, params: req.params });
  };

  const rememberOnlineWrite = async (url, init, req, method, res) => {
    try {
      const userId = getCurrentUserId();
      const headers = new Headers(init?.headers);
      const prefer = preferTokens(headers);
      let body = typeof init?.body === 'string' ? init.body : null;
      if ((method === 'POST' || method === 'PUT') && prefer.return === 'representation') {
        body = await res.clone().text(); // the server's rows carry real ids and defaults
      }
      await applyToCaches(userId, req.table, { method, params: req.params, body, prefer });
    } catch (e) { /* best-effort */ }
  };

  const handleWrite = async (url, init, req) => {
    const method = (init?.method || 'POST').toUpperCase();
    if (req.isRpc) {
      if (isOffline()) return errorResponse(503, 'OFFLINE', 'This action needs an internet connection.');
      return baseFetch(url, init);
    }

    // keep strict ordering: if earlier changes are still waiting, new ones line up behind them
    const waiting = getState().queued > 0;
    if (!isOffline() && !waiting) {
      try {
        const res = await withTimeout(url, init, WRITE_TIMEOUT_MS);
        markOnline();
        if (res.ok) rememberOnlineWrite(url, init, req, method, res);
        return res;
      } catch (error) {
        if (init?.signal?.aborted || !isNetworkError(error)) throw error;
        markOffline();
      }
    }
    return enqueue(url, init, req, method);
  };

  // ------------------------------------------------------------------ entry
  return async (input, init) => {
    if (typeof input !== 'string' || !isIdbAvailable()) return baseFetch(input, init);
    const req = parseRestRequest(input, restBase);
    if (!req) return baseFetch(input, init);

    const method = (init?.method || 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD') {
      if (req.isRpc) {
        if (isOffline()) return errorResponse(503, 'OFFLINE', 'This action needs an internet connection.');
        return baseFetch(input, init);
      }
      return handleRead(input, init, req);
    }
    return handleWrite(input, init, req);
  };
};

