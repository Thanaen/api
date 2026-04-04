import type { TSchema } from "@sinclair/typebox";
import { Elysia, t } from "elysia";

export const Movie = t.Object(
  {
    id: t.String({ description: "Unique movie ID from the cinema database", example: "317669" }),
    title: t.String({ description: "Movie title", example: "Marsupilami" }),
    genres: t.String({
      description: "Comma-separated list of genres",
      example: "Comédie, Aventure, Famille",
    }),
    production: t.String({
      description: "Production studio or distributor name",
      example: "Pathé Films",
    }),
    casting: t.Array(t.String(), {
      description: "List of main actors",
      examples: ["Philippe Lacheau", "Jamel Debbouze"],
    }),
    direction: t.Array(t.String(), {
      description: "List of directors",
      examples: ["Philippe Lacheau"],
    }),
    poster: t.String({
      description: "URL of the movie poster image",
      example: "https://all.web.img.acsta.net/img/b2/cb/b2cb998b62863d43cdd9a5f49c5ea4e6.jpg",
    }),
    releaseDate: t.String({
      description: "Release date in France (ISO 8601)",
      example: "2026-02-04T00:00:00.000Z",
    }),
    runtime: t.Number({ description: "Runtime in seconds", example: 5940 }),
    synopsis: t.String({
      description: "Movie synopsis in French",
      example:
        "Pour sauver son emploi, David accepte un plan foireux : ramener un mystérieux colis d'Amérique du Sud...",
    }),
    url: t.String({
      description: "Direct link to the movie page on Mon Ciné Anglet",
      example: "https://www.moncine-anglet.com/movies/317669-marsupilami/",
    }),
  },
  { description: "A movie currently showing at the cinema" },
);
export type Movie = typeof Movie.static;

export const TimestampedResponse = <T extends TSchema>(dataSchema: T) =>
  t.Object({
    data: dataSchema,
    lastUpdated: t.String({
      format: "date-time",
      description: "ISO 8601 timestamp of when the data was last fetched from the upstream site",
      example: "2026-03-28T10:30:00.000Z",
    }),
  });

export type TimestampedResult<T> = { data: T; lastUpdated: string };

export const cinemaModels = new Elysia({ name: "cinema.models" }).model({
  "cinema.movie": TimestampedResponse(Movie),
  "cinema.movie.list": TimestampedResponse(t.Array(Movie)),
});
