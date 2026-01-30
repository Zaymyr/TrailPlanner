import type { MetadataRoute } from "next";

import { getAllPostMetadata } from "../lib/blog/posts";
import { HOME_PATH, RACE_PLANNER_PATH, SITE_URL } from "./seo";

const toAbsoluteUrl = (path: string) => new URL(path, SITE_URL).toString();

export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getAllPostMetadata();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: toAbsoluteUrl(HOME_PATH) },
    { url: toAbsoluteUrl(RACE_PLANNER_PATH) },
    { url: toAbsoluteUrl(`${RACE_PLANNER_PATH}/mobile`) },
    { url: toAbsoluteUrl("/blog") },
  ];

  const seenUrls = new Set<string>();
  const blogEntries: MetadataRoute.Sitemap = [];

  posts.forEach((post) => {
    const url = toAbsoluteUrl(post.canonicalPath);
    if (seenUrls.has(url)) {
      return;
    }

    seenUrls.add(url);
    blogEntries.push({
      url,
      lastModified: post.updatedAt ?? post.date ?? undefined,
    });
  });

  return [...staticEntries, ...blogEntries];
}

/**
 * Manual verification checklist:
 * - Open https://<domain>/sitemap.xml -> must show XML (<urlset>).
 * - curl -I https://<domain>/sitemap.xml -> HTTP 200 and Content-Type is xml.
 * - Open https://<domain>/robots.txt -> includes Sitemap line.
 * - Search Console -> submit sitemap.xml.
 */
