import { describe, expect, it } from "vitest";

import { catalogSlugRedirects, staticPathRedirects } from "../next.config.mjs";

describe("catalog slug redirects", () => {
  it("sends both former Marathon du Mont-Blanc hub slugs to the merged event", () => {
    expect(Object.fromEntries(catalogSlugRedirects)).toEqual({
      "/courses/evenements/marathon-du-mont-blanc-08a81d9c": "/courses/evenements/marathon-du-mont-blanc",
      "/courses/evenements/marathon-du-mont-blanc-d1472716": "/courses/evenements/marathon-du-mont-blanc",
    });
  });

  it("never chains into another redirect", () => {
    const sources = new Set([...catalogSlugRedirects, ...staticPathRedirects].map(([source]) => source));
    expect(catalogSlugRedirects.filter(([, target]) => sources.has(target))).toEqual([]);
  });
});
