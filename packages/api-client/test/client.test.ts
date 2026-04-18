import { expect, test } from "bun:test";

import {
  BUILT_FOR_API_VERSION,
  CLIENT_VERSION,
  NotFoundError,
  ThanaenApiClient,
  UpstreamError,
  type FetchLike,
} from "../src";

type Call = { url: string; init?: RequestInit };

function mockFetch(handler: (call: Call) => Response | Promise<Response>): {
  fetch: FetchLike;
  calls: Call[];
} {
  const calls: Call[] = [];
  const fetch: FetchLike = async (url, init) => {
    const call = { url, init };
    calls.push(call);
    return handler(call);
  };
  return { fetch, calls };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("paniers.list hits the correct URL and returns parsed body", async () => {
  const { fetch, calls } = mockFetch(() =>
    jsonResponse(200, {
      data: [{ id: 1, name: "p", price: 10, url: "u", imageUrl: "i" }],
      lastUpdated: "2026-04-18T00:00:00.000Z",
    }),
  );
  const client = new ThanaenApiClient({ fetch });

  const result = await client.paniers.list();

  expect(calls[0]!.url).toBe("https://api.thanaen.dev/paniersdeladour/paniers/");
  expect(result.data[0]!.name).toBe("p");
  expect(result.lastUpdated).toBe("2026-04-18T00:00:00.000Z");
});

test("baseUrl override is respected and trailing slashes trimmed", async () => {
  const { fetch, calls } = mockFetch(() => jsonResponse(200, { data: [], lastUpdated: "x" }));
  const client = new ThanaenApiClient({ baseUrl: "http://localhost:3000/", fetch });

  await client.cinema.movies.list();

  expect(calls[0]!.url).toBe("http://localhost:3000/moncine/movies/");
});

test("panier detail path encodes numeric id", async () => {
  const { fetch, calls } = mockFetch(() =>
    jsonResponse(200, {
      data: {
        id: 42,
        name: "n",
        price: 1,
        description: "d",
        weight: "w",
        servings: "s",
        imageUrl: "i",
        composition: [],
      },
      lastUpdated: "x",
    }),
  );
  const client = new ThanaenApiClient({ fetch });

  await client.paniers.get(42);

  expect(calls[0]!.url).toBe("https://api.thanaen.dev/paniersdeladour/paniers/42");
});

test("movie detail path encodes string id", async () => {
  const { fetch, calls } = mockFetch(() =>
    jsonResponse(200, {
      data: {
        id: "abc/123",
        title: "t",
        genres: "g",
        production: "p",
        casting: [],
        direction: [],
        poster: "p",
        releaseDate: "r",
        runtime: 0,
        synopsis: "s",
        url: "u",
      },
      lastUpdated: "x",
    }),
  );
  const client = new ThanaenApiClient({ fetch });

  await client.cinema.movies.get("abc/123");

  expect(calls[0]!.url).toBe("https://api.thanaen.dev/moncine/movies/abc%2F123");
});

test("sends version headers on every request", async () => {
  const { fetch, calls } = mockFetch(() => jsonResponse(200, { data: [], lastUpdated: "x" }));
  const client = new ThanaenApiClient({ fetch });

  await client.paniers.list();

  const headers = calls[0]!.init!.headers as Record<string, string>;
  expect(headers["X-Client-Version"]).toBe(`${CLIENT_VERSION}; api=${BUILT_FOR_API_VERSION}`);
  expect(headers["User-Agent"]).toBe(
    `@thanaen/api-client/${CLIENT_VERSION} (built-for-api/${BUILT_FOR_API_VERSION})`,
  );
});

test("extra headers are merged on every request", async () => {
  const { fetch, calls } = mockFetch(() => jsonResponse(200, { data: [], lastUpdated: "x" }));
  const client = new ThanaenApiClient({ fetch, headers: { "X-Extra": "yes" } });

  await client.paniers.list();

  const headers = calls[0]!.init!.headers as Record<string, string>;
  expect(headers["X-Extra"]).toBe("yes");
});

test("404 throws NotFoundError carrying the server message", async () => {
  const { fetch } = mockFetch(() => jsonResponse(404, { message: "Panier not found" }));
  const client = new ThanaenApiClient({ fetch });

  try {
    await client.paniers.get(999);
    throw new Error("should have thrown");
  } catch (err) {
    expect(err).toBeInstanceOf(NotFoundError);
    expect((err as NotFoundError).message).toBe("Panier not found");
    expect((err as NotFoundError).status).toBe(404);
  }
});

test("502 throws UpstreamError", async () => {
  const { fetch } = mockFetch(() =>
    jsonResponse(502, { message: "Failed to fetch upstream data" }),
  );
  const client = new ThanaenApiClient({ fetch });

  try {
    await client.cinema.movies.list();
    throw new Error("should have thrown");
  } catch (err) {
    expect(err).toBeInstanceOf(UpstreamError);
  }
});

test("other non-2xx throws ThanaenApiError with fallback message", async () => {
  const { fetch } = mockFetch(() => new Response("boom", { status: 500 }));
  const client = new ThanaenApiClient({ fetch });

  try {
    await client.paniers.list();
    throw new Error("should have thrown");
  } catch (err) {
    expect((err as Error).name).toBe("ThanaenApiError");
    expect((err as Error).message).toContain("500");
  }
});
