import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { PanierService } from "./service";

export function registerPanierTools(server: McpServer) {
  server.tool(
    "list_paniers",
    "List all seasonal baskets from panierdeladour.com with name, price, and image",
    async () => {
      try {
        const paniers = await PanierService.list();
        return { content: [{ type: "text", text: JSON.stringify(paniers, null, 2) }] };
      } catch {
        return {
          content: [{ type: "text", text: "Failed to fetch upstream data" }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "get_panier_detail",
    "Get full detail for a seasonal basket by ID, including composition and origin of items",
    { id: z.number().describe("The basket product ID") },
    async ({ id }) => {
      try {
        const detail = await PanierService.detail(id);
        if (!detail) {
          return { content: [{ type: "text", text: "Panier not found" }], isError: true };
        }
        return { content: [{ type: "text", text: JSON.stringify(detail, null, 2) }] };
      } catch {
        return {
          content: [{ type: "text", text: "Failed to fetch upstream data" }],
          isError: true,
        };
      }
    },
  );
}
