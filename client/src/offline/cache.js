// Device-side copy of what the app has read: exact GET responses plus, per table, a "mirror" of
// the rows seen so far that lets filtered queries be answered offline even if that exact URL was
// never requested before. Everything is scoped to the signed-in user.
import { idbClear, idbDelete, idbGet, idbGetAll, idbPut } from './idb';

const MAX_BODY_CHARS = 4000000;

const readKey = (userId, url, single = false) => `r|${userId}|${single ? 'single' : 'list'}|${url}`;
const mirrorKey = (userId, table) => `m|${userId}|${table}`;

export const saveRead = (userId, table, url, single, { status, body, contentRange }) => {
  if (body.length > MAX_BODY_CHARS) return Promise.resolve();
  return idbPut('reads', { key: readKey(userId, url, single), kind: 'read', userId, table, url, single: Boolean(single), status, body, contentRange: contentRange || null, savedAt: Date.now() });
};

export const loadRead = (userId, url, single = false) => idbGet('reads', readKey(userId, url, single));

export const listReads = async (userId, table) => (await idbGetAll('reads'))
  .filter((e) => e.kind === 'read' && e.userId === userId && e.table === table);

export const deleteRead = (key) => idbDelete('reads', key);

export const loadMirror = (userId, table) => idbGet('reads', mirrorKey(userId, table));

export const saveMirror = (userId, table, rows, complete) => idbPut('reads', {
  key: mirrorKey(userId, table), kind: 'mirror', userId, table, rows, complete: Boolean(complete), savedAt: Date.now()
});

/** Merge rows seen in a (possibly partial) response into the table mirror. */
export const mergeIntoMirror = async (userId, table, rows, complete) => {
  const withIds = rows.filter((r) => r && r.id !== undefined && r.id !== null);
  if (complete) return saveMirror(userId, table, rows, true);
  if (withIds.length === 0) return undefined;
  const existing = await loadMirror(userId, table);
  const byId = new Map((existing?.rows || []).map((r) => [String(r.id), r]));
  withIds.forEach((r) => byId.set(String(r.id), { ...(byId.get(String(r.id)) || {}), ...r }));
  return saveMirror(userId, table, [...byId.values()], existing?.complete && true);
};

/** Forget cached data for a table (used when a queued change was rejected, so no phantom rows linger). */
export const invalidateTable = async (userId, table) => {
  const entries = await idbGetAll('reads');
  await Promise.all(entries
    .filter((e) => e.userId === userId && e.table === table)
    .map((e) => idbDelete('reads', e.key)));
};

export const clearReadCache = () => idbClear('reads');
