/** Tiny promise wrapper over one IndexedDB key/value store — shared by the app and the service worker. */
const DB = 'cardwise'
const STORE = 'kv'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = fn(t.objectStore(STORE))
    t.oncomplete = () => {
      db.close()
      resolve(req.result)
    }
    t.onerror = t.onabort = () => {
      db.close()
      reject(t.error)
    }
  })
}

export const kvGet = <T>(key: string) => tx<T | undefined>('readonly', (s) => s.get(key) as IDBRequest<T | undefined>)
export const kvSet = (key: string, value: unknown) => tx('readwrite', (s) => s.put(value, key))
export const kvDel = (key: string) => tx('readwrite', (s) => s.delete(key))

/** Keys used by the background alert check. */
export const KV = {
  state: 'state',
  /** candidates found by the worker that the app hasn't merged into its inbox yet */
  pending: 'pending',
  /** keys the worker already notified about, so it doesn't repeat itself before the app opens */
  bgFired: 'bgFired',
  lastCheck: 'lastCheck',
} as const
