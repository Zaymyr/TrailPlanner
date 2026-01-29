import type { MetadataRoute } from "next";

import { getAllPostMetadata } from "../lib/blog/posts";
import { HOME_PATH, RACE_PLANNER_PATH, SITE_URL } from "./seo";

const toAbsoluteUrl = (path: string) => new URL(path, SITE_URL).toString();

const buildPostUrl = (canonical: string | undefined, slug: string) => {
  if (!canonical) {
    return toAbsoluteUrl(`/blog/${slug}`);
  }

  if (canonical.startsWith("http")) {
    return canonical;
  }

  return toAbsoluteUrl(canonical);
};

export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getAllPostMetadata();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: toAbsoluteUrl(HOME_PATH) },
    { url: toAbsoluteUrl(RACE_PLANNER_PATH) },
    { url: toAbsoluteUrl(`${RACE_PLANNER_PATH}/mobile`) },
    { url: toAbsoluteUrl("/blog") },
  ];

  const blogEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: buildPostUrl(post.canonical, post.slug),
    lastModified: post.updatedAt ?? post.date ?? undefined,
  }));

  return [...staticEntries, ...blogEntries];
}

/**
 * Manual verification checklist:
 * - Open https://<domain>/sitemap.xml -> must show XML (<urlset>).
 * - curl -I https://<domain>/sitemap.xml -> HTTP 200 and Content-Type is xml.
 * - Open https://<domain>/robots.txt -> includes Sitemap line.
 * - Search Console -> submit sitemap.xml.
 */
