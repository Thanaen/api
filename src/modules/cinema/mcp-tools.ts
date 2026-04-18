import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { track, trackException } from "../../telemetry";
import { CinemaService } from "./service";

const MCP_DISTINCT_ID = "mcp";

export function registerCinemaTools(server: McpServer) {
  server.tool(
    "list_cinema_movies",
    "List all movies currently showing at Mon Ciné Anglet cinema, with full details including title, genres, synopsis, casting, direction, production, poster, release date, runtime, and a direct URL to the movie page. Includes a lastUpdated timestamp.",
    async () => {
      const startedAt = Date.now();
      try {
        const movies = await CinemaService.list();
        track(
          "mcp_tool_call",
          {
            tool: "list_cinema_movies",
            success: true,
            duration_ms: Date.now() - startedAt,
          },
          MCP_DISTINCT_ID,
        );
        return { content: [{ type: "text", text: JSON.stringify(movies, null, 2) }] };
      } catch (error) {
        track(
          "mcp_tool_call",
          {
            tool: "list_cinema_movies",
            success: false,
            duration_ms: Date.now() - startedAt,
          },
          MCP_DISTINCT_ID,
        );
        trackException(error, MCP_DISTINCT_ID, { tool: "list_cinema_movies" });
        return {
          content: [{ type: "text", text: "Failed to fetch upstream data" }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "get_cinema_movie_detail",
    "Get full details for a movie by ID, including synopsis, casting, direction, production studio, and a direct URL to the movie page. Includes a lastUpdated timestamp.",
    { id: z.string().describe("The movie ID") },
    async ({ id }) => {
      const startedAt = Date.now();
      try {
        const detail = await CinemaService.detail(id);
        if (!detail) {
          track(
            "mcp_tool_call",
            {
              tool: "get_cinema_movie_detail",
              success: false,
              not_found: true,
              resource_id: id,
              duration_ms: Date.now() - startedAt,
            },
            MCP_DISTINCT_ID,
          );
          return { content: [{ type: "text", text: "Movie not found" }], isError: true };
        }
        track(
          "mcp_tool_call",
          {
            tool: "get_cinema_movie_detail",
            success: true,
            resource_id: id,
            duration_ms: Date.now() - startedAt,
          },
          MCP_DISTINCT_ID,
        );
        return { content: [{ type: "text", text: JSON.stringify(detail, null, 2) }] };
      } catch (error) {
        track(
          "mcp_tool_call",
          {
            tool: "get_cinema_movie_detail",
            success: false,
            resource_id: id,
            duration_ms: Date.now() - startedAt,
          },
          MCP_DISTINCT_ID,
        );
        trackException(error, MCP_DISTINCT_ID, {
          tool: "get_cinema_movie_detail",
          resource_id: id,
        });
        return {
          content: [{ type: "text", text: "Failed to fetch upstream data" }],
          isError: true,
        };
      }
    },
  );
}
