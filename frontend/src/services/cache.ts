
const DB_NAME = 'AssetCacheDB';
const STORE_NAME = 'assets';
const DB_VERSION = 1;

export const AssetCache = {
  db: null as IDBDatabase | null,

  async init() {
    if (this.db) return;
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
    });
  },

  async get(key: string): Promise<Blob | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      if (!this.db) return reject('DB not initialized');
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async put(key: string, blob: Blob): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      if (!this.db) return reject('DB not initialized');
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(blob, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async clear(): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
        if (!this.db) return reject('DB not initialized');
        const tx = this.db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => {
            console.log('[Cache] Cleared all assets');
            resolve();
        };
        req.onerror = () => reject(req.error);
    });
  },

  async getOrFetch(url: string, key: string): Promise<Blob> {
    // 0. Handle Data URI directly (No need to cache data URIs in IndexedDB usually, as they are already data)
    // But to keep interface consistent, we can just return the blob.
    if (url.startsWith('data:')) {
        const res = await fetch(url);
        return await res.blob();
    }

    // 1. Try cache
    try {
      const cached = await this.get(key);
      if (cached) {
        console.log(`[Cache] Hit for ${key}`);
        return cached;
      }
    } catch (e) {
      console.warn(`[Cache] Failed to read ${key}`, e);
    }

    // 2. Fetch if not in cache
    console.log(`[Cache] Miss for ${key}, fetching...`);
    // Cache busting
    const fetchUrl = url.includes('?') ? `${url}&_t=${Date.now()}` : `${url}?_t=${Date.now()}`;
    
    const resp = await fetch(fetchUrl, { redirect: 'follow', mode: 'cors' });
    if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
    
    const blob = await resp.blob();
    
    // 3. Store in cache
    try {
      await this.put(key, blob);
      console.log(`[Cache] Stored ${key}`);
    } catch (e) {
      console.warn('Failed to cache asset', e);
    }
    
    return blob;
  }
};
