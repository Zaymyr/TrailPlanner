import { describe, expect, it } from "vitest";

import { getRelatedArticleSlugs } from "./race-related-articles";

describe("getRelatedArticleSlugs", () => {
  it("picks ultra guides for long formats", () => {
    expect(getRelatedArticleSlugs(110)).toEqual(["estimer-temps-trail-dplus", "problemes-digestifs-ultra", "60g-glucide-par-heure"]);
  });
  it("picks 30-50 km guides for medium formats", () => {
    expect(getRelatedArticleSlugs(42)).toContain("nutrition-trail-30-50-km");
  });
  it("falls back to short-format guides without a distance", () => {
    expect(getRelatedArticleSlugs(null)).toContain("quelle-nutrition-pour-un-trail");
  });
  it("never returns duplicates and respects the max", () => {
    const slugs = getRelatedArticleSlugs(15, 5);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs.length).toBeLessThanOrEqual(5);
  });
});
