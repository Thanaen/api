import { Elysia, ElysiaCustomStatusResponse, t } from "elysia";

import { secondsUntilNextWednesday4am } from "./cache";
import { cinemaModels } from "./model";
import { CinemaService } from "./service";

const errorResponse = t.Object(
  { message: t.String({ description: "Human-readable error message" }) },
  { description: "Error response" },
);

export const cinema = new Elysia({ name: "cinema", prefix: "/moncine/movies" })
  .use(cinemaModels)
  .onAfterHandle(({ set, response }) => {
    const statusCode =
      response instanceof ElysiaCustomStatusResponse ? response.code : (set.status ?? 200);
    if (statusCode === 200) {
      const sMaxAge = secondsUntilNextWednesday4am();
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
        return await CinemaService.list();
      } catch {
        return status(502, { message: "Failed to fetch upstream data" });
      }
    },
    {
      response: {
        200: "cinema.movie.list",
        502: errorResponse,
      },
      detail: {
        operationId: "listCinemaMovies",
        summary: "List movies currently showing at Mon Ciné Anglet",
        description:
          "Returns all movies currently showing at Mon Ciné Anglet cinema. Each entry includes the movie title, genres, poster, release date, and runtime. Responses are cached until the next Wednesday (French movie release day) and include a `lastUpdated` timestamp indicating data freshness.",
        tags: ["Mon Ciné Anglet"],
      },
    },
  )
  .get(
    "/:id",
    async ({ params: { id }, status }) => {
      try {
        const result = await CinemaService.detail(id);
        if (!result) return status(404, { message: "Movie not found" });
        return result;
      } catch {
        return status(502, { message: "Failed to fetch upstream data" });
      }
    },
    {
      params: t.Object({
        id: t.String({ description: "Unique movie ID", example: "317669" }),
      }),
      response: {
        200: "cinema.movie",
        404: errorResponse,
        502: errorResponse,
      },
      detail: {
        operationId: "getCinemaMovieById",
        summary: "Get movie detail by ID",
        description:
          "Returns full details for a specific movie currently showing at Mon Ciné Anglet, including synopsis, casting, direction, and production studio. Returns 404 if no movie matches the given ID.",
        tags: ["Mon Ciné Anglet"],
      },
    },
  );
