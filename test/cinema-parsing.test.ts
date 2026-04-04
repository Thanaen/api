import { describe, expect, test } from "bun:test";

import { secondsUntilNextWednesday4am } from "../src/modules/cinema/cache";
import { mapToMovieDetail, mapToMovieSummary } from "../src/modules/cinema/service";
import moviesFixture from "./fixtures/cinema-movies.json";
import scheduleFixture from "./fixtures/cinema-schedule.json";

describe("secondsUntilNextWednesday4am", () => {
  test("returns a positive number", () => {
    expect(secondsUntilNextWednesday4am()).toBeGreaterThan(0);
  });

  test("returns at least 60 seconds", () => {
    expect(secondsUntilNextWednesday4am()).toBeGreaterThanOrEqual(60);
  });
});

describe("schedule parsing", () => {
  test("extracts movie IDs from schedule response", () => {
    const schedule = scheduleFixture.P9022.schedule;
    const ids = Object.keys(schedule);
    expect(ids.sort()).toEqual(["1000016304", "317669", "327878"]);
  });

  test("handles empty schedule", () => {
    const empty = { P9022: { schedule: {} } };
    expect(Object.keys(empty.P9022.schedule)).toEqual([]);
  });
});

describe("mapToMovieSummary", () => {
  const summary = mapToMovieSummary(moviesFixture[0] as Parameters<typeof mapToMovieSummary>[0]);

  test("maps id", () => {
    expect(summary.id).toBe("317669");
  });

  test("maps title", () => {
    expect(summary.title).toBe("Marsupilami");
  });

  test("maps genres", () => {
    expect(summary.genres).toBe("Comédie, Aventure, Famille");
  });

  test("maps poster", () => {
    expect(summary.poster).toContain("acsta.net");
  });

  test("maps releaseDate", () => {
    expect(summary.releaseDate).toBe("2026-02-04T00:00:00.000Z");
  });

  test("maps runtime", () => {
    expect(summary.runtime).toBe(5940);
  });

  test("maps synopsis from locale", () => {
    expect(summary.synopsis).toBe("Pour sauver son emploi, David accepte un plan foireux.");
  });
});

describe("mapToMovieDetail", () => {
  const detail = mapToMovieDetail(moviesFixture[0] as Parameters<typeof mapToMovieDetail>[0]);

  test("maps all summary fields", () => {
    expect(detail.id).toBe("317669");
    expect(detail.title).toBe("Marsupilami");
    expect(detail.genres).toBe("Comédie, Aventure, Famille");
    expect(detail.runtime).toBe(5940);
  });

  test("maps production from studio.name", () => {
    expect(detail.production).toBe("Pathé Films");
  });

  test("maps casting array", () => {
    expect(detail.casting).toEqual(["Philippe Lacheau", "Jamel Debbouze", "Élodie Fontan"]);
  });

  test("maps direction array", () => {
    expect(detail.direction).toEqual(["Philippe Lacheau"]);
  });

  test("maps synopsis from locale", () => {
    expect(detail.synopsis).toBe("Pour sauver son emploi, David accepte un plan foireux.");
  });

  test("handles missing optional fields gracefully", () => {
    const minimal = mapToMovieDetail({
      id: "999",
      title: "Test",
      runtime: 0,
      genres: "",
      poster: "",
      casting: [],
      direction: [],
      release: "",
      locale: { synopsis: "" },
      studio: { name: "" },
    });
    expect(minimal.production).toBe("");
    expect(minimal.casting).toEqual([]);
    expect(minimal.synopsis).toBe("");
  });
});
