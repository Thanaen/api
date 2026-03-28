export function secondsUntilNextSaturday1am(): number {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sun, 6=Sat
  let daysUntil = (6 - dayOfWeek + 7) % 7;
  if (daysUntil === 0 && now.getUTCHours() >= 1) {
    daysUntil = 7;
  }
  const target = new Date(now);
  target.setUTCDate(target.getUTCDate() + daysUntil);
  target.setUTCHours(1, 0, 0, 0);
  return Math.max(60, Math.floor((target.getTime() - now.getTime()) / 1000));
}

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
