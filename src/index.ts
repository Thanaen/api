import { openapi } from "@elysiajs/openapi";
import { Elysia } from "elysia";

import { cinema } from "./modules/cinema";
import { mcp } from "./modules/mcp";
import { paniers } from "./modules/paniers";
import { clientIp, hashIp, scheduleFlush, track, trackException } from "./telemetry";

const app = new Elysia()
  .derive(() => ({ requestStartedAt: Date.now() }))
  .onAfterResponse(async ({ request, set, route, requestStartedAt }) => {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const ip = clientIp(request);
    const statusCode = typeof set.status === "number" ? set.status : 200;

    track(
      "api_request",
      {
        route: route || pathname,
        path: pathname,
        method: request.method,
        status_code: statusCode,
        duration_ms: Date.now() - requestStartedAt,
        source: pathname.startsWith("/mcp") ? "mcp" : "rest",
        $useragent: request.headers.get("user-agent") ?? "",
      },
      hashIp(ip),
    );

    scheduleFlush();
  })
  .onError(({ error, code, request, route }) => {
    // Elysia handles validation / not-found / parse errors as expected control flow,
    // so only ship genuine failures to error tracking.
    if (code === "VALIDATION" || code === "NOT_FOUND" || code === "PARSE") return;

    const ip = clientIp(request);
    const url = new URL(request.url);
    trackException(error, hashIp(ip), {
      route: route || url.pathname,
      method: request.method,
      error_code: code,
    });
  })
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
