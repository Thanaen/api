import { afterEach, describe, expect, spyOn, test } from "bun:test";

import { cinema } from "../src/modules/cinema";
import { Cache } from "../src/modules/cinema/cache";
import { CinemaService } from "../src/modules/cinema/service";

const handle = (path: string) =>
  cinema.handle(new Request(`http://localhost/moncine/movies${path}`));

afterEach(() => {
  Cache.clear();
});

const mockMovie = {
  id: "317669",
  title: "Marsupilami",
  genres: "Comédie, Aventure, Famille",
  production: "Pathé Films",
  casting: ["Philippe Lacheau", "Jamel Debbouze"],
  direction: ["Philippe Lacheau"],
  poster: "https://all.web.img.acsta.net/img/example.jpg",
  releaseDate: "2026-02-04T00:00:00.000Z",
  runtime: 5940,
  synopsis: "Pour sauver son emploi...",
  url: "https://www.moncine-anglet.com/movies/317669-marsupilami/",
};

describe("GET /moncine/movies", () => {
  test("returns 200 with array of movies from cache", async () => {
    Cache.set("cinema:list", [mockMovie], 60_000);
    const res = await handle("/");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("lastUpdated");
    expect(body).toHaveProperty("data");
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(1);

    const movie = body.data[0];
    expect(movie.id).toBe("317669");
    expect(movie.title).toBe("Marsupilami");
    expect(movie.genres).toBe("Comédie, Aventure, Famille");
    expect(typeof movie.runtime).toBe("number");
  });

  test("returns 502 when service throws", async () => {
    const spy = spyOn(CinemaService, "list").mockImplementation(() =>
      Promise.reject(new Error("upstream down")),
    );
    const res = await handle("/");
    spy.mockRestore();
    expect(res.status).toBe(502);

    const data = await res.json();
    expect(data.message).toBe("Failed to fetch upstream data");
  });
});

describe("GET /moncine/movies/:id", () => {
  test("returns 200 with movie detail from cache", async () => {
    Cache.set("cinema:detail:317669", mockMovie, 60_000);
    const res = await handle("/317669");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("lastUpdated");
    expect(body).toHaveProperty("data");
    expect(body.data.id).toBe("317669");
    expect(body.data.title).toBe("Marsupilami");
    expect(body.data.production).toBe("Pathé Films");
    expect(Array.isArray(body.data.casting)).toBe(true);
    expect(body.data.synopsis).toBeTruthy();
  });

  test("returns 404 for unknown ID", async () => {
    const spy = spyOn(CinemaService, "detail").mockImplementation(() => Promise.resolve(null));
    const res = await handle("/999999");
    spy.mockRestore();
    expect(res.status).toBe(404);

    const data = await res.json();
    expect(data.message).toBe("Movie not found");
  });

  test("returns 502 when service throws", async () => {
    const spy = spyOn(CinemaService, "detail").mockImplementation(() =>
      Promise.reject(new Error("upstream down")),
    );
    const res = await handle("/317669");
    spy.mockRestore();
    expect(res.status).toBe(502);

    const data = await res.json();
    expect(data.message).toBe("Failed to fetch upstream data");
  });
});

describe("cache-control headers", () => {
  test("200 response sets a public cache-control header", async () => {
    Cache.set("cinema:list", [mockMovie], 60_000);
    const res = await handle("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toMatch(
      /^public, max-age=300, s-maxage=\d+, stale-while-revalidate=3600$/,
    );
  });

  test("404 response sets cache-control: no-store", async () => {
    const spy = spyOn(CinemaService, "detail").mockImplementation(() => Promise.resolve(null));
    const res = await handle("/999999");
    spy.mockRestore();
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  test("502 response sets cache-control: no-store", async () => {
    const spy = spyOn(CinemaService, "list").mockImplementation(() =>
      Promise.reject(new Error("upstream down")),
    );
    const res = await handle("/");
    spy.mockRestore();
    expect(res.status).toBe(502);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
