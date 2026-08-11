import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { Elysia } from "elysia";

import { registerCinemaTools } from "../cinema/mcp-tools";
import { registerPanierTools } from "../paniers/mcp-tools";

function createMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: "thanaen-api",
      version: "1.0.0",
    },
    {
      cacheHints: {
        "server/discover": { ttlMs: 300_000, cacheScope: "public" },
        "tools/list": { ttlMs: 300_000, cacheScope: "public" },
      },
    },
  );

  registerPanierTools(server);
  registerCinemaTools(server);

  return server;
}

const mcpHandler = createMcpHandler(createMcpServer, { legacy: "reject" });

export const mcp = new Elysia({ name: "mcp", prefix: "/mcp" })
  .headers({
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "Content-Type, mcp-protocol-version, mcp-method, mcp-name",
    "access-control-expose-headers": "mcp-protocol-version",
  })
  .options("/", () => new Response(null, { status: 204 }), { detail: { hide: true } })
  .post("/", ({ request }) => mcpHandler.fetch(request), { detail: { hide: true } });
