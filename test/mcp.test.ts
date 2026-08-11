import { afterEach, describe, expect, test } from "bun:test";

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

import app from "../src";

const clients: Client[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

function createClient(modern: boolean) {
  const client = new Client(
    { name: modern ? "modern-test" : "legacy-test", version: "1.0.0" },
    modern ? { versionNegotiation: { mode: { pin: "2026-07-28" } } } : undefined,
  );
  clients.push(client);

  const transport = new StreamableHTTPClientTransport(new URL("http://test.local/mcp/"), {
    fetch: (url, init) => app.handle(new Request(url, init)),
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

  test("accepts a modern browser CORS preflight", async () => {
    const response = await app.handle(
      new Request("http://test.local/mcp/", {
        method: "OPTIONS",
        headers: {
          origin: "https://example.com",
          "access-control-request-method": "POST",
          "access-control-request-headers": "content-type,mcp-protocol-version,mcp-method,mcp-name",
        },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-headers")).toContain("mcp-method");
    expect(response.headers.get("access-control-allow-headers")).toContain("mcp-name");
  });
});
