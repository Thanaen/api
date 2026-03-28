const store = new Map<string, { data: unknown; expiresAt: number }>();

export abstract class Cache {
  static get<T>(key: string): T | null {
    const entry = store.get(key);
    if (!entry || Date.now() > entry.expiresAt) {
      store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  static set<T>(key: string, data: T, ttlMs: number): void {
    store.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  static clear(): void {
    store.clear();
  }
}
