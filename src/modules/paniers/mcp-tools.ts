import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { withMcpTelemetry } from "../../telemetry";
import { PanierService } from "./service";

export function registerPanierTools(server: McpServer) {
  server.registerTool(
    "list_paniers",
    {
      description:
        "List all seasonal baskets from panierdeladour.com with name, price, and image. Includes a lastUpdated timestamp.",
    },
    () => withMcpTelemetry({ tool: "list_paniers" }, () => PanierService.list()),
  );

  server.registerTool(
    "get_panier_detail",
    {
      description:
        "Get full detail for a seasonal basket by ID, including composition and origin of items. Includes a lastUpdated timestamp.",
      inputSchema: z.object({ id: z.number().describe("The basket product ID") }),
    },
    ({ id }) =>
      withMcpTelemetry(
        { tool: "get_panier_detail", resourceId: id, notFoundMessage: "Panier not found" },
        () => PanierService.detail(id),
      ),
  );
}
