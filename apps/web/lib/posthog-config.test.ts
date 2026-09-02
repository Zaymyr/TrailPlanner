import { describe, expect, it } from "vitest";

import {
  buildSanitizedAnalyticsPath,
  buildWebAcquisitionProperties,
  getWebPageGroup,
} from "./posthog-config";

describe("PostHog web analytics helpers", () => {
  it("removes sensitive query values from page paths", () => {
    const params = new URLSearchParams("utm_source=newsletter&token=secret&email=a%40example.com");
    expect(buildSanitizedAnalyticsPath("/onboarding", params)).toBe("/onboarding?utm_source=newsletter");
  });

  it("extracts campaign attribution without retaining the full referrer URL", () => {
    const properties = buildWebAcquisitionProperties(
      new URLSearchParams("utm_source=club&utm_medium=email&utm_campaign=launch"),
      "https://example.org/private/path?token=secret",
      "https://paceyourself.app",
    );
    expect(properties).toMatchObject({
      traffic_channel: "campaign",
      traffic_source: "club",
      traffic_medium: "email",
      traffic_campaign: "launch",
      referring_domain: "example.org",
    });
    expect(JSON.stringify(properties)).not.toContain("private/path");
    expect(JSON.stringify(properties)).not.toContain("secret");
  });

  it("classifies direct, search, and product areas", () => {
    expect(buildWebAcquisitionProperties(null, null, "https://paceyourself.app").traffic_channel).toBe("direct");
    expect(buildWebAcquisitionProperties(null, "https://www.google.fr/search?q=trail", "https://paceyourself.app").traffic_channel).toBe("organic_search");
    expect(getWebPageGroup("/organizer/events/123")).toBe("organizer_dashboard");
    expect(getWebPageGroup("/onboarding/profile")).toBe("onboarding");
  });
});
