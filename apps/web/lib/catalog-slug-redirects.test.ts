import { describe, expect, it } from "vitest";

import { catalogSlugRedirects, staticPathRedirects } from "../next.config.mjs";

describe("catalog slug redirects", () => {
  it("sends retired Marathon du Mont-Blanc hub and format slugs to their current pages", () => {
    expect(Object.fromEntries(catalogSlugRedirects)).toEqual({
      "/courses/evenements/marathon-du-mont-blanc-08a81d9c": "/courses/evenements/marathon-du-mont-blanc",
      "/courses/evenements/marathon-du-mont-blanc-d1472716": "/courses/evenements/marathon-du-mont-blanc",
      "/courses/marathon-du-mont-blanc-90k-lunr": "/courses/marathon-mont-blanc-90km-2027",
      "/courses/marathon-du-mont-blanc-qonc": "/courses/marathon-mont-blanc-42km-2027",
    });
  });

  it("never chains into another redirect", () => {
    const sources = new Set([...catalogSlugRedirects, ...staticPathRedirects].map(([source]) => source));
    expect(catalogSlugRedirects.filter(([, target]) => sources.has(target))).toEqual([]);
  });
});
