import { ensurePostHogBrowserInit, getPostHogBrowserClient, isPostHogBrowserReady } from "./posthog-browser";
import { canLoadAnalytics } from "./cookies/consent";

type AnalyticsValue = string | number | boolean | null | undefined;
export type AnalyticsParams = Record<string, AnalyticsValue>;

type GtagCommand = [command: string, ...args: unknown[]];

declare global {
  interface Window {
    dataLayer?: GtagCommand[];
    gtag?: (...args: GtagCommand) => void;
  }
}

function removeUndefinedParams(params: AnalyticsParams): Record<string, string | number | boolean | null> {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined),
  ) as Record<string, string | number | boolean | null>;
}

/**
 * Mirrors a consented event to PostHog with the same name and properties.
 * Child trackers run their effects before PostHogProvider's init effect, so the
 * client is initialised lazily here (consent was already checked by the caller);
 * otherwise the first funnel events of a page view would only reach GA.
 * Never throws: analytics must not break the UI.
 */
function forwardToPostHog(eventName: string, payload: Record<string, string | number | boolean | null>) {
  try {
    if (!isPostHogBrowserReady() && !ensurePostHogBrowserInit(true)) {
      return;
    }
    getPostHogBrowserClient().capture(eventName, payload);
  } catch {
    // Ignore PostHog failures.
  }
}

export function trackGoogleAnalyticsEvent(eventName: string, params: AnalyticsParams = {}) {
  if (typeof window === "undefined" || !canLoadAnalytics()) {
    return;
  }

  const payload = removeUndefinedParams(params);

  forwardToPostHog(eventName, payload);

  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, payload);
    return;
  }

  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push(["event", eventName, payload]);
}

export function trackOnboardingEvent(action: string, params: AnalyticsParams = {}) {
  trackGoogleAnalyticsEvent(`onboarding_${action}`, {
    event_category: "onboarding",
    ...params,
  });
}
