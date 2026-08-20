import { describe, expect, it } from "vitest";

import { blogIndex } from "../../content/blog/index";
import { buildBlogCanonicalPath } from "../../lib/blog/redirects";

describe("blog editorial index", () => {
  it("contains the twelve published articles without duplicate slugs", () => {
    const slugs = blogIndex.map((post) => post.slug);

    expect(slugs).toHaveLength(12);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("only references articles present in the index", () => {
    const slugs = new Set(blogIndex.map((post) => post.slug));
    const missing = blogIndex.flatMap((post) =>
      (post.related ?? [])
        .filter((relatedSlug) => !slugs.has(relatedSlug))
        .map((relatedSlug) => `${post.slug} -> ${relatedSlug}`),
    );

    expect(missing).toEqual([]);
  });

  it("builds canonical paths for legacy filename slugs", () => {
    expect(buildBlogCanonicalPath("60g-par-heure")).toBe("/blog/60g-glucide-par-heure");
    expect(buildBlogCanonicalPath("soduim-heure")).toBe("/blog/sodium-par-heure");
    expect(buildBlogCanonicalPath("probl-mes-digestifs-ultra")).toBe(
      "/blog/problemes-digestifs-ultra",
    );
    expect(buildBlogCanonicalPath("quoi-manger-trail-50k")).toBe(
      "/blog/nutrition-trail-30-50-km",
    );
  });
});
