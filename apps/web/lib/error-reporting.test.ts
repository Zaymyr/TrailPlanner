import { beforeEach, describe, expect, it, vi } from "vitest";

const trackGoogleAnalyticsEvent = vi.fn();

vi.mock("./google-analytics", () => ({
  trackGoogleAnalyticsEvent: (...args: unknown[]) => trackGoogleAnalyticsEvent(...args),
}));

import { reportClientError } from "./error-reporting";

describe("reportClientError", () => {
  beforeEach(() => trackGoogleAnalyticsEvent.mockClear());

  it("sends only coarse fields and never the message or stack", () => {
    const error = Object.assign(new TypeError("secret@example.com failed"), { digest: "abc123" });

    reportClientError(error, "app");

    expect(trackGoogleAnalyticsEvent).toHaveBeenCalledTimes(1);
    const [name, params] = trackGoogleAnalyticsEvent.mock.calls[0];
    expect(name).toBe("client error");
    expect(params).toEqual({ event_category: "error", source: "app", error_name: "TypeError", digest: "abc123" });
    expect(JSON.stringify(params)).not.toContain("secret@example.com");
  });

  it("omits the digest when absent", () => {
    reportClientError(new Error("boom"), "global");
    expect(trackGoogleAnalyticsEvent.mock.calls[0][1].digest).toBeUndefined();
  });
});
