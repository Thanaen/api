import { PostHog } from "posthog-node";

const apiKey = process.env.POSTHOG_API_KEY;

export const posthog = apiKey
  ? new PostHog(apiKey, {
      host: process.env.POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    })
  : null;
