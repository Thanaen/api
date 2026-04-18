import { NotFoundError, ThanaenApiError, UpstreamError } from "./errors";
import type { Movie, PanierDetail, PanierSummary, TimestampedResult } from "./types";
import { BUILT_FOR_API_VERSION, CLIENT_VERSION } from "./version";

export const DEFAULT_BASE_URL = "https://api.thanaen.dev";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ThanaenApiClientOptions {
  /** Override the API base URL. Useful for tests or self-hosting. Default: https://api.thanaen.dev */
  baseUrl?: string;
  /** Custom fetch implementation. Defaults to the global `fetch`. */
  fetch?: FetchLike;
  /** Extra headers sent on every request. */
  headers?: Record<string, string>;
}

export class ThanaenApiClient {
  readonly baseUrl: string;
  private readonly fetchFn: FetchLike;
  private readonly headers: Record<string, string>;

  readonly paniers = {
    list: (): Promise<TimestampedResult<PanierSummary[]>> =>
      this.request("/paniersdeladour/paniers/"),
    get: (id: number): Promise<TimestampedResult<PanierDetail>> =>
      this.request(`/paniersdeladour/paniers/${id}`),
  };

  readonly cinema = {
    movies: {
      list: (): Promise<TimestampedResult<Movie[]>> => this.request("/moncine/movies/"),
      get: (id: string): Promise<TimestampedResult<Movie>> =>
        this.request(`/moncine/movies/${encodeURIComponent(id)}`),
    },
  };

  constructor(options: ThanaenApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.fetchFn = options.fetch ?? globalThis.fetch;
    this.headers = {
      Accept: "application/json",
      "User-Agent": `@thanaen/api-client/${CLIENT_VERSION} (built-for-api/${BUILT_FOR_API_VERSION})`,
      "X-Client-Version": `${CLIENT_VERSION}; api=${BUILT_FOR_API_VERSION}`,
      ...options.headers,
    };
  }

  private async request<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await this.fetchFn(url, { method: "GET", headers: this.headers });

    if (response.ok) {
      return (await response.json()) as T;
    }

    const message = await readErrorMessage(response);
    if (response.status === 404) throw new NotFoundError(message, url);
    if (response.status === 502) throw new UpstreamError(message, url);
    throw new ThanaenApiError(message, response.status, url);
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === "string") return body.message;
  } catch {
    //
  }
  return `HTTP ${response.status} ${response.statusText}`.trim();
}
