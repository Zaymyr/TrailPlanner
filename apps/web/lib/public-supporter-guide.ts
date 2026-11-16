import type { SupporterGuidePayload } from "@trailplanner/shared";

import { racebookEditionCacheTag } from "./racebook-cache";

const DEFAULT_PUBLIC_BASE_URL = "https://pace-yourself.com";
const MAX_FORMAT_ATTEMPTS = 3;

/**
 * Public (never organizer-preview) Livret supporter of one edition for the
 * indexable « Suivre » page and the event page link. It reads the public
 * `/api/supporter-guide` endpoint with an ISR-compatible fetch cache (15 min,
 * RaceBook edition tag): calling the service loader directly would run its
 * `no-store` Supabase reads inside a statically regenerated page, which Next.js
 * aborts with DYNAMIC_SERVER_USAGE. The endpoint answers 404 for a format that
 * is not public, so a few formats are tried; null means no public guide.
 */
export async function getPublicSupporterGuide(
  edition: { id: string; formats: Array<{ id: string }> },
  fetchImpl: typeof fetch = fetch,
): Promise<SupporterGuidePayload | null> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_PUBLIC_BASE_URL;
  for (const format of edition.formats.slice(0, MAX_FORMAT_ATTEMPTS)) {
    try {
      const response = await fetchImpl(new URL(`/api/supporter-guide?raceId=${encodeURIComponent(format.id)}`, baseUrl), {
        next: { revalidate: 900, tags: [racebookEditionCacheTag(edition.id)] },
      } as RequestInit);
      if (response.status === 404) continue;
      if (!response.ok) return null;
      const guide = (await response.json()) as SupporterGuidePayload;
      return guide.organizerPreview || !Array.isArray(guide.formats) || guide.formats.length === 0 ? null : guide;
    } catch (error) {
      console.warn("Unable to load public Livret supporter", error);
      return null;
    }
  }
  return null;
}

/** Builds the indexable follow page path of an event edition. */
export const supporterFollowPath = (editionSlug: string) => `/courses/evenements/${editionSlug}/suivre`;

/** Days of the public programme, in date then time order. */
export function groupTimelineByDay(timeline: NonNullable<SupporterGuidePayload["timeline"]>) {
  const days = new Map<string, typeof timeline>();
  for (const entry of timeline) {
    const key = entry.date ?? "";
    days.set(key, [...(days.get(key) ?? []), entry]);
  }
  return [...days.entries()].map(([date, entries]) => ({ date: date || null, entries }));
}
