import { describe, expect, it } from "vitest";

import { inboxCountsSchema, inboxTotals, withCount } from "./useInboxCounts";

describe("inboxTotals", () => {
  it("adds messages and organizer requests into the « À traiter » total", () => {
    const counts = inboxCountsSchema.parse({ bug: 2, feedback: 1, raceRequests: 2, demoRequests: 1, organizerTotal: 3 });
    expect(inboxTotals(counts)).toEqual({ messages: 6, organizers: 3, total: 9 });
  });

  it("is empty while the counts load", () => {
    expect(inboxTotals(undefined)).toEqual({ messages: undefined, organizers: undefined, total: undefined });
    expect(withCount("Bugs", undefined)).toBe("Bugs");
  });
});
