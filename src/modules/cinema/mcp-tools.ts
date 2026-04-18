import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { withMcpTelemetry } from "../../telemetry";
import { CinemaService } from "./service";

export function registerCinemaTools(server: McpServer) {
  server.tool(
    "list_cinema_movies",
    "List all movies currently showing at Mon Ciné Anglet cinema, with full details including title, genres, synopsis, casting, direction, production, poster, release date, runtime, and a direct URL to the movie page. Includes a lastUpdated timestamp.",
    () => withMcpTelemetry({ tool: "list_cinema_movies" }, () => CinemaService.list()),
  );

  server.tool(
    "get_cinema_movie_detail",
    "Get full details for a movie by ID, including synopsis, casting, direction, production studio, and a direct URL to the movie page. Includes a lastUpdated timestamp.",
    { id: z.string().describe("The movie ID") },
    ({ id }) =>
      withMcpTelemetry(
        { tool: "get_cinema_movie_detail", resourceId: id, notFoundMessage: "Movie not found" },
        () => CinemaService.detail(id),
      ),
  );
}
