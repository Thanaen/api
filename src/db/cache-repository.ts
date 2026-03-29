import { and, desc, eq, gt, sql } from "drizzle-orm";

import { getDb } from "./index";
import { panierCache } from "./schema";

const MAX_ENTRIES_PER_KEY = 4;

export abstract class CacheRepository {
  static async get<T>(key: string): Promise<T | null> {
    const result = await this.getWithMeta<T>(key);
    return result?.data ?? null;
  }

  static async getWithMeta<T>(key: string): Promise<{ data: T; lastUpdated: string } | null> {
    const db = getDb();
    if (!db) return null;

    const [row] = await db
      .select({ data: panierCache.data, createdAt: panierCache.createdAt })
      .from(panierCache)
      .where(and(eq(panierCache.key, key), gt(panierCache.expiresAt, sql`now()`)))
      .orderBy(desc(panierCache.createdAt))
      .limit(1);

    if (!row) return null;
    return { data: row.data as T, lastUpdated: row.createdAt.toISOString() };
  }

  static async set<T>(key: string, data: T, ttlMs: number): Promise<void> {
    const db = getDb();
    if (!db) return;

    const ttlSeconds = Math.floor(ttlMs / 1000);
    const jsonData = JSON.stringify(data);

    await db.execute(sql`
      WITH inserted AS (
        INSERT INTO panier_cache (key, data, expires_at)
        VALUES (${key}, ${jsonData}::jsonb, now() + interval '${sql.raw(String(ttlSeconds))} seconds')
      ),
      keep AS (
        SELECT id FROM panier_cache
        WHERE key = ${key}
        ORDER BY created_at DESC
        LIMIT ${MAX_ENTRIES_PER_KEY}
      )
      DELETE FROM panier_cache
      WHERE key = ${key} AND id NOT IN (SELECT id FROM keep)
    `);
  }

  static async clear(): Promise<void> {
    const db = getDb();
    if (!db) return;
    await db.delete(panierCache);
  }
}
