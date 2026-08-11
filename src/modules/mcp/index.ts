import {
  createMcpHandler,
  localhostAllowedOrigins,
  McpServer,
  originValidationResponse,
} from "@modelcontextprotocol/server";
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
const allowedOriginHostnames = [
  ...localhostAllowedOrigins(),
  "api.thanaen.dev",
  "thanaen.dev",
  "www.thanaen.dev",
];

async function handleWithValidatedOrigin(
  request: Request,
  handler: () => Response | Promise<Response>,
): Promise<Response> {
  const rejected = originValidationResponse(request, allowedOriginHostnames);
  if (rejected) return rejected;

  const response = await handler();
  const origin = request.headers.get("origin");
  if (!origin) return response;

  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", origin);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const mcp = new Elysia({ name: "mcp", prefix: "/mcp" })
  .headers({
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "Content-Type, mcp-protocol-version, mcp-method, mcp-name",
    "access-control-expose-headers": "mcp-protocol-version",
    vary: "Origin",
  })
  .options(
    "/",
    ({ request }) => handleWithValidatedOrigin(request, () => new Response(null, { status: 204 })),
    { detail: { hide: true } },
  )
  .post("/", ({ request }) => handleWithValidatedOrigin(request, () => mcpHandler.fetch(request)), {
    detail: { hide: true },
  });
