// Offline write queue (IndexedDB). Entries replay in creation order.
//   status: 'pending'  waiting to upload (or retrying)
//           'conflict' the server refused it because of the data (e.g. room double-booked)
//           'failed'   the server refused it for another reason (permissions, validation)
import { idbDelete, idbGet, idbGetAll, idbPut } from './idb';
import { uuid } from './ids';

let counter = 0;
const nextSeq = () => Date.now() * 1000 + (counter++ % 1000);

export const addEntry = async (entry) => {
  const record = { attempts: 0, status: 'pending', error: null, ...entry, id: uuid(), seq: nextSeq(), createdAt: new Date().toISOString() };
  await idbPut('queue', record);
  return record;
};

export const listEntries = async (userId) => (await idbGetAll('queue'))
  .filter((e) => !userId || e.userId === userId)
  .sort((a, b) => a.seq - b.seq);

export const getEntry = (id) => idbGet('queue', id);
export const saveEntry = (entry) => idbPut('queue', entry);
export const removeEntry = (id) => idbDelete('queue', id);

export const updateEntry = async (id, patch) => {
  const current = await getEntry(id);
  if (!current) return null;
  const next = { ...current, ...patch };
  await idbPut('queue', next);
  return next;
};

export const countEntries = async (userId) => {
  const entries = await listEntries(userId);
  return {
    pending: entries.filter((e) => e.status === 'pending').length,
    needsAttention: entries.filter((e) => e.status === 'conflict' || e.status === 'failed').length
  };
};
