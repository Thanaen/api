import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { CinemaService } from "./service";

export function registerCinemaTools(server: McpServer) {
  server.tool(
    "list_cinema_movies",
    "List all movies currently showing at Mon Ciné Anglet cinema, with full details including title, genres, synopsis, casting, direction, production, poster, release date, and runtime. Includes a lastUpdated timestamp.",
    async () => {
      try {
        const movies = await CinemaService.list();
        return { content: [{ type: "text", text: JSON.stringify(movies, null, 2) }] };
      } catch {
        return {
          content: [{ type: "text", text: "Failed to fetch upstream data" }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "get_cinema_movie_detail",
    "Get full details for a movie by ID, including synopsis, casting, direction, and production studio. Includes a lastUpdated timestamp.",
    { id: z.string().describe("The movie ID") },
    async ({ id }) => {
      try {
        const detail = await CinemaService.detail(id);
        if (!detail) {
          return { content: [{ type: "text", text: "Movie not found" }], isError: true };
        }
        return { content: [{ type: "text", text: JSON.stringify(detail, null, 2) }] };
      } catch {
        return {
          content: [{ type: "text", text: "Failed to fetch upstream data" }],
          isError: true,
        };
      }
    },
  );
}
