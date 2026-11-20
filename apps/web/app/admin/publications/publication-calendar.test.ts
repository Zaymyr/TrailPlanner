import { describe, expect, it } from "vitest";

import { buildMonthGrid, currentParisMonth, formatMonthTitle, getCalendarTime, shiftMonth } from "./publication-calendar";

type Post = { id: string; status: "draft" | "scheduled" | "publishing" | "published" | "failed"; publishedAt: string | null; scheduledAt: string | null };
const post = (id: string, status: Post["status"], publishedAt: string | null, scheduledAt: string | null = null): Post => ({ id, status, publishedAt, scheduledAt });

describe("publication calendar", () => {
  it("places published posts on their publication, scheduled ones on their slot, and skips drafts and failures", () => {
    expect(getCalendarTime(post("a", "published", "2026-11-12T08:00:00Z", "2026-11-11T08:00:00Z"))).toBe("2026-11-12T08:00:00Z");
    expect(getCalendarTime(post("b", "scheduled", null, "2026-11-20T17:00:00Z"))).toBe("2026-11-20T17:00:00Z");
    expect(getCalendarTime(post("c", "draft", null, null))).toBeNull();
    expect(getCalendarTime(post("d", "failed", null, "2026-11-20T17:00:00Z"))).toBeNull();
  });

  it("builds Monday-first weeks for November 2026 with the posts of each Paris day, in time order", () => {
    const weeks = buildMonthGrid(2026, 11, [
      post("late", "published", "2026-11-12T18:00:00Z"),
      post("early", "published", "2026-11-12T07:00:00Z"),
      // 23:30 UTC on 30 November is 00:30 on 1 December in Paris.
      post("night", "scheduled", null, "2026-11-30T23:30:00Z"),
      post("draft", "draft", null, null),
    ]);
    // 1 November 2026 is a Sunday: the first week starts on Monday 26 October.
    expect(weeks[0][0]).toMatchObject({ day: "2026-10-26", inMonth: false });
    expect(weeks[0][6]).toMatchObject({ day: "2026-11-01", inMonth: true });
    const days = weeks.flat();
    expect(days.find((day) => day.day === "2026-11-12")?.posts.map((item) => item.id)).toEqual(["early", "late"]);
    expect(days.find((day) => day.day === "2026-11-30")?.posts).toEqual([]);
    expect(days.find((day) => day.day === "2026-12-01")?.posts.map((item) => item.id)).toEqual(["night"]);
    expect(days.flatMap((day) => day.posts).map((item) => item.id)).not.toContain("draft");
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks.at(-1)?.some((day) => day.inMonth)).toBe(true);
  });

  it("moves between months and titles them in French", () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2027, month: 1 }, -1)).toEqual({ year: 2026, month: 12 });
    expect(formatMonthTitle({ year: 2026, month: 11 })).toBe("novembre 2026");
    expect(currentParisMonth(new Date("2026-11-30T23:30:00Z"))).toEqual({ year: 2026, month: 12 });
  });
});
