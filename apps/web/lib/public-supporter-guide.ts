import type { SupporterGuidePayload } from "@trailplanner/shared";
import { unstable_cache } from "next/cache";

import { racebookEditionCacheTag } from "./racebook-cache";
import { getSupabaseServiceConfig } from "./supabase";
import { loadSupporterGuide } from "./supporter-guide";

const DEFAULT_PUBLIC_BASE_URL = "https://pace-yourself.com";

/**
 * Public (never organizer-preview) Livret supporter of one edition, cached for
 * the indexable « Suivre » page and the event page link. It returns null when no
 * format is live with an effective `supporter_guide` module, so a page is only
 * published for guides the organizer already made public.
 */
export function getPublicSupporterGuide(editionId: string): Promise<SupporterGuidePayload | null> {
  return unstable_cache(
    async () => {
      const config = getSupabaseServiceConfig();
      if (!config) return null;
      try {
        return await loadSupporterGuide(config, editionId, false, process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_PUBLIC_BASE_URL);
      } catch (error) {
        console.warn("Unable to load public Livret supporter", error);
        return null;
      }
    },
    ["public-supporter-guide", editionId],
    { revalidate: 900, tags: [racebookEditionCacheTag(editionId)] },
  )();
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
