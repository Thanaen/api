import { and, desc, eq, gt, sql } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "./index";
import { cache } from "./schema";

const MAX_ENTRIES_PER_KEY = 4;

export abstract class CacheRepository {
  static async get<T>(key: string): Promise<T | null> {
    const result = await this.getWithMeta<T>(key);
    return result?.data ?? null;
  }

  static async getWithMeta<T>(key: string): Promise<{ data: T; lastUpdated: string } | null> {
    if (!isDatabaseConfigured()) return null;

    const [row] = await getDb()
      .select({ data: cache.data, createdAt: cache.createdAt })
      .from(cache)
      .where(and(eq(cache.key, key), gt(cache.expiresAt, sql`now()`)))
      .orderBy(desc(cache.createdAt))
      .limit(1);

    if (!row) return null;
    return { data: row.data as T, lastUpdated: row.createdAt.toISOString() };
  }

  static async set<T>(key: string, data: T, ttlMs: number): Promise<void> {
    if (!isDatabaseConfigured()) return;

    const db = getDb();
    const expiresAt = new Date(Date.now() + ttlMs);
    const jsonData = JSON.stringify(data);

    await db.execute(sql`
      INSERT INTO cache (key, data, expires_at)
      VALUES (${key}, ${jsonData}::jsonb, ${expiresAt})
    `);

    await db.execute(sql`
      DELETE FROM cache
      WHERE key = ${key}
        AND id NOT IN (
          SELECT id FROM cache
          WHERE key = ${key}
          ORDER BY created_at DESC
          LIMIT ${MAX_ENTRIES_PER_KEY}
        )
    `);
  }

  static async clear(): Promise<void> {
    if (!isDatabaseConfigured()) return;

    await getDb().delete(cache);
  }
}
