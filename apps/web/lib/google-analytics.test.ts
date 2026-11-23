import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const capture = vi.fn();
const ensureInit = vi.fn();
let ready = false;
let consent = true;

vi.mock("./posthog-browser", () => ({
  ensurePostHogBrowserInit: (...args: unknown[]) => ensureInit(...args),
  getPostHogBrowserClient: () => ({ capture }),
  isPostHogBrowserReady: () => ready,
}));
vi.mock("./cookies/consent", () => ({ canLoadAnalytics: () => consent }));

import { trackGoogleAnalyticsEvent } from "./google-analytics";

describe("trackGoogleAnalyticsEvent PostHog forwarding", () => {
  beforeEach(() => {
    capture.mockReset();
    ensureInit.mockReset();
    ensureInit.mockReturnValue(true);
    ready = true;
    consent = true;
    vi.stubGlobal("window", { gtag: vi.fn() });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("forwards the same name and properties, dropping undefined values", () => {
    trackGoogleAnalyticsEvent("quick estimate open plan", { a: 1, b: undefined });
    expect(capture).toHaveBeenCalledWith("quick estimate open plan", { a: 1 });
    expect(window.gtag).toHaveBeenCalledWith("event", "quick estimate open plan", { a: 1 });
  });

  it("lazily initialises PostHog when a tracker fires before the provider effect", () => {
    ready = false;
    trackGoogleAnalyticsEvent("race page viewed", {});
    expect(ensureInit).toHaveBeenCalledWith(true);
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it("skips PostHog without a browser key but still reaches GA", () => {
    ready = false;
    ensureInit.mockReturnValue(false);
    trackGoogleAnalyticsEvent("race page viewed", {});
    expect(capture).not.toHaveBeenCalled();
    expect(window.gtag).toHaveBeenCalled();
  });

  it("does not throw when PostHog capture fails", () => {
    capture.mockImplementation(() => {
      throw new Error("boom");
    });
    expect(() => trackGoogleAnalyticsEvent("plan exported")).not.toThrow();
    expect(window.gtag).toHaveBeenCalled();
  });

  it("captures nothing without consent", () => {
    consent = false;
    trackGoogleAnalyticsEvent("plan exported");
    expect(ensureInit).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
  });

  it("captures nothing on the server", () => {
    vi.unstubAllGlobals();
    expect(() => trackGoogleAnalyticsEvent("plan exported")).not.toThrow();
    expect(capture).not.toHaveBeenCalled();
  });
});
