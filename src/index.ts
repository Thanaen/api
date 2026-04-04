import { openapi } from "@elysiajs/openapi";
import { Elysia } from "elysia";

import { cinema } from "./modules/cinema";
import { mcp } from "./modules/mcp";
import { paniers } from "./modules/paniers";

const app = new Elysia()
  .use(
    openapi({
      documentation: {
        info: {
          title: "Thanaen API",
          version: "1.0.0",
          description:
            "Public API providing structured JSON access to data scraped from partner sites. Responses are cached and include a `lastUpdated` timestamp indicating when the upstream data was last fetched.",
          contact: {
            name: "Thanaen",
            url: "https://thanaen.dev",
          },
        },
        tags: [
          {
            name: "Paniers de l'Adour",
            description:
              "Seasonal baskets from panierdeladour.com — list available baskets or get full details including composition and product origins.",
          },
          {
            name: "Mon Ciné Anglet",
            description:
              "Movies currently showing at Mon Ciné Anglet — list the current programme or get full details including synopsis, casting, and production.",
          },
        ],
        externalDocs: {
          description: "Source code",
          url: "https://github.com/Thanaen/api",
        },
      },
    }),
  )
  .use(paniers)
  .use(cinema)
  .use(mcp)
  .get("/", ({ redirect }) => redirect("https://thanaen.dev"), {
    detail: { hide: true },
  });

export default app;
