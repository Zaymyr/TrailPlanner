import { describe, expect, it } from "vitest";

import {
  getRacebookOnboardingResults,
  isRacebookOnboardingSearchReady,
} from "../../mobile/lib/racebookOnboarding";

type TestRace = { id: string; published: boolean };
type TestEvent = { id: string; races: TestRace[] };

const events: TestEvent[] = [
  {
    id: "event-a",
    races: [
      { id: "race-published", published: true },
      { id: "race-hidden", published: false },
    ],
  },
  {
    id: "event-b",
    races: [{ id: "race-unavailable", published: false }],
  },
];

describe("mobile RaceBook onboarding search", () => {
  it("requires a deliberate search before showing results", () => {
    expect(isRacebookOnboardingSearchReady(" ")).toBe(false);
    expect(isRacebookOnboardingSearchReady("u")).toBe(false);
    expect(isRacebookOnboardingSearchReady(" UT ")).toBe(true);
    expect(getRacebookOnboardingResults(events, "u", (race) => race.published)).toEqual([]);
  });

  it("keeps only events and formats whose RaceBook can be opened", () => {
    expect(getRacebookOnboardingResults(events, "utmb", (race) => race.published)).toEqual([
      {
        id: "event-a",
        races: [{ id: "race-published", published: true }],
      },
    ]);
  });
});
