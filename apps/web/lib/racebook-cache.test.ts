import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invalidateByTag: vi.fn() }));

vi.mock("@vercel/functions", () => ({ invalidateByTag: mocks.invalidateByTag }));

import { invalidateRacebookCache, setPublicRacebookCacheHeaders } from "./racebook-cache";

afterEach(() => {
  delete process.env.VERCEL;
  vi.clearAllMocks();
});

describe("RaceBook CDN cache", () => {
  it("tags public responses at every mutable scope", () => {
    const response = setPublicRacebookCacheHeaders(new Response(), {
      raceId: "race-1",
      editionId: "edition-1",
      eventId: "event-1",
    });

    expect(response.headers.get("Vercel-Cache-Tag")).toBe(
      "racebook:race:race-1,racebook:edition:edition-1,racebook:event:event-1",
    );
    expect(response.headers.get("Vercel-CDN-Cache-Control")).toContain("stale-while-revalidate=3600");
  });

  it("invalidates matching tags on Vercel", async () => {
    process.env.VERCEL = "1";

    await invalidateRacebookCache({ raceId: "race-1", editionId: "edition-1" });

    expect(mocks.invalidateByTag).toHaveBeenCalledWith([
      "racebook:race:race-1",
      "racebook:edition:edition-1",
    ]);
  });

  it("does not call Vercel from local development", async () => {
    await invalidateRacebookCache({ raceId: "race-1" });
    expect(mocks.invalidateByTag).not.toHaveBeenCalled();
  });
});
