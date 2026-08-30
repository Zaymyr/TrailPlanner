import { describe, expect, it } from "vitest";

import {
  EMPTY_RACEBOOK_SPONSORS,
  normalizeRacebookSponsorPresentation,
  RACEBOOK_SPONSOR_MINIMUM_MS,
} from "../../mobile/lib/racebookSponsorPresentation";

const sponsor = (id: string) => ({ id, name: `Sponsor ${id}`, logoUrl: `https://example.com/${id}.png`, clickUrl: null });

describe("mobile RaceBook sponsor presentation", () => {
  it("keeps the minimum loading presentation at 2.5 seconds", () => {
    expect(RACEBOOK_SPONSOR_MINIMUM_MS).toBe(2_500);
  });

  it("never exposes more than two loading sponsors", () => {
    expect(normalizeRacebookSponsorPresentation({
      loadingSponsors: [sponsor("one"), sponsor("two"), sponsor("three")],
      bannerSponsors: [],
    }).loadingSponsors.map(({ id }) => id)).toEqual(["one", "two"]);
  });

  it("uses an empty presentation for failed or invalid payloads", () => {
    expect(normalizeRacebookSponsorPresentation(null)).toEqual(EMPTY_RACEBOOK_SPONSORS);
    expect(normalizeRacebookSponsorPresentation({ loadingSponsors: [{ nope: true }] })).toEqual(EMPTY_RACEBOOK_SPONSORS);
  });
});
