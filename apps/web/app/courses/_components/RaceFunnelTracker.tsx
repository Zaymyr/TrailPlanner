"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { trackRaceEstimateCtaClicked, trackRacePageViewed, type RaceFunnelPageType } from "../../../lib/product-analytics";
import {
  isUpcomingRaceDate,
  parseRacePagePath,
  rememberFunnelSourceRace,
  resolveEstimateClick,
} from "../../../lib/race-funnel-source";

export type RaceFunnelContext = {
  pageType: RaceFunnelPageType;
  slug: string;
  raceId?: string | null;
  eventId?: string | null;
  hasGpx?: boolean | null;
  /** ISO date of the race or edition, used for `is_upcoming`. */
  date?: string | null;
  isDemo?: boolean | null;
};

/**
 * Funnel instrumentation for public race pages. Mounted once per page (inside the
 * shared hero): it emits `race page viewed` and, through one delegated listener,
 * `race estimate cta clicked` for every link to `/race-planner?catalogRaceId=...`
 * (hero, sticky bar, format list, estimates section), so CTAs need no per-button wiring.
 * Without `context` it falls back to the pathname (page type and slug only).
 */
export function RaceFunnelTracker({ context }: { context?: RaceFunnelContext }) {
  const pathname = usePathname();
  const fromPath = parseRacePagePath(pathname ?? "");
  const pageType = context?.pageType ?? fromPath?.pageType;
  const slug = context?.slug ?? fromPath?.slug;
  const raceId = context?.raceId ?? null;
  const eventId = context?.eventId ?? null;
  const hasGpx = context?.hasGpx ?? null;
  const date = context?.date ?? null;
  const isDemo = context?.isDemo ?? null;

  useEffect(() => {
    if (!pageType || !slug) return;
    trackRacePageViewed({
      pageType,
      slug,
      raceId,
      eventId,
      hasGpx,
      isUpcoming: isUpcomingRaceDate(date),
      isDemo,
    });
    if (pageType === "format") rememberFunnelSourceRace(raceId);
  }, [pageType, slug, raceId, eventId, hasGpx, date, isDemo]);

  useEffect(() => {
    if (!pageType) return undefined;
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!anchor) return;
      const click = resolveEstimateClick({
        href: anchor.getAttribute("href"),
        placement: anchor.getAttribute("data-estimate-placement"),
        inFormatList: Boolean(anchor.closest("#formats")),
      });
      if (!click) return;
      rememberFunnelSourceRace(click.raceId);
      trackRaceEstimateCtaClicked({ placement: click.placement, pageType, raceId: click.raceId, slug });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pageType, slug]);

  return null;
}
