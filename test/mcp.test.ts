import { afterEach, describe, expect, test } from "bun:test";

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

import app from "../src";

const clients: Client[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

function createClient(modern: boolean, origin?: string) {
  const client = new Client(
    { name: modern ? "modern-test" : "legacy-test", version: "1.0.0" },
    modern ? { versionNegotiation: { mode: { pin: "2026-07-28" } } } : undefined,
  );
  clients.push(client);

  const transport = new StreamableHTTPClientTransport(new URL("http://test.local/mcp/"), {
    fetch: (url, init) => {
      const request = new Request(url, init);
      if (origin) request.headers.set("origin", origin);
      return app.handle(request);
    },
  });

  return { client, transport };
}

describe("MCP transport", () => {
  test("serves protocol 2026-07-28 without a session", async () => {
    const { client, transport } = createClient(true);
    await client.connect(transport);

    const result = await client.listTools();

    expect(result.tools.map((tool) => tool.name)).toEqual([
      "list_paniers",
      "get_panier_detail",
      "list_cinema_movies",
      "get_cinema_movie_detail",
    ]);
    expect(result.ttlMs).toBe(300_000);
    expect(result.cacheScope).toBe("public");
  });

  test("rejects legacy protocol clients", async () => {
    const { client, transport } = createClient(false);
    let rejection: unknown;

    try {
      await client.connect(transport);
    } catch (error) {
      rejection = error;
    }

    expect(rejection).toBeInstanceOf(Error);
  });

  test.each(["GET", "DELETE"])("rejects legacy %s transport requests", async (method) => {
    const response = await app.handle(new Request("http://test.local/mcp/", { method }));

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST, OPTIONS");
  });

  test("accepts a modern browser CORS preflight", async () => {
    const response = await app.handle(
      new Request("http://test.local/mcp/", {
        method: "OPTIONS",
        headers: {
          origin: "https://thanaen.dev",
          "access-control-request-method": "POST",
          "access-control-request-headers": "content-type,mcp-protocol-version,mcp-method,mcp-name",
        },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://thanaen.dev");
    expect(response.headers.get("access-control-allow-headers")).toContain("mcp-method");
    expect(response.headers.get("access-control-allow-headers")).toContain("mcp-name");
    expect(response.headers.get("vary")).toContain("Origin");
  });

  test("rejects untrusted browser origins", async () => {
    const preflight = await app.handle(
      new Request("http://test.local/mcp/", {
        method: "OPTIONS",
        headers: {
          origin: "https://evil.example",
          "access-control-request-method": "POST",
          "access-control-request-headers": "content-type,mcp-protocol-version,mcp-method,mcp-name",
        },
      }),
    );

    expect(preflight.status).toBe(403);
    expect(preflight.headers.get("access-control-allow-origin")).toBeNull();

    const { client, transport } = createClient(true, "https://evil.example");
    let rejection: unknown;

    try {
      await client.connect(transport);
    } catch (error) {
      rejection = error;
    }

    expect(rejection).toBeInstanceOf(Error);
  });

  test.each([
    "https://thanaen.dev/path",
    "https://thanaen.dev?query=value",
    "https://thanaen.dev#fragment",
    "https://user:password@thanaen.dev",
    "null",
    "",
  ])("rejects malformed browser origin %s", async (origin) => {
    const response = await app.handle(
      new Request("http://test.local/mcp/", {
        method: "OPTIONS",
        headers: {
          origin,
          "access-control-request-method": "POST",
        },
      }),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();

    const post = await app.handle(
      new Request("http://test.local/mcp/", {
        method: "POST",
        headers: {
          origin,
          "content-type": "application/json",
          "mcp-protocol-version": "2026-07-28",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "server/discover", params: {} }),
      }),
    );

    expect(post.status).toBe(403);
    expect(post.headers.get("access-control-allow-origin")).toBeNull();
  });
});
