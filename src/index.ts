import { openapi } from "@elysiajs/openapi";
import { Elysia } from "elysia";

import { paniers } from "./modules/paniers";

const app = new Elysia()
  .use(
    openapi({
      documentation: {
        info: {
          title: "API",
          version: "1.0.0",
          description: "Thanaen's general-purpose API",
        },
        tags: [
          {
            name: "Paniers de l'Adour",
            description: "Scraper for panierdeladour.com seasonal baskets",
          },
        ],
      },
    }),
  )
  .use(paniers)
  .get("/", ({ redirect }) => redirect("https://thanaen.dev"), {
    detail: { hide: true },
  });

export default app;
