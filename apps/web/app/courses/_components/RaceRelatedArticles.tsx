import type { Route } from "next";
import Link from "next/link";

import { getRelatedArticleSlugs } from "../../../lib/race-related-articles";

/** Server-rendered links from a format page to the blog guides matching its distance. */
export async function RaceRelatedArticles({ distanceKm }: { distanceKm: number | null }) {
  // Lazy import: the blog loader uses React cache and the filesystem, which format-page
  // unit tests and edge bundles must not load eagerly.
  const posts = await import("../../../lib/blog/posts").then((blog) => blog.getAllPostMetadata()).catch(() => []);
  // Match on the public canonical path: file names (e.g. accents, underscores) differ from URLs.
  const bySlug = new Map(posts.map((post) => [post.canonicalPath.replace("/blog/", ""), post]));
  const articles = getRelatedArticleSlugs(distanceKm)
    .map((slug) => bySlug.get(slug))
    .filter((post): post is NonNullable<typeof post> => Boolean(post));
  if (!articles.length) return null;

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-6" aria-labelledby="related-guides-heading">
      <h2 id="related-guides-heading" className="text-xl font-bold text-foreground sm:text-2xl">Pour préparer cette course</h2>
      <ul className="grid gap-2 sm:grid-cols-3">
        {articles.map((post) => (
          <li key={post.slug}>
            <Link href={post.canonicalPath as Route} className="flex min-h-11 items-center rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground transition hover:border-brand-border hover:bg-brand-surface">
              {post.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
