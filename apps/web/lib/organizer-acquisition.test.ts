import { describe, expect, it } from "vitest";

import {
  buildAuthCallbackPath,
  buildAuthHref,
  buildOrganizerCreationHref,
  extractOrganizerAttribution,
  normalizeInternalReturnPath,
} from "./organizer-acquisition";

describe("organizer acquisition attribution", () => {
  it("keeps only supported, non-empty UTM parameters", () => {
    const attribution = extractOrganizerAttribution(
      new URLSearchParams(
        "utm_source=cold-email&utm_medium=email&utm_campaign=orga-2026&utm_content=hero&utm_term=trail&gclid=secret",
      ),
    );

    expect(attribution).toEqual({
      utm_source: "cold-email",
      utm_medium: "email",
      utm_campaign: "orga-2026",
      utm_content: "hero",
      utm_term: "trail",
    });
    expect(buildOrganizerCreationHref(attribution)).toBe(
      "/organizers?utm_source=cold-email&utm_medium=email&utm_campaign=orga-2026&utm_content=hero&utm_term=trail",
    );
  });

  it("builds the plain creation route without attribution", () => {
    expect(buildOrganizerCreationHref({})).toBe("/organizers");
  });
});

describe("organizer auth return path", () => {
  it("accepts only the organizer creation route and supported UTM parameters", () => {
    expect(
      normalizeInternalReturnPath(
        "/organizers?utm_source=outreach&utm_campaign=tst&unknown=discarded",
      ),
    ).toBe("/organizers?utm_source=outreach&utm_campaign=tst");
  });

  it.each([
    "https://malicious.example/organizers",
    "//malicious.example/organizers",
    "/\\malicious.example/organizers",
    "/settings",
    "%2Forganizers",
  ])("rejects unsafe or unsupported return path %s", (candidate) => {
    expect(normalizeInternalReturnPath(candidate)).toBe("/race-planner");
  });

  it("falls back when no return path is provided", () => {
    expect(normalizeInternalReturnPath(undefined)).toBe("/race-planner");
  });

  it("encodes the validated return path for auth and OAuth callback URLs", () => {
    const next = "/organizers?utm_source=email";
    expect(buildAuthHref("/sign-in", next)).toBe(
      "/sign-in?next=%2Forganizers%3Futm_source%3Demail",
    );
    expect(buildAuthCallbackPath(next)).toBe(
      "/auth/callback?next=%2Forganizers%3Futm_source%3Demail",
    );
  });
});
