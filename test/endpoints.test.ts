import { afterEach, describe, expect, spyOn, test } from "bun:test";

import { paniers } from "../src/modules/paniers";
import { Cache } from "../src/modules/paniers/cache";
import { PanierService } from "../src/modules/paniers/service";

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

      const body = await res.json();
      expect(body).toHaveProperty("lastUpdated");
      expect(typeof body.lastUpdated).toBe("string");
      expect(body).toHaveProperty("data");
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);

      for (const p of body.data) {
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

      const body = await res.json();
      expect(body).toHaveProperty("lastUpdated");
      expect(typeof body.lastUpdated).toBe("string");
      expect(body).toHaveProperty("data");
      expect(body.data.id).toBe(1);
      expect(body.data.name).toBeTruthy();
      expect(typeof body.data.price).toBe("number");
      expect(body.data.description).toBeTruthy();
      expect(Array.isArray(body.data.composition)).toBe(true);
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

const mockSummary = {
  id: 1,
  name: "Le Panier Test",
  price: 20,
  url: "https://www.panierdeladour.com/paniers-de-saison/1-test.html",
  imageUrl: "https://www.panierdeladour.com/img/p/1-100.jpg",
};

describe("cache-control headers", () => {
  test("200 response sets a public cache-control header", async () => {
    Cache.set("paniers:list", [mockSummary], 60_000);
    const res = await handle("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toMatch(
      /^public, max-age=300, s-maxage=\d+, stale-while-revalidate=3600$/,
    );
  });

  test("404 response sets cache-control: no-store", async () => {
    Cache.set("paniers:list", [mockSummary], 60_000);
    const res = await handle("/999");
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  test("502 response sets cache-control: no-store", async () => {
    const spy = spyOn(PanierService, "list").mockImplementation(() =>
      Promise.reject(new Error("upstream down")),
    );
    const res = await handle("/");
    spy.mockRestore();
    expect(res.status).toBe(502);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
