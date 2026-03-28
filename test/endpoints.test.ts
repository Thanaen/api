import { afterEach, describe, expect, test } from "bun:test";

import { paniers } from "../src/modules/paniers";
import { Cache } from "../src/modules/paniers/cache";

const handle = (path: string) =>
  paniers.handle(new Request(`http://localhost/paniersdeladour/paniers${path}`));

afterEach(() => {
  Cache.clear();
});

describe("GET /paniersdeladour/paniers", () => {
  test(
    "returns 200 with array of paniers",
    async () => {
      const res = await handle("/");
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);

      for (const p of data) {
        expect(p).toHaveProperty("id");
        expect(p).toHaveProperty("name");
        expect(p).toHaveProperty("price");
        expect(p).toHaveProperty("url");
        expect(p).toHaveProperty("imageUrl");
        expect(typeof p.id).toBe("number");
        expect(typeof p.price).toBe("number");
        expect(p.price).toBeGreaterThan(0);
      }
    },
    { timeout: 15_000 },
  );
});

describe("GET /paniersdeladour/paniers/:id", () => {
  test(
    "returns 200 with panier detail for valid ID",
    async () => {
      const res = await handle("/1");
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.id).toBe(1);
      expect(data.name).toBeTruthy();
      expect(typeof data.price).toBe("number");
      expect(data.description).toBeTruthy();
      expect(Array.isArray(data.composition)).toBe(true);
    },
    { timeout: 15_000 },
  );

  test(
    "returns 404 for unknown ID",
    async () => {
      const res = await handle("/999");
      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data.message).toBe("Panier not found");
    },
    { timeout: 15_000 },
  );
});
