import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { track, trackException } from "../../telemetry";
import { PanierService } from "./service";

const MCP_DISTINCT_ID = "mcp";

export function registerPanierTools(server: McpServer) {
  server.tool(
    "list_paniers",
    "List all seasonal baskets from panierdeladour.com with name, price, and image. Includes a lastUpdated timestamp.",
    async () => {
      const startedAt = Date.now();
      try {
        const paniers = await PanierService.list();
        track(
          "mcp_tool_call",
          {
            tool: "list_paniers",
            success: true,
            duration_ms: Date.now() - startedAt,
          },
          MCP_DISTINCT_ID,
        );
        return { content: [{ type: "text", text: JSON.stringify(paniers, null, 2) }] };
      } catch (error) {
        track(
          "mcp_tool_call",
          {
            tool: "list_paniers",
            success: false,
            duration_ms: Date.now() - startedAt,
          },
          MCP_DISTINCT_ID,
        );
        trackException(error, MCP_DISTINCT_ID, { tool: "list_paniers" });
        return {
          content: [{ type: "text", text: "Failed to fetch upstream data" }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "get_panier_detail",
    "Get full detail for a seasonal basket by ID, including composition and origin of items. Includes a lastUpdated timestamp.",
    { id: z.number().describe("The basket product ID") },
    async ({ id }) => {
      const startedAt = Date.now();
      try {
        const detail = await PanierService.detail(id);
        if (!detail) {
          track(
            "mcp_tool_call",
            {
              tool: "get_panier_detail",
              success: false,
              not_found: true,
              resource_id: id,
              duration_ms: Date.now() - startedAt,
            },
            MCP_DISTINCT_ID,
          );
          return { content: [{ type: "text", text: "Panier not found" }], isError: true };
        }
        track(
          "mcp_tool_call",
          {
            tool: "get_panier_detail",
            success: true,
            resource_id: id,
            duration_ms: Date.now() - startedAt,
          },
          MCP_DISTINCT_ID,
        );
        return { content: [{ type: "text", text: JSON.stringify(detail, null, 2) }] };
      } catch (error) {
        track(
          "mcp_tool_call",
          {
            tool: "get_panier_detail",
            success: false,
            resource_id: id,
            duration_ms: Date.now() - startedAt,
          },
          MCP_DISTINCT_ID,
        );
        trackException(error, MCP_DISTINCT_ID, { tool: "get_panier_detail", resource_id: id });
        return {
          content: [{ type: "text", text: "Failed to fetch upstream data" }],
          isError: true,
        };
      }
    },
  );
}
