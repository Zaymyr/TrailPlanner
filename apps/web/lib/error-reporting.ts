import { trackGoogleAnalyticsEvent } from "./google-analytics";

export type ClientErrorSource = "global" | "app" | "organizer" | "planner" | "admin";

type ErrorWithDigest = Error & { digest?: string };

// Reports a runtime render error through the consent-gated analytics helper
// (no-op without cookie consent). Only coarse, non-identifying fields are sent:
// never the error message or stack, which can embed user data or URLs.
export function reportClientError(error: ErrorWithDigest, source: ClientErrorSource) {
  trackGoogleAnalyticsEvent("client error", {
    event_category: "error",
    source,
    error_name: typeof error?.name === "string" ? error.name.slice(0, 80) : "Error",
    digest: typeof error?.digest === "string" ? error.digest.slice(0, 80) : undefined,
  });
}
