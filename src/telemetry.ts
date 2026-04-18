import { createHash } from "node:crypto";

import { posthog } from "./posthog";

type Props = Record<string, unknown>;

const ANONYMOUS_DISTINCT_ID = "anonymous";

export function hashIp(ip: string | null | undefined): string {
  if (!ip) return ANONYMOUS_DISTINCT_ID;
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip");
}

export function track(
  event: string,
  properties: Props,
  distinctId: string = ANONYMOUS_DISTINCT_ID,
): void {
  if (!posthog) return;
  try {
    posthog.capture({ distinctId, event, properties });
  } catch {
    // Never break a request because of telemetry
  }
}

export function trackException(
  error: unknown,
  distinctId: string = ANONYMOUS_DISTINCT_ID,
  additionalProperties: Props = {},
): void {
  if (!posthog) return;
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    posthog.captureException(err, distinctId, additionalProperties);
  } catch {
    // Swallow telemetry errors
  }
}

export async function flush(): Promise<void> {
  if (!posthog) return;
  try {
    await posthog.flush();
  } catch {
    // Swallow flush errors
  }
}
