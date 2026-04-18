import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { withMcpTelemetry } from "../../telemetry";
import { PanierService } from "./service";

export function registerPanierTools(server: McpServer) {
  server.tool(
    "list_paniers",
    "List all seasonal baskets from panierdeladour.com with name, price, and image. Includes a lastUpdated timestamp.",
    () => withMcpTelemetry({ tool: "list_paniers" }, () => PanierService.list()),
  );

  server.tool(
    "get_panier_detail",
    "Get full detail for a seasonal basket by ID, including composition and origin of items. Includes a lastUpdated timestamp.",
    { id: z.number().describe("The basket product ID") },
    ({ id }) =>
      withMcpTelemetry(
        { tool: "get_panier_detail", resourceId: id, notFoundMessage: "Panier not found" },
        () => PanierService.detail(id),
      ),
  );
}
