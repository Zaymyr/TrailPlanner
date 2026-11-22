import type { MetadataRoute } from "next";

import { getAllPostMetadata } from "../lib/blog/posts";
import { isDemoRaceEventId } from "../lib/demo-race";
import { getPublicRaces, PUBLIC_RACES_REVALIDATE_SECONDS, type PublicRace } from "../lib/public-races";
import {
  getIndexableDistanceLandingPages,
  getIndexableMonthPages,
  getIndexableRegionPages,
  getLandingPagePath,
  getTodayInFrance,
  latestUpdatedAt,
  paginateLandingRaces,
} from "../lib/race-landing-pages";
import { HOME_PATH, RACE_PLANNER_PATH, SITE_URL } from "./seo";

const toAbsoluteUrl = (path: string) => new URL(path, SITE_URL).toString();

export const revalidate = PUBLIC_RACES_REVALIDATE_SECONDS;

/** Every page of a paginated landing selection, each with the selection's latest update. */
const landingEntries = (basePath: string, races: PublicRace[]): MetadataRoute.Sitemap => {
  const lastModified = latestUpdatedAt(races);
  const { totalPages } = paginateLandingRaces(races, 1);
  return Array.from({ length: totalPages }, (_, index) => ({
    url: toAbsoluteUrl(getLandingPagePath(basePath, index + 1)),
    lastModified,
  }));
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, publicRaces] = await Promise.all([getAllPostMetadata(), getPublicRaces()]);
  // The Trail TST demo stays reachable for the printed QR codes but is noindex: keep it out.
  const races = publicRaces.filter((race) => !isDemoRaceEventId(race.eventId));
  const todayIso = getTodayInFrance();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: toAbsoluteUrl(HOME_PATH) },
    { url: toAbsoluteUrl(RACE_PLANNER_PATH) },
    { url: toAbsoluteUrl("/blog") },
    { url: toAbsoluteUrl("/courses") },
    { url: toAbsoluteUrl("/calculateur-glucides-trail") },
    { url: toAbsoluteUrl("/a-propos") },
    { url: toAbsoluteUrl("/methodologie") },
    { url: toAbsoluteUrl("/organisateurs") },
    { url: toAbsoluteUrl("/survol") },
    { url: toAbsoluteUrl("/livret-coureur") },
    { url: toAbsoluteUrl("/livret-supporter") },
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
    lastModified: race.updatedAt ?? undefined,
  }));
  // Edition pages canonicalize to their permanent event hub: list the hub
  // once per event (latest update of any of its formats) and keep an edition
  // URL only for an event without a hub slug.
  const eventLastModified = new Map<string, string | undefined>();
  races.forEach((race) => {
    const path = race.eventSlug
      ? `/courses/evenements/${race.eventSlug}`
      : race.eventEditionSlug ? `/courses/evenements/${race.eventEditionSlug}` : null;
    if (!path) return;
    const current = eventLastModified.get(path);
    const next = race.updatedAt ?? undefined;
    eventLastModified.set(path, !current || (next && next > current) ? next ?? current : current);
  });
  const eventEntries: MetadataRoute.Sitemap = Array.from(eventLastModified, ([path, lastModified]) => ({
    url: toAbsoluteUrl(path),
    lastModified,
  }));
  const selectionEntries: MetadataRoute.Sitemap = [
    ...getIndexableDistanceLandingPages(races, todayIso).flatMap(({ page, races: matching }) =>
      landingEntries(`/courses/distances/${page.slug}`, matching)),
    ...getIndexableRegionPages(races, todayIso).flatMap(({ region, races: matching }) =>
      landingEntries(`/courses/regions/${region.slug}`, matching)),
    ...getIndexableMonthPages(races, todayIso).flatMap(({ month, races: matching }) =>
      landingEntries(`/courses/mois/${month.slug}`, matching)),
  ];

  return [...staticEntries, ...blogEntries, ...eventEntries, ...raceEntries, ...selectionEntries];
}

/**
 * Manual verification checklist:
 * - Open https://<domain>/sitemap.xml -> must show XML (<urlset>).
 * - curl -I https://<domain>/sitemap.xml -> HTTP 200 and Content-Type is xml.
 * - Open https://<domain>/robots.txt -> includes Sitemap line.
 * - Search Console -> submit sitemap.xml.
 */
