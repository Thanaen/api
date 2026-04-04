const store = new Map<string, { data: unknown; expiresAt: number; createdAt: number }>();

export abstract class Cache {
  static get<T>(key: string): T | null {
    const entry = store.get(key);
    if (!entry || Date.now() > entry.expiresAt) {
      store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  static getWithMeta<T>(key: string): { data: T; lastUpdated: string } | null {
    const entry = store.get(key);
    if (!entry || Date.now() > entry.expiresAt) {
      store.delete(key);
      return null;
    }
    return { data: entry.data as T, lastUpdated: new Date(entry.createdAt).toISOString() };
  }

  static set<T>(key: string, data: T, ttlMs: number): void {
    store.set(key, { data, expiresAt: Date.now() + ttlMs, createdAt: Date.now() });
  }

  static clear(): void {
    store.clear();
  }
}
