import { createHash } from "node:crypto";

import { posthog } from "./posthog";

type Props = Record<string, unknown>;

const ANONYMOUS_DISTINCT_ID = "anonymous";
export const MCP_DISTINCT_ID = "mcp";

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

// Telemetry must never throw into business logic; all helpers swallow their own errors.
export function track(
  event: string,
  properties: Props,
  distinctId: string = ANONYMOUS_DISTINCT_ID,
): void {
  if (!posthog) return;
  try {
    posthog.capture({ distinctId, event, properties });
  } catch {}
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
  } catch {}
}

export async function trackedFetch(
  source: string,
  url: string,
  timeoutMs: number,
): Promise<Response> {
  const startedAt = Date.now();
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    track("upstream_fetch", {
      source,
      url,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      duration_ms: Date.now() - startedAt,
    });
    throw error;
  }
  track("upstream_fetch", {
    source,
    url,
    status_code: response.status,
    ok: response.ok,
    duration_ms: Date.now() - startedAt,
  });
  if (!response.ok) {
    throw new Error(`Upstream responded with ${response.status}`);
  }
  return response;
}

type McpContent = { type: "text"; text: string };
type McpToolResult = { content: McpContent[]; isError?: boolean };

interface McpCallOptions {
  tool: string;
  resourceId?: string | number;
  notFoundMessage?: string;
}

export async function withMcpTelemetry<T>(
  { tool, resourceId, notFoundMessage }: McpCallOptions,
  op: () => Promise<T | null>,
): Promise<McpToolResult> {
  const startedAt = Date.now();
  const baseProps: Props = resourceId === undefined ? { tool } : { tool, resource_id: resourceId };
  try {
    const result = await op();
    if (result === null && notFoundMessage !== undefined) {
      track(
        "mcp_tool_call",
        { ...baseProps, success: false, not_found: true, duration_ms: Date.now() - startedAt },
        MCP_DISTINCT_ID,
      );
      return { content: [{ type: "text", text: notFoundMessage }], isError: true };
    }
    track(
      "mcp_tool_call",
      { ...baseProps, success: true, duration_ms: Date.now() - startedAt },
      MCP_DISTINCT_ID,
    );
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    track(
      "mcp_tool_call",
      { ...baseProps, success: false, duration_ms: Date.now() - startedAt },
      MCP_DISTINCT_ID,
    );
    trackException(error, MCP_DISTINCT_ID, baseProps);
    return {
      content: [{ type: "text", text: "Failed to fetch upstream data" }],
      isError: true,
    };
  }
}
