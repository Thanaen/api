import { CacheRepository } from "../../db/cache-repository";
import { Cache, secondsUntilNextWednesday4am } from "./cache";
import type { Movie, TimestampedResult } from "./model";

const BASE_URL = "https://www.moncine-anglet.com";
const THEATER = { id: "P9022", timeZone: "Europe/Paris" };
const LISTING_CACHE_KEY = "cinema:list";
const FETCH_TIMEOUT = 10_000;

interface UpstreamMovie {
  id: string;
  title: string;
  runtime: number;
  genres: string;
  poster: string;
  casting: string[];
  direction: string[];
  release: string;
  locale: { synopsis: string };
  studio: { name: string };
}

interface ScheduleResponse {
  [theaterId: string]: {
    schedule: Record<string, unknown>;
  };
}

function currentPlayWeekRange(): { from: string; to: string } {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sun, 2=Tue
  const daysSinceTuesday = (dayOfWeek - 2 + 7) % 7;

  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - daysSinceTuesday);
  from.setUTCHours(3, 0, 0, 0);

  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 7);

  return {
    from: from.toISOString().replace(".000Z", ""),
    to: to.toISOString().replace(".000Z", ""),
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });
  if (!response.ok) {
    throw new Error(`Upstream responded with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchScheduleMovieIds(): Promise<string[]> {
  const { from, to } = currentPlayWeekRange();
  const theaters = encodeURIComponent(JSON.stringify(THEATER));
  const url = `${BASE_URL}/api/gatsby-source-boxofficeapi/schedule?from=${from}&theaters=${theaters}&to=${to}`;

  const data = await fetchJson<ScheduleResponse>(url);
  const schedule = data[THEATER.id]?.schedule;
  if (!schedule) return [];

  return Object.keys(schedule);
}

export async function fetchMovies(ids: string[]): Promise<UpstreamMovie[]> {
  if (ids.length === 0) return [];

  const params = new URLSearchParams();
  params.set("basic", "false");
  params.set("castingLimit", "3");
  for (const id of ids) {
    params.append("ids", id);
  }

  const url = `${BASE_URL}/api/gatsby-source-boxofficeapi/movies?${params}`;
  return fetchJson<UpstreamMovie[]>(url);
}

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function mapToMovie(movie: UpstreamMovie): Movie {
  const title = movie.title ?? "";
  return {
    id: movie.id,
    title,
    genres: movie.genres ?? "",
    production: movie.studio?.name ?? "",
    casting: movie.casting ?? [],
    direction: movie.direction ?? [],
    poster: movie.poster ?? "",
    releaseDate: movie.release ?? "",
    runtime: movie.runtime ?? 0,
    synopsis: movie.locale?.synopsis ?? "",
    url: `${BASE_URL}/movies/${movie.id}-${slugify(title)}/`,
  };
}

export abstract class CinemaService {
  static async list(): Promise<TimestampedResult<Movie[]>> {
    const cached = Cache.getWithMeta<Movie[]>(LISTING_CACHE_KEY);
    if (cached) return cached;

    const dbCached = await CacheRepository.getWithMeta<Movie[]>(LISTING_CACHE_KEY);
    if (dbCached) {
      Cache.set(LISTING_CACHE_KEY, dbCached.data, secondsUntilNextWednesday4am() * 1000);
      return dbCached;
    }

    const ids = await fetchScheduleMovieIds();
    const upstream = await fetchMovies(ids);
    const movies = upstream.map(mapToMovie);
    const lastUpdated = new Date().toISOString();

    Cache.set(LISTING_CACHE_KEY, movies, secondsUntilNextWednesday4am() * 1000);
    await CacheRepository.set(LISTING_CACHE_KEY, movies, secondsUntilNextWednesday4am() * 1000);

    return { data: movies, lastUpdated };
  }

  static async detail(id: string): Promise<TimestampedResult<Movie> | null> {
    const cacheKey = `cinema:detail:${id}`;

    const cached = Cache.getWithMeta<Movie>(cacheKey);
    if (cached) return cached;

    const dbCached = await CacheRepository.getWithMeta<Movie>(cacheKey);
    if (dbCached) {
      Cache.set(cacheKey, dbCached.data, secondsUntilNextWednesday4am() * 1000);
      return dbCached;
    }

    const upstream = await fetchMovies([id]);
    if (upstream.length === 0) return null;

    const detail = mapToMovie(upstream[0]);
    const lastUpdated = new Date().toISOString();

    Cache.set(cacheKey, detail, secondsUntilNextWednesday4am() * 1000);
    await CacheRepository.set(cacheKey, detail, secondsUntilNextWednesday4am() * 1000);

    return { data: detail, lastUpdated };
  }
}
