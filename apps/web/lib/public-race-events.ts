import "server-only";

import { z } from "zod";

import { getPublicRaceDetail, type PublicRaceDetail } from "./public-race-detail";
import { getPublicRaces, PUBLIC_RACES_REVALIDATE_SECONDS, type PublicRace } from "./public-races";
import { getSupabaseServiceConfig } from "./supabase";
import { PUBLIC_RACES_CACHE_TAG } from "./public-race-cache";
import { getTodayInFrance } from "./race-landing-pages";

const editionSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid(),
  slug: z.string().min(1),
  edition_year: z.number().int(),
  start_date: z.string(),
  end_date: z.string(),
  updated_at: z.string().nullable().optional(),
  is_visible: z.boolean().optional(),
});

const redirectSchema = z.object({ edition_id: z.string().uuid() });

const eventSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  location: z.string().nullable(),
  thumbnail_url: z.string().nullable(),
  website_url: z.string().nullable(),
  updated_at: z.string().nullable().optional(),
});

const hubEventSchema = eventSchema.extend({ slug: z.string().min(1) });

const aidStationSchema = z.object({ race_id: z.string().uuid() });

const racebookFlagSchema = z.object({ id: z.string().uuid(), racebook_is_live: z.boolean().nullable() });

type PublicEventEditionLink = {
  slug: string;
  editionYear: number;
  startDate: string;
  endDate: string;
};

export type PublicRaceEventEdition = {
  id: string;
  slug: string;
  eventId: string;
  /** Durable event hub slug; the edition page canonicalizes to the hub when set. */
  eventSlug: string | null;
  eventName: string;
  editionYear: number;
  startDate: string;
  endDate: string;
  location: string | null;
  thumbnailUrl: string | null;
  websiteUrl: string | null;
  updatedAt: string | null;
  formats: Array<PublicRace & { aidStationCount: number }>;
  commonPractical: PublicRaceDetail["practical"] | null;
  nextEdition: PublicEventEditionLink | null;
};

export type PublicRaceEventEditionResolution = {
  edition: PublicRaceEventEdition;
  shouldRedirect: boolean;
};

export type PublicRaceEventHubEdition = {
  id: string;
  slug: string;
  editionYear: number;
  startDate: string;
  endDate: string;
  formatCount: number;
  isPast: boolean;
};

export type PublicRaceEventHub = {
  eventId: string;
  slug: string;
  eventName: string;
  location: string | null;
  thumbnailUrl: string | null;
  websiteUrl: string | null;
  updatedAt: string | null;
  /** Next public edition that has not ended, otherwise the latest finished one. */
  featured: PublicRaceEventEdition;
  /** Livret coureur published in the app for at least one featured format (mobile-visible edition). */
  featuredLivretCoureurAvailable: boolean;
  /** Every edition with at least one web-public format, newest first. */
  editions: PublicRaceEventHubEdition[];
};

type EditionRow = z.infer<typeof editionSchema>;
type EventRow = z.infer<typeof eventSchema>;

const fetchRows = async <T>(path: string, schema: z.ZodType<T>): Promise<T[]> => {
  const config = getSupabaseServiceConfig();
  if (!config) return [];
  try {
    const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
      headers: {
        apikey: config.supabaseServiceRoleKey,
        Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      },
      next: { revalidate: PUBLIC_RACES_REVALIDATE_SECONDS, tags: [PUBLIC_RACES_CACHE_TAG] },
    });
    if (!response.ok) return [];
    const parsed = z.array(schema).safeParse(await response.json());
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
};

const loadEdition = (filter: string) => fetchRows(
  `race_event_editions?select=id,event_id,slug,edition_year,start_date,end_date,updated_at&${filter}&limit=1`,
  editionSchema,
);

const loadEventEditions = (eventId: string) => fetchRows(
  `race_event_editions?select=id,event_id,slug,edition_year,start_date,end_date,updated_at,is_visible&event_id=eq.${encodeURIComponent(eventId)}&order=start_date.asc`,
  editionSchema,
);

const isValidSlug = (slug: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);

export async function resolvePublicRaceEventEditionSlug(slug: string): Promise<PublicRaceEventEditionResolution | null> {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!isValidSlug(normalizedSlug)) return null;

  let shouldRedirect = false;
  let sourceEdition = (await loadEdition(`slug=eq.${encodeURIComponent(normalizedSlug)}`))[0];
  if (!sourceEdition) {
    const redirect = (await fetchRows(
      `race_event_edition_slug_redirects?select=edition_id&old_slug=eq.${encodeURIComponent(normalizedSlug)}&limit=1`,
      redirectSchema,
    ))[0];
    if (!redirect) return null;
    sourceEdition = (await loadEdition(`id=eq.${encodeURIComponent(redirect.edition_id)}`))[0];
    shouldRedirect = true;
  }
  if (!sourceEdition) return null;

  const event = (await fetchRows(
    `race_events?select=id,name,location,thumbnail_url,website_url,updated_at&id=eq.${encodeURIComponent(sourceEdition.event_id)}&is_live=eq.true&limit=1`,
    eventSchema,
  ))[0];
  if (!event) return null;

  const edition = await buildPublicRaceEventEdition(sourceEdition, event, await getPublicRaces());
  return edition ? { shouldRedirect, edition } : null;
}

async function buildPublicRaceEventEdition(
  sourceEdition: EditionRow,
  event: EventRow,
  allPublicRaces: PublicRace[],
  preloadedEventEditions?: EditionRow[],
): Promise<PublicRaceEventEdition | null> {
  const formats = allPublicRaces.filter(
    (race) => race.eventId === event.id && race.editionId === sourceEdition.id,
  );
  if (!formats.length) return null;

  const formatIds = formats.map((race) => race.id);
  const [stationRows, practicalDetail, eventEditions] = await Promise.all([
    fetchRows(
      `race_aid_stations?select=race_id&race_id=in.(${formatIds.map(encodeURIComponent).join(",")})`,
      aidStationSchema,
    ),
    getPublicRaceDetail(formats[0]),
    preloadedEventEditions ? Promise.resolve(preloadedEventEditions) : loadEventEditions(event.id),
  ]);
  const stationCounts = new Map<string, number>();
  stationRows.forEach((row) => stationCounts.set(row.race_id, (stationCounts.get(row.race_id) ?? 0) + 1));
  const publicEditionIds = new Set(
    allPublicRaces
      .filter((race) => race.eventId === event.id && race.editionId && race.eventEditionSlug)
      .map((race) => race.editionId as string),
  );
  const nextEditionRow = eventEditions.find(
    (edition) => edition.start_date > sourceEdition.end_date && publicEditionIds.has(edition.id),
  );
  const updatedAt = [sourceEdition.updated_at, event.updated_at, ...formats.map((race) => race.updatedAt)]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;

  return {
    id: sourceEdition.id,
    slug: sourceEdition.slug,
    eventId: event.id,
    eventSlug: formats.find((race) => race.eventSlug)?.eventSlug ?? null,
    eventName: event.name,
    editionYear: sourceEdition.edition_year,
    startDate: sourceEdition.start_date,
    endDate: sourceEdition.end_date,
    location: event.location ?? formats[0]?.location ?? null,
    thumbnailUrl: event.thumbnail_url ?? formats.find((race) => race.thumbnailUrl)?.thumbnailUrl ?? null,
    websiteUrl: event.website_url,
    updatedAt,
    formats: formats.map((race) => ({ ...race, aidStationCount: stationCounts.get(race.id) ?? 0 })),
    commonPractical: practicalDetail?.commonPractical ?? null,
    nextEdition: nextEditionRow ? {
      slug: nextEditionRow.slug,
      editionYear: nextEditionRow.edition_year,
      startDate: nextEditionRow.start_date,
      endDate: nextEditionRow.end_date,
    } : null,
  };
}

/**
 * The hub's featured edition: the earliest public edition that has not ended
 * yet (inclusive end date, Europe/Paris), otherwise the most recent one.
 */
export const selectFeaturedEdition = <T extends { startDate: string; endDate: string }>(
  editions: T[],
  todayIso: string,
): T | null => {
  const sorted = [...editions].sort((left, right) => left.startDate.localeCompare(right.startDate));
  return sorted.find((edition) => edition.endDate >= todayIso) ?? sorted.at(-1) ?? null;
};

/**
 * Resolves the permanent, year-free event hub `/courses/evenements/<event-slug>`.
 * The event must be live and own at least one web-public format attached to an
 * edition. Event slugs never collide with edition slugs (database trigger), so
 * the route tries the edition namespace first, then this one.
 */
export async function resolvePublicRaceEventHubSlug(
  slug: string,
  todayIso: string = getTodayInFrance(),
): Promise<PublicRaceEventHub | null> {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!isValidSlug(normalizedSlug)) return null;

  const event = (await fetchRows(
    `race_events?select=id,slug,name,location,thumbnail_url,website_url,updated_at&slug=eq.${encodeURIComponent(normalizedSlug)}&is_live=eq.true&limit=1`,
    hubEventSchema,
  ))[0];
  if (!event) return null;

  const [allPublicRaces, eventEditions] = await Promise.all([getPublicRaces(), loadEventEditions(event.id)]);
  const formatCounts = new Map<string, number>();
  allPublicRaces.forEach((race) => {
    if (race.eventId !== event.id || !race.editionId) return;
    formatCounts.set(race.editionId, (formatCounts.get(race.editionId) ?? 0) + 1);
  });
  const publicEditions = eventEditions.filter((edition) => formatCounts.has(edition.id));
  const featuredRow = selectFeaturedEdition(
    publicEditions.map((edition) => ({ ...edition, startDate: edition.start_date, endDate: edition.end_date })),
    todayIso,
  );
  if (!featuredRow) return null;

  const featured = await buildPublicRaceEventEdition(featuredRow, event, allPublicRaces, eventEditions);
  if (!featured) return null;

  // Same promise as the course page app bridge: published Livret coureur on a
  // mobile-visible edition.
  const racebookRows = featuredRow.is_visible === true
    ? await fetchRows(
        `races?select=id,racebook_is_live&id=in.(${featured.formats.map((format) => encodeURIComponent(format.id)).join(",")})&racebook_is_live=eq.true`,
        racebookFlagSchema,
      )
    : [];
  const eventRaceUpdates = allPublicRaces
    .filter((race) => race.eventId === event.id)
    .map((race) => race.updatedAt);

  return {
    eventId: event.id,
    slug: event.slug,
    eventName: event.name,
    location: featured.location,
    thumbnailUrl: featured.thumbnailUrl,
    websiteUrl: event.website_url,
    updatedAt: [featured.updatedAt, ...eventRaceUpdates]
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null,
    featured: { ...featured, eventSlug: event.slug },
    featuredLivretCoureurAvailable: racebookRows.some((row) => row.racebook_is_live === true),
    editions: [...publicEditions].reverse().map((edition) => ({
      id: edition.id,
      slug: edition.slug,
      editionYear: edition.edition_year,
      startDate: edition.start_date,
      endDate: edition.end_date,
      formatCount: formatCounts.get(edition.id) ?? 0,
      isPast: edition.end_date < todayIso,
    })),
  };
}
