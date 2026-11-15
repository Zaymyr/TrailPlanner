import { describe, expect, it } from "vitest";

import {
  buildAuthCallbackPath,
  buildAuthHref,
  buildOrganizerCreationHref,
  clearRememberedRunnerReturnPath,
  extractOrganizerAttribution,
  normalizeInternalReturnPath,
  readCurrentReturnPath,
  readRememberedRunnerReturnPath,
  rememberRunnerReturnPath,
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
  it("accepts the organizer dashboard and retains only a valid event id", () => {
    expect(normalizeInternalReturnPath("/organizer")).toBe("/organizer");
    expect(normalizeInternalReturnPath("/organizer?eventId=discarded")).toBe("/organizer");
    expect(
      normalizeInternalReturnPath(
        "/organizer?eventId=4f4ab461-bbe0-4e03-851b-73a46751c16d&unknown=discarded",
      ),
    ).toBe("/organizer?eventId=4f4ab461-bbe0-4e03-851b-73a46751c16d");
  });

  it("accepts the organizer creation route and retains only supported UTM parameters", () => {
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
    "/organizer/other",
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
    expect(buildAuthCallbackPath("/organizer")).toBe(
      "/auth/callback?next=%2Forganizer",
    );
    expect(buildAuthHref("/sign-in", "/organizer?eventId=4f4ab461-bbe0-4e03-851b-73a46751c16d")).toBe(
      "/sign-in?next=%2Forganizer%3FeventId%3D4f4ab461-bbe0-4e03-851b-73a46751c16d",
    );
  });

  it("retains only validated runner context", () => {
    const raceId = "76b11657-f10a-49af-a728-18a58875ac4a";
    const planId = "4f4ab461-bbe0-4e03-851b-73a46751c16d";
    expect(normalizeInternalReturnPath(`/race-planner?catalogRaceId=${raceId}&discarded=yes`)).toBe(
      `/race-planner?catalogRaceId=${raceId}`,
    );
    expect(normalizeInternalReturnPath(`/premium?planId=${planId}&discarded=yes`)).toBe(
      `/premium?planId=${planId}`,
    );
    expect(normalizeInternalReturnPath("/race-planner?catalogRaceId=invalid")).toBe("/race-planner");
    expect(normalizeInternalReturnPath("/premium?planId=invalid")).toBe("/premium");
  });

  it("remembers a validated runner return across a new tab and expires it", () => {
    const racePath = "/race-planner?catalogRaceId=76b11657-f10a-49af-a728-18a58875ac4a";
    const storage = new Map<string, string>();
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: { search: `?next=${encodeURIComponent(racePath)}` },
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => storage.set(key, value),
          removeItem: (key: string) => storage.delete(key),
        },
      },
    });

    try {
      expect(readCurrentReturnPath()).toBe(racePath);
      expect(readRememberedRunnerReturnPath()).toBe(racePath);
      clearRememberedRunnerReturnPath();
      expect(readRememberedRunnerReturnPath()).toBeNull();

      rememberRunnerReturnPath(racePath);
      const [key, value] = [...storage.entries()][0];
      storage.set(key, JSON.stringify({ ...JSON.parse(value), expiresAt: Date.now() - 1 }));
      expect(readRememberedRunnerReturnPath()).toBeNull();
    } finally {
      Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
    }
  });
});
