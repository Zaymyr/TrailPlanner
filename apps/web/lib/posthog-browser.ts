"use client";

import posthog from "posthog-js";

import { POSTHOG_HOST, POSTHOG_KEY } from "./posthog-config";

let posthogInitialized = false;

export function hasPostHogBrowserKey() {
  return POSTHOG_KEY.length > 0;
}

export function ensurePostHogBrowserInit(isAnalyticsEnabled: boolean) {
  if (!hasPostHogBrowserKey()) {
    return false;
  }

  if (!posthogInitialized) {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: false,
      defaults: "2026-01-30",
      opt_out_capturing_by_default: !isAnalyticsEnabled,
    });
    posthogInitialized = true;
  }

  return true;
}

export function isPostHogBrowserReady() {
  return posthogInitialized;
}

export function getPostHogBrowserClient() {
  return posthog;
}
