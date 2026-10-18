// Minimal promise wrapper over IndexedDB (the project's webpack config aliases the `idb`
// package away, and this keeps the offline layer dependency-free).
//
// Stores
//   reads  { key, ... }   cached GET responses and per-table row mirrors
//   queue  { id, seq, ...} offline mutations waiting to be replayed
//   meta   { key, value } small bookkeeping values

const DB_NAME = 'hms-offline';
const DB_VERSION = 1;

let dbPromise = null;

export const isIdbAvailable = () => {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch (e) {
    return false;
  }
};

export const openDb = () => {
  if (!isIdbAvailable()) return Promise.reject(new Error('IndexedDB is not available'));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('reads')) db.createObjectStore('reads', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('queue')) db.createObjectStore('queue', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      };
      request.onsuccess = () => {
        const db = request.result;
        // another tab upgraded the schema: close so it is not blocked, reopen on next use
        db.onversionchange = () => { db.close(); dbPromise = null; };
        db.onclose = () => { dbPromise = null; };
        resolve(db);
      };
      request.onerror = () => { dbPromise = null; reject(request.error); };
      request.onblocked = () => { dbPromise = null; reject(new Error('IndexedDB upgrade is blocked by another tab')); };
    });
  }
  return dbPromise;
};

// Runs fn(objectStore) in one transaction and resolves with the request result (if fn returns a request).
const run = async (storeName, mode, fn) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    let result;
    const request = fn(tx.objectStore(storeName));
    if (request && 'onsuccess' in request) request.onsuccess = () => { result = request.result; };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
};

export const idbGet = (store, key) => run(store, 'readonly', (s) => s.get(key));
export const idbGetAll = (store) => run(store, 'readonly', (s) => s.getAll());
export const idbCount = (store) => run(store, 'readonly', (s) => s.count());
export const idbPut = (store, value) => run(store, 'readwrite', (s) => s.put(value));
export const idbDelete = (store, key) => run(store, 'readwrite', (s) => s.delete(key));
export const idbClear = (store) => run(store, 'readwrite', (s) => s.clear());

/** Test helper: drop the connection so a fresh database can be created. */
export const resetDbForTests = async () => {
  if (dbPromise) {
    try { (await dbPromise).close(); } catch (e) { /* ignore */ }
  }
  dbPromise = null;
};
