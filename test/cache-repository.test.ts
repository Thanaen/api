import { afterAll, afterEach, describe, expect, test } from "bun:test";

import { CacheRepository } from "../src/db/cache-repository";

afterEach(async () => {
  await CacheRepository.clear();
});

afterAll(async () => {
  await CacheRepository.clear();
});

describe("CacheRepository", () => {
  test("get returns null for missing key", async () => {
    expect(await CacheRepository.get("nonexistent")).toBeNull();
  });

  test("set and get round-trips a value", async () => {
    await CacheRepository.set("key", { a: 1 }, 60_000);
    expect(await CacheRepository.get<{ a: number }>("key")).toEqual({ a: 1 });
  });

  test("returns null after TTL expires", async () => {
    await CacheRepository.set("key", "value", 1_000);
    // Should be available immediately
    expect(await CacheRepository.get<string>("key")).toBe("value");
    // Wait for expiration
    await new Promise((r) => setTimeout(r, 1_500));
    expect(await CacheRepository.get("key")).toBeNull();
  });

  test("clear removes all entries", async () => {
    await CacheRepository.set("a", 1, 60_000);
    await CacheRepository.set("b", 2, 60_000);
    await CacheRepository.clear();
    expect(await CacheRepository.get("a")).toBeNull();
    expect(await CacheRepository.get("b")).toBeNull();
  });

  test("overwrites with new entry on same key", async () => {
    await CacheRepository.set("key", "old", 60_000);
    await CacheRepository.set("key", "new", 60_000);
    expect(await CacheRepository.get<string>("key")).toBe("new");
  });

  test("getWithMeta returns data with lastUpdated ISO string", async () => {
    await CacheRepository.set("key", { a: 1 }, 60_000);
    const result = await CacheRepository.getWithMeta<{ a: number }>("key");
    expect(result).not.toBeNull();
    expect(result!.data).toEqual({ a: 1 });
    expect(typeof result!.lastUpdated).toBe("string");
    expect(new Date(result!.lastUpdated).toISOString()).toBe(result!.lastUpdated);
  });

  test("getWithMeta returns null for missing key", async () => {
    expect(await CacheRepository.getWithMeta("nonexistent")).toBeNull();
  });

  test("prunes entries beyond 4 per key", async () => {
    for (let i = 0; i < 6; i++) {
      await CacheRepository.set("key", { version: i }, 60_000);
    }
    // The most recent should be returned
    expect(await CacheRepository.get<{ version: number }>("key")).toEqual({ version: 5 });
  });

  test("pruning is scoped to key", async () => {
    for (let i = 0; i < 5; i++) {
      await CacheRepository.set("a", { version: i }, 60_000);
    }
    await CacheRepository.set("b", "only-one", 60_000);
    expect(await CacheRepository.get<string>("b")).toBe("only-one");
    expect(await CacheRepository.get<{ version: number }>("a")).toEqual({ version: 4 });
  });
});
