import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const consent = vi.hoisted(() => ({ allowed: true }));
vi.mock("./cookies/consent", () => ({ canLoadAnalytics: () => consent.allowed }));

import {
  isUpcomingRaceDate,
  parseRacePagePath,
  parseSourceRaceFromPath,
  readFunnelSourceRace,
  rememberFunnelSourceRace,
  resolveEstimateClick,
} from "./race-funnel-source";

const RACE_ID = "76b11657-f10a-49af-a728-18a58875ac4a";

describe("race funnel attribution", () => {
  it("reads the catalog race id from the runner return path only", () => {
    expect(parseSourceRaceFromPath(`/race-planner?catalogRaceId=${RACE_ID}`)).toBe(RACE_ID);
    expect(parseSourceRaceFromPath("/race-planner?catalogRaceId=not-a-uuid")).toBeNull();
    expect(parseSourceRaceFromPath(`/premium?catalogRaceId=${RACE_ID}`)).toBeNull();
    expect(parseSourceRaceFromPath(null)).toBeNull();
  });

  it("classifies public race pages from the pathname", () => {
    expect(parseRacePagePath("/courses/utmb-100")).toEqual({ pageType: "format", slug: "utmb-100" });
    expect(parseRacePagePath("/courses/evenements/utmb-2027")).toEqual({ pageType: "event", slug: "utmb-2027" });
    expect(parseRacePagePath("/courses/distances")).toBeNull();
    expect(parseRacePagePath("/courses")).toBeNull();
  });

  it("computes is_upcoming from the race date", () => {
    const now = new Date("2026-11-22T10:00:00Z");
    expect(isUpcomingRaceDate("2026-11-22", now)).toBe(true);
    expect(isUpcomingRaceDate("2026-11-21T08:00:00Z", now)).toBe(false);
    expect(isUpcomingRaceDate(null, now)).toBeNull();
  });

  it("resolves estimate clicks with declared or inferred placement", () => {
    const href = `/race-planner?catalogRaceId=${RACE_ID}`;
    expect(resolveEstimateClick({ href, placement: "sticky_bar" })).toEqual({ raceId: RACE_ID, placement: "sticky_bar" });
    expect(resolveEstimateClick({ href, inFormatList: true })).toEqual({ raceId: RACE_ID, placement: "format_list" });
    expect(resolveEstimateClick({ href, placement: "bogus" })).toEqual({ raceId: RACE_ID, placement: "other" });
    expect(resolveEstimateClick({ href: "/courses/foo" })).toBeNull();
  });

  describe("storage", () => {
    const storage = new Map<string, string>();
    const originalWindow = globalThis.window;

    beforeEach(() => {
      storage.clear();
      consent.allowed = true;
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
          localStorage: {
            getItem: (key: string) => storage.get(key) ?? null,
            setItem: (key: string, value: string) => storage.set(key, value),
            removeItem: (key: string) => storage.delete(key),
          },
        },
      });
    });
    afterEach(() => Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow }));

    it("remembers a valid race, ignores invalid ids and expires", () => {
      rememberFunnelSourceRace("nope");
      expect(readFunnelSourceRace()).toBeNull();
      rememberFunnelSourceRace(RACE_ID);
      expect(readFunnelSourceRace()).toBe(RACE_ID);
      const [key, value] = [...storage.entries()][0];
      storage.set(key, JSON.stringify({ ...JSON.parse(value), expiresAt: Date.now() - 1 }));
      expect(readFunnelSourceRace()).toBeNull();
    });

    it("stores nothing without analytics consent", () => {
      consent.allowed = false;
      rememberFunnelSourceRace(RACE_ID);
      expect(storage.size).toBe(0);
    });
  });
});
