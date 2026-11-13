import "server-only";

import { z } from "zod";

import { getPublicRaceDetail, type PublicRaceDetail } from "./public-race-detail";
import { getPublicRaces, PUBLIC_RACES_REVALIDATE_SECONDS, type PublicRace } from "./public-races";
import { getSupabaseServiceConfig } from "./supabase";

const editionSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid(),
  slug: z.string().min(1),
  edition_year: z.number().int(),
  start_date: z.string(),
  end_date: z.string(),
  updated_at: z.string().nullable().optional(),
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

const aidStationSchema = z.object({ race_id: z.string().uuid() });

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

const fetchRows = async <T>(path: string, schema: z.ZodType<T>): Promise<T[]> => {
  const config = getSupabaseServiceConfig();
  if (!config) return [];
  try {
    const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
      headers: {
        apikey: config.supabaseServiceRoleKey,
        Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      },
      next: { revalidate: PUBLIC_RACES_REVALIDATE_SECONDS },
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

export async function resolvePublicRaceEventEditionSlug(slug: string): Promise<PublicRaceEventEditionResolution | null> {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug)) return null;

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

  const allPublicRaces = await getPublicRaces();
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
    fetchRows(
      `race_event_editions?select=id,event_id,slug,edition_year,start_date,end_date,updated_at&event_id=eq.${encodeURIComponent(event.id)}&order=start_date.asc`,
      editionSchema,
    ),
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
    shouldRedirect,
    edition: {
      id: sourceEdition.id,
      slug: sourceEdition.slug,
      eventId: event.id,
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
    },
  };
}
