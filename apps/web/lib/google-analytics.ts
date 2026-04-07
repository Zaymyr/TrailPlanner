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

export function trackGoogleAnalyticsEvent(eventName: string, params: AnalyticsParams = {}) {
  if (typeof window === "undefined" || !canLoadAnalytics()) {
    return;
  }

  const payload = removeUndefinedParams(params);

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
