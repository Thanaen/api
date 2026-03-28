import { afterEach, describe, expect, test } from "bun:test";

import { Cache } from "../src/modules/paniers/cache";

afterEach(() => {
  Cache.clear();
});

describe("Cache", () => {
  test("get returns null for missing key", () => {
    expect(Cache.get("nonexistent")).toBeNull();
  });

  test("set and get round-trips a value", () => {
    Cache.set("key", { a: 1 }, 60_000);
    expect(Cache.get<{ a: number }>("key")).toEqual({ a: 1 });
  });

  test("returns null after TTL expires", () => {
    Cache.set("key", "value", 1); // 1ms TTL
    // Wait for expiration
    const start = Date.now();
    while (Date.now() - start < 5);
    expect(Cache.get("key")).toBeNull();
  });

  test("clear removes all entries", () => {
    Cache.set("a", 1, 60_000);
    Cache.set("b", 2, 60_000);
    Cache.clear();
    expect(Cache.get("a")).toBeNull();
    expect(Cache.get("b")).toBeNull();
  });

  test("overwrites existing key", () => {
    Cache.set("key", "old", 60_000);
    Cache.set("key", "new", 60_000);
    expect(Cache.get<string>("key")).toBe("new");
  });
});
