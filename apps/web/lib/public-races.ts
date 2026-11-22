import "server-only";

import { z } from "zod";

import { getSupabaseServiceConfig } from "./supabase";
import { PUBLIC_RACES_CACHE_TAG } from "./public-race-cache";
import { getFrenchRegionByCode } from "./race-landing-pages";

const raceSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid().nullable(),
  edition_id: z.string().uuid().nullable().optional(),
  slug: z.string().min(1),
  name: z.string().min(1),
  race_date: z.string().nullable(),
  location_text: z.string().nullable(),
  location: z.string().nullable(),
  distance_km: z.number().nullable(),
  elevation_gain_m: z.number().nullable(),
  thumbnail_url: z.string().nullable(),
  external_site_url: z.string().nullable(),
  updated_at: z.string().nullable().optional(),
});

const eventSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  location: z.string().nullable(),
  location_city: z.string().nullable().optional(),
  location_department: z.string().nullable().optional(),
  location_region: z.string().nullable().optional(),
  location_region_code: z.string().nullable().optional(),
  location_country: z.string().nullable().optional(),
  location_country_code: z.string().nullable().optional(),
  race_date: z.string().nullable(),
  thumbnail_url: z.string().nullable(),
  website_url: z.string().nullable(),
  updated_at: z.string().nullable().optional(),
});

const eventSlugSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
});

const raceSlugRedirectSchema = z.object({
  race_id: z.string().uuid(),
});

const editionSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  updated_at: z.string().nullable().optional(),
});

export type PublicRace = {
  id: string;
  eventId: string | null;
  editionId: string | null;
  eventEditionSlug: string | null;
  /** Durable year-free event hub slug (`race_events.slug`), null when unavailable. */
  eventSlug?: string | null;
  slug: string;
  name: string;
  eventName: string | null;
  date: string | null;
  location: string | null;
  locationCity: string | null;
  locationDepartment: string | null;
  locationRegion: string | null;
  locationCountry: string | null;
  /** French region landing-page slug, derived from the normalized INSEE region code only. */
  regionSlug?: string | null;
  searchTerms: string[];
  distanceKm: number | null;
  elevationGainM: number | null;
  raceThumbnailUrl: string | null;
  eventThumbnailUrl: string | null;
  thumbnailUrl: string | null;
  externalSiteUrl: string | null;
  eventWebsiteUrl: string | null;
  updatedAt: string | null;
};

export const PUBLIC_RACES_REVALIDATE_SECONDS = 900;

export type PublicRaceSlugResolution = {
  race: PublicRace;
  shouldRedirect: boolean;
};

const raceSelect = [
  "id",
  "event_id",
  "edition_id",
  "slug",
  "name",
  "race_date",
  "location_text",
  "location",
  "distance_km",
  "elevation_gain_m",
  "thumbnail_url",
  "external_site_url",
  "updated_at",
].join(",");

const eventSelect = [
  "id",
  "name",
  "location",
  "location_city",
  "location_department",
  "location_region",
  "location_region_code",
  "location_country",
  "location_country_code",
  "race_date",
  "thumbnail_url",
  "website_url",
  "updated_at",
].join(",");

const fetchPublicRows = async <T>(path: string, schema: z.ZodType<T>): Promise<T[]> => {
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

    if (!response.ok) {
      console.error("Unable to load public race catalog", response.status, await response.text());
      return [];
    }

    const parsed = z.array(schema).safeParse(await response.json());
    if (!parsed.success) {
      console.error("Unable to parse public race catalog", parsed.error.flatten());
      return [];
    }

    return parsed.data;
  } catch (error) {
    console.error("Unexpected error while loading public race catalog", error);
    return [];
  }
};

const fetchPublicEditionRows = async (path: string): Promise<z.infer<typeof editionSchema>[]> => {
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
    const parsed = z.array(editionSchema).safeParse(await response.json());
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
};

/**
 * Event hub slugs are read separately and leniently: a missing column (web
 * deployed before its migration) only disables hub links instead of emptying
 * the catalog.
 */
const fetchEventSlugs = async (filter: string): Promise<Map<string, string>> => {
  const config = getSupabaseServiceConfig();
  if (!config) return new Map();
  try {
    const response = await fetch(`${config.supabaseUrl}/rest/v1/race_events?select=id,slug&${filter}`, {
      headers: {
        apikey: config.supabaseServiceRoleKey,
        Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      },
      next: { revalidate: PUBLIC_RACES_REVALIDATE_SECONDS, tags: [PUBLIC_RACES_CACHE_TAG] },
    });
    if (!response.ok) return new Map();
    const parsed = z.array(eventSlugSchema).safeParse(await response.json());
    return parsed.success ? new Map(parsed.data.map((row) => [row.id, row.slug])) : new Map();
  } catch {
    return new Map();
  }
};

const toPublicRace = (
  race: z.infer<typeof raceSchema>,
  event: z.infer<typeof eventSchema> | undefined,
  edition: z.infer<typeof editionSchema> | undefined,
  eventSlug: string | null = null,
): PublicRace => ({
  id: race.id,
  eventId: race.event_id,
  editionId: race.edition_id ?? null,
  eventEditionSlug: edition?.slug ?? null,
  // A hub only exists through edition-attached formats: a legacy format
  // without an edition must not link to a hub that would not resolve.
  eventSlug: event && race.edition_id ? eventSlug : null,
  slug: race.slug,
  name: race.name,
  eventName: event?.name ?? null,
  date: race.race_date ?? event?.race_date ?? null,
  location: race.location_text ?? race.location ?? event?.location ?? null,
  locationCity: event?.location_city ?? null,
  locationDepartment: event?.location_department ?? null,
  locationRegion: event?.location_region ?? null,
  locationCountry: event?.location_country ?? null,
  regionSlug: event?.location_country_code === "FR" ? getFrenchRegionByCode(event.location_region_code)?.slug ?? null : null,
  searchTerms: Array.from(
    new Set(
      [
        race.location_text,
        race.location,
        event?.location,
        event?.location_city,
        event?.location_department,
        event?.location_region,
        event?.location_country,
      ].filter((value): value is string => Boolean(value)),
    ),
  ),
  distanceKm: race.distance_km,
  elevationGainM: race.elevation_gain_m,
  raceThumbnailUrl: race.thumbnail_url,
  eventThumbnailUrl: event?.thumbnail_url ?? null,
  thumbnailUrl: race.thumbnail_url ?? event?.thumbnail_url ?? null,
  externalSiteUrl: race.external_site_url,
  eventWebsiteUrl: event?.website_url ?? null,
  updatedAt: [race.updated_at, event?.updated_at, edition?.updated_at]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null,
});

export const getPublicRaceRegistrationUrl = (race: PublicRace) => {
  const candidates = [race.eventWebsiteUrl, race.externalSiteUrl];
  return candidates.find((value): value is string => Boolean(value && /^https?:\/\//i.test(value))) ?? null;
};

export async function getPublicRaces(): Promise<PublicRace[]> {
  const [races, events, eventSlugs] = await Promise.all([
    fetchPublicRows(
      `races?select=${raceSelect}&web_catalog_is_live=eq.true&is_public=eq.true&order=race_date.asc.nullslast,name.asc`,
      raceSchema,
    ),
    fetchPublicRows(`race_events?select=${eventSelect}&is_live=eq.true`, eventSchema),
    fetchEventSlugs("is_live=eq.true"),
  ]);
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const editionIds = Array.from(new Set(races.map((race) => race.edition_id).filter((id): id is string => Boolean(id))));
  const editions = editionIds.length
    ? await fetchPublicEditionRows(`race_event_editions?select=id,slug,updated_at&id=in.(${editionIds.map(encodeURIComponent).join(",")})`)
    : [];
  const editionsById = new Map(editions.map((edition) => [edition.id, edition]));

  return races
    .filter((race) => !race.event_id || eventsById.has(race.event_id))
    .map((race) => toPublicRace(
      race,
      race.event_id ? eventsById.get(race.event_id) : undefined,
      race.edition_id ? editionsById.get(race.edition_id) : undefined,
      race.event_id ? eventSlugs.get(race.event_id) ?? null : null,
    ));
}

export async function getPublicRace(slug: string): Promise<PublicRace | null> {
  const encodedSlug = encodeURIComponent(slug);
  const races = await fetchPublicRows(
    `races?select=${raceSelect}&slug=eq.${encodedSlug}&web_catalog_is_live=eq.true&is_public=eq.true&limit=1`,
    raceSchema,
  );
  return loadPublicRace(races[0]);
}

const loadPublicRace = async (
  race: z.infer<typeof raceSchema> | undefined,
): Promise<PublicRace | null> => {
  if (!race) return null;

  const events = race.event_id
    ? await fetchPublicRows(
        `race_events?select=${eventSelect}&id=eq.${encodeURIComponent(race.event_id)}&is_live=eq.true&limit=1`,
        eventSchema,
      )
    : [];
  const editions = race.edition_id
    ? await fetchPublicEditionRows(
        `race_event_editions?select=id,slug,updated_at&id=eq.${encodeURIComponent(race.edition_id)}&limit=1`,
      )
    : [];

  // A format attached to an unpublished event must not become public merely
  // because its own flags are still live.
  if (race.event_id && !events[0]) return null;
  const eventSlugs = race.event_id
    ? await fetchEventSlugs(`id=eq.${encodeURIComponent(race.event_id)}&is_live=eq.true&limit=1`)
    : new Map<string, string>();

  return toPublicRace(race, events[0], editions[0], race.event_id ? eventSlugs.get(race.event_id) ?? null : null);
};

export async function resolvePublicRaceSlug(slug: string): Promise<PublicRaceSlugResolution | null> {
  const race = await getPublicRace(slug);
  if (race) return { race, shouldRedirect: false };

  const encodedSlug = encodeURIComponent(slug);
  const redirects = await fetchPublicRows(
    `race_slug_redirects?select=race_id&old_slug=eq.${encodedSlug}&limit=1`,
    raceSlugRedirectSchema,
  );
  const redirect = redirects[0];
  if (!redirect) return null;

  const races = await fetchPublicRows(
    `races?select=${raceSelect}&id=eq.${encodeURIComponent(redirect.race_id)}&web_catalog_is_live=eq.true&is_public=eq.true&limit=1`,
    raceSchema,
  );
  const canonicalRace = await loadPublicRace(races[0]);
  return canonicalRace ? { race: canonicalRace, shouldRedirect: true } : null;
}
