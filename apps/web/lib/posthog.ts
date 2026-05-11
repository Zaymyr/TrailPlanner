import { PostHog } from "posthog-node";

import { POSTHOG_HOST, POSTHOG_KEY } from "./posthog-config";

let posthogClient: PostHog | null = null;

export function getPostHogClient(): PostHog | null {
  if (!POSTHOG_KEY) {
    return null;
  }

  if (!posthogClient) {
    posthogClient = new PostHog(POSTHOG_KEY, {
      host: POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogClient;
}
