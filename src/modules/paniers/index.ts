import { Elysia, t } from "elysia";

import { panierModels } from "./model";
import { PanierService } from "./service";

const errorResponse = t.Object({ message: t.String() });

export const paniers = new Elysia({ name: "paniers", prefix: "/paniersdeladour/paniers" })
  .use(panierModels)
  .get(
    "/",
    async ({ status }) => {
      try {
        return await PanierService.list();
      } catch {
        return status(502, { message: "Failed to fetch upstream data" });
      }
    },
    {
      response: {
        200: "panier.list",
        502: errorResponse,
      },
      detail: { summary: "List all paniers de saison" },
    },
  )
  .get(
    "/:id",
    async ({ params: { id }, status }) => {
      try {
        const detail = await PanierService.detail(id);
        if (!detail) return status(404, { message: "Panier not found" });
        return detail;
      } catch {
        return status(502, { message: "Failed to fetch upstream data" });
      }
    },
    {
      params: t.Object({ id: t.Number() }),
      response: {
        200: "panier.detail",
        404: errorResponse,
        502: errorResponse,
      },
      detail: { summary: "Get panier detail by ID" },
    },
  );
