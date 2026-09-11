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

  it("keeps masked formats for organizers and leaves unowned catalog events unchanged", () => {
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
    )).toEqual([
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
    ]);
  });

  it("keeps an organizer event when all of its formats are masked", () => {
    expect(getOrganizerDemoResults(
      [{ id: "event-a", races: [{ id: "race-masked", previewVisible: false }] }],
    )).toEqual([
      { id: "event-a", races: [{ id: "race-masked", previewVisible: false }] },
    ]);
  });
});
