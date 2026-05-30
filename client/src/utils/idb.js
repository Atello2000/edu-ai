/**
 * idb — wrapper minimaliste autour d'IndexedDB.
 *
 * Stores :
 *   sessions  — historique des sessions (remplace localStorage HISTORY_KEY)
 *
 * API :
 *   idb.getAll(store)         → Promise<item[]>
 *   idb.get(store, key)       → Promise<item|undefined>
 *   idb.put(store, item)      → Promise<void>   (item doit avoir une clé primaire)
 *   idb.delete(store, key)    → Promise<void>
 *   idb.clear(store)          → Promise<void>
 */

const DB_NAME    = 'jangalai';
const DB_VERSION = 1;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'id' });
      }
    };

    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const t  = db.transaction(store, mode);
    const os = t.objectStore(store);
    const req = fn(os);
    if (req) {
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror   = (e) => reject(e.target.error);
    } else {
      t.oncomplete = () => resolve();
      t.onerror    = (e) => reject(e.target.error);
    }
  }));
}

export const idb = {
  getAll: (store)      => tx(store, 'readonly',  os => os.getAll()),
  get:    (store, key) => tx(store, 'readonly',  os => os.get(key)),
  put:    (store, item)=> tx(store, 'readwrite', os => os.put(item)),
  delete: (store, key) => tx(store, 'readwrite', os => os.delete(key)),
  clear:  (store)      => tx(store, 'readwrite', os => os.clear()),
};
