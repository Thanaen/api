import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Elysia } from "elysia";

import { registerPanierTools } from "../paniers/mcp-tools";

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "thanaen-api",
    version: "1.0.0",
  });

  registerPanierTools(server);

  return server;
}

export const mcp = new Elysia({ name: "mcp", prefix: "/mcp" })
  .headers({
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
    "access-control-allow-headers":
      "Content-Type, mcp-session-id, Last-Event-ID, mcp-protocol-version",
    "access-control-expose-headers": "mcp-session-id, mcp-protocol-version",
  })
  .all(
    "/",
    async ({ request }) => {
      const transport = new WebStandardStreamableHTTPServerTransport();
      const server = createMcpServer();
      await server.connect(transport);
      return transport.handleRequest(request);
    },
    { detail: { hide: true } },
  );
