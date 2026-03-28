import { Elysia, ElysiaCustomStatusResponse, t } from "elysia";

import { secondsUntilNextSaturday1am } from "./cache";
import { panierModels } from "./model";
import { PanierService } from "./service";

const errorResponse = t.Object(
  { message: t.String({ description: "Human-readable error message" }) },
  { description: "Error response" },
);

export const paniers = new Elysia({ name: "paniers", prefix: "/paniersdeladour/paniers" })
  .use(panierModels)
  .onAfterHandle(({ set, response }) => {
    const statusCode =
      response instanceof ElysiaCustomStatusResponse ? response.code : (set.status ?? 200);
    if (statusCode === 200) {
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
      detail: {
        operationId: "listPaniers",
        summary: "List all paniers de saison",
        description:
          "Returns all seasonal baskets currently available on panierdeladour.com. Each entry includes the basket name, price, and image. Responses are cached and include a `lastUpdated` timestamp indicating data freshness.",
        tags: ["Paniers de l'Adour"],
      },
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
      params: t.Object({
        id: t.Number({ description: "Unique product ID of the basket", example: 42 }),
      }),
      response: {
        200: "panier.detail",
        404: errorResponse,
        502: errorResponse,
      },
      detail: {
        operationId: "getPanierById",
        summary: "Get panier detail by ID",
        description:
          "Returns full details for a specific seasonal basket, including its description, weight, servings, and a composition table listing each product with its geographic origin. Returns 404 if no basket matches the given ID.",
        tags: ["Paniers de l'Adour"],
      },
    },
  );
