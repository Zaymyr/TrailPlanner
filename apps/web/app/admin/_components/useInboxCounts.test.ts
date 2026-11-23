import { describe, expect, it } from "vitest";

import { countedInboxTotal, INBOX_TYPE_CONFIG, INBOX_TYPES } from "../../../lib/admin-inbox";
import { inboxCountsSchema, inboxTotals, withCount } from "./useInboxCounts";

describe("inboxTotals", () => {
  it("adds messages, organizer requests and system items into the « À traiter » total", () => {
    const counts = inboxCountsSchema.parse({ bug: 2, feedback: 1, raceRequests: 2, demoRequests: 1, organizerTotal: 3, systemTotal: 4 });
    expect(inboxTotals(counts)).toEqual({ messages: 6, organizers: 3, system: 4, total: 13 });
  });

  it("keeps working with counts from before the system items", () => {
    const counts = inboxCountsSchema.parse({ bug: 1, feedback: 0, raceRequests: 0, organizerTotal: 0 });
    expect(inboxTotals(counts).total).toBe(1);
    expect(counts.failedFlyovers).toBeNull();
  });

  it("is empty while the counts load", () => {
    expect(inboxTotals(undefined)).toEqual({ messages: undefined, organizers: undefined, system: undefined, total: undefined });
    expect(withCount("Bugs", undefined)).toBe("Bugs");
  });

  it("counts the same types as the queue (every type but race data)", () => {
    const counts = Object.fromEntries(INBOX_TYPES.map((type) => [type, 1]));
    expect(countedInboxTotal(counts)).toBe(INBOX_TYPES.length - 1);
    expect(INBOX_TYPES.filter((type) => !INBOX_TYPE_CONFIG[type].counted)).toEqual(["race_data"]);
  });
});
