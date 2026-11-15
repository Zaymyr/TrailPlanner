import { beforeEach, describe, expect, it, vi } from "vitest";

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag }));

import { invalidatePublicRaceCache, publicRaceCacheTags } from "./public-race-cache";

describe("public race cache tags", () => {
  beforeEach(() => revalidateTag.mockClear());

  it("always includes the catalog tag and adds stable scoped tags", () => {
    expect(publicRaceCacheTags({ raceId: "race-1", editionId: "edition-1", eventId: "event-1" })).toEqual([
      "public-races",
      "public-race:race-1",
      "public-edition:edition-1",
      "public-event:event-1",
    ]);
  });

  it("revalidates the catalog and every supplied scope", () => {
    invalidatePublicRaceCache({ raceId: "race-1", eventId: "event-1" });

    expect(revalidateTag.mock.calls).toEqual([
      ["public-races"],
      ["public-race:race-1"],
      ["public-event:event-1"],
    ]);
  });
});
