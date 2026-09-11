import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  getOrganizerDemoResults,
  getRacebookOnboardingResults,
  isRacebookOnboardingSearchReady,
  mergeOrganizerCatalogEvents,
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
    expect(getRacebookOnboardingResults(events, (race) => race.published)).toEqual([
      { id: "event-a", races: [{ id: "race-published", published: true }] },
    ]);
  });

  it("keeps only events and formats whose RaceBook can be opened", () => {
    expect(getRacebookOnboardingResults(events, (race) => race.published)).toEqual([
      {
        id: "event-a",
        races: [{ id: "race-published", published: true }],
      },
    ]);
  });
});

describe("mobile organizer demo formats", () => {
  it("merges organizer-only private formats into their public event without duplicates", () => {
    expect(mergeOrganizerCatalogEvents(
      [{ id: "event-a", races: [{ id: "race-public", published: true }] }],
      [{
        id: "event-a",
        races: [
          { id: "race-public", published: true },
          { id: "race-private", published: false },
        ],
      }],
    )).toEqual([{
      id: "event-a",
      races: [
        { id: "race-public", published: true },
        { id: "race-private", published: false },
      ],
    }]);
  });

  it("removes masked formats from the mobile catalog", () => {
    const demoEvents = [
      {
        id: "event-a",
        races: [
          { id: "race-visible", previewVisible: true },
          { id: "race-masked", previewVisible: false },
        ],
      },
      {
        id: "event-b",
        races: [{ id: "race-public", previewVisible: false }],
      },
    ];

    expect(getOrganizerDemoResults(
      demoEvents,
      (race) => race.previewVisible,
    )).toEqual([
      {
        id: "event-a",
        races: [{ id: "race-visible", previewVisible: true }],
      },
    ]);
  });

  it("removes an event when all of its formats are masked", () => {
    expect(getOrganizerDemoResults(
      [{ id: "event-a", races: [{ id: "race-masked", previewVisible: false }] }],
      (race) => race.previewVisible,
    )).toEqual([]);
  });
});

describe("mobile runner catalog visibility", () => {
  it("loads preview-visible private formats without loading masked formats", () => {
    const source = readFileSync(new URL("../../mobile/app/(app)/catalog.tsx", import.meta.url), "utf8");

    expect(source).toContain(".eq('races.racebook_preview_is_visible', true)");
    expect(source).not.toContain(".eq('races.is_live', true)");
  });
});
