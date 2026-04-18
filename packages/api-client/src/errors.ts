export class ThanaenApiError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(message: string, status: number, url: string) {
    super(message);
    this.name = "ThanaenApiError";
    this.status = status;
    this.url = url;
  }
}

export class NotFoundError extends ThanaenApiError {
  constructor(message: string, url: string) {
    super(message, 404, url);
    this.name = "NotFoundError";
  }
}

export class UpstreamError extends ThanaenApiError {
  constructor(message: string, url: string) {
    super(message, 502, url);
    this.name = "UpstreamError";
  }
}
