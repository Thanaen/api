import { Elysia, t } from "elysia";

import { secondsUntilNextSaturday1am } from "./cache";
import { panierModels } from "./model";
import { PanierService } from "./service";

const errorResponse = t.Object({ message: t.String() });

export const paniers = new Elysia({ name: "paniers", prefix: "/paniersdeladour/paniers" })
  .use(panierModels)
  .mapResponse(({ set, responseValue }) => {
    const status = set.status ?? (responseValue instanceof Response ? responseValue.status : 200);
    if (status === 200) {
      const sMaxAge = secondsUntilNextSaturday1am();
      set.headers["cache-control"] =
        `public, max-age=300, s-maxage=${sMaxAge}, stale-while-revalidate=3600`;
    } else {
      set.headers["cache-control"] = "no-store";
    }
  })
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
      detail: { summary: "List all paniers de saison", tags: ["Paniers de l'Adour"] },
    },
  )
  .get(
    "/:id",
    async ({ params: { id }, status }) => {
      try {
        const result = await PanierService.detail(id);
        if (!result) return status(404, { message: "Panier not found" });
        return result;
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
      detail: { summary: "Get panier detail by ID", tags: ["Paniers de l'Adour"] },
    },
  );
