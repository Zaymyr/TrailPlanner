import { describe, expect, it } from "vitest";

import { buildBlogPostingJsonLd, getBlogLayoutCopy } from "../../components/BlogLayout";
import type { CompiledPost } from "../../lib/blog/posts";

const post = {
  meta: {
    slug: "article-test",
    title: "Article test",
    description: "Description test",
    date: "2026-08-28T00:00:00.000Z",
    locale: "fr",
    tags: ["trail"],
    canonicalPath: "/blog/article-test",
    readingTime: { words: 120, minutes: 1 },
  },
  body: "# Contenu MDX brut",
  headings: [],
} as unknown as CompiledPost;

describe("BlogPosting structured data", () => {
  it("keeps French editorial labels stable", () => {
    const copy = getBlogLayoutCopy(post.meta.locale);

    expect(copy.headerCta).toBe("Planifier ma course");
    expect(copy.reading.published).toBe("Publié le");
  });

  it("identifies the French language and the verifiable Pace Yourself organization", () => {
    const jsonLd = buildBlogPostingJsonLd(post, "https://pace-yourself.com/blog/article-test");

    expect(jsonLd.inLanguage).toBe("fr-FR");
    expect(jsonLd.author).toEqual({
      "@type": "Organization",
      name: "Pace Yourself",
      url: "https://pace-yourself.com/a-propos",
    });
    expect(jsonLd.publisher.logo.url).toBe("https://pace-yourself.com/branding/logo-icon-v2.png");
    expect(jsonLd).not.toHaveProperty("articleBody");
  });
});
