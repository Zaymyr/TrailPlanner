import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn }));

import { groupTimelineByDay, supporterFollowPath } from "./public-supporter-guide";

const entry = (id: string, date: string | null, time: string) => ({
  id, raceId: "race", raceName: "Ultra", kind: "start" as const, date, time, label: null, location: null,
});

describe("public supporter guide helpers", () => {
  it("builds the indexable follow path under the event edition", () => {
    expect(supporterFollowPath("ultra-des-cimes-2027")).toBe("/courses/evenements/ultra-des-cimes-2027/suivre");
  });

  it("groups the programme by day and keeps undated entries together", () => {
    const days = groupTimelineByDay([
      entry("a", "2027-09-25", "07:00"),
      entry("b", "2027-09-25", "09:00"),
      entry("c", "2027-09-26", "06:00"),
      entry("d", null, "10:00"),
    ]);
    expect(days.map((day) => [day.date, day.entries.map((item) => item.id)])).toEqual([
      ["2027-09-25", ["a", "b"]],
      ["2027-09-26", ["c"]],
      [null, ["d"]],
    ]);
  });
});
