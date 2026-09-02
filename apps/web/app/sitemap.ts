import type { MetadataRoute } from "next";

import { getAllPostMetadata } from "../lib/blog/posts";
import { getPublicRaces } from "../lib/public-races";
import { getIndexableDistancePages } from "../lib/race-discovery";
import { HOME_PATH, RACE_PLANNER_PATH, SITE_URL } from "./seo";

const toAbsoluteUrl = (path: string) => new URL(path, SITE_URL).toString();

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, races] = await Promise.all([getAllPostMetadata(), getPublicRaces()]);

  const staticEntries: MetadataRoute.Sitemap = [
    { url: toAbsoluteUrl(HOME_PATH) },
    { url: toAbsoluteUrl(RACE_PLANNER_PATH) },
    { url: toAbsoluteUrl("/blog") },
    { url: toAbsoluteUrl("/courses") },
    { url: toAbsoluteUrl("/calculateur-glucides-trail") },
    { url: toAbsoluteUrl("/a-propos") },
    { url: toAbsoluteUrl("/methodologie") },
    { url: toAbsoluteUrl("/organisateurs") },
    { url: toAbsoluteUrl("/premium") },
    { url: toAbsoluteUrl("/partenaires") },
    { url: toAbsoluteUrl("/en/partners") },
    { url: toAbsoluteUrl("/support") },
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

  const raceEntries: MetadataRoute.Sitemap = races.map((race) => ({
    url: toAbsoluteUrl(`/courses/${race.slug}`),
  }));
  const distanceEntries: MetadataRoute.Sitemap = getIndexableDistancePages(races).map(({ page }) => ({
    url: toAbsoluteUrl(`/courses/distances/${page.slug}`),
  }));

  return [...staticEntries, ...blogEntries, ...raceEntries, ...distanceEntries];
}

/**
 * Manual verification checklist:
 * - Open https://<domain>/sitemap.xml -> must show XML (<urlset>).
 * - curl -I https://<domain>/sitemap.xml -> HTTP 200 and Content-Type is xml.
 * - Open https://<domain>/robots.txt -> includes Sitemap line.
 * - Search Console -> submit sitemap.xml.
 */
