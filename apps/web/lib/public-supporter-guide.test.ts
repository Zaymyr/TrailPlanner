import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn }));

import { getPublicSupporterGuide, groupTimelineByDay, supporterFollowPath } from "./public-supporter-guide";

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

describe("getPublicSupporterGuide", () => {
  const edition = { id: "edition-1", formats: [{ id: "race-a" }, { id: "race-b" }] };
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

  it("uses an ISR-compatible cached fetch and skips formats that are not public", async () => {
    const calls: Array<{ url: string; init: RequestInit & { next?: { revalidate?: number; tags?: string[] } } }> = [];
    const fetchImpl = (async (url: URL, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return String(url).includes("race-a") ? json(404, {}) : json(200, { organizerPreview: false, formats: [{ raceId: "race-b" }] });
    }) as unknown as typeof fetch;
    const guide = await getPublicSupporterGuide(edition, fetchImpl);
    expect(guide?.formats).toHaveLength(1);
    expect(calls.map((call) => call.url)).toEqual([
      "https://pace-yourself.com/api/supporter-guide?raceId=race-a",
      "https://pace-yourself.com/api/supporter-guide?raceId=race-b",
    ]);
    expect(calls[0].init.cache).toBeUndefined();
    expect(calls[0].init.next).toEqual({ revalidate: 900, tags: ["racebook:edition:edition-1"] });
  });

  it("returns null when no format exposes a public guide", async () => {
    const fetchImpl = (async () => json(404, {})) as unknown as typeof fetch;
    expect(await getPublicSupporterGuide(edition, fetchImpl)).toBeNull();
  });
});
