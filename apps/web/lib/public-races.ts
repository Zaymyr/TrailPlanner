import "server-only";

import { z } from "zod";

import { getSupabaseAnonConfig } from "./supabase";

const raceSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid().nullable(),
  slug: z.string().min(1),
  name: z.string().min(1),
  race_date: z.string().nullable(),
  location_text: z.string().nullable(),
  location: z.string().nullable(),
  distance_km: z.number().nullable(),
  elevation_gain_m: z.number().nullable(),
  thumbnail_url: z.string().nullable(),
  external_site_url: z.string().nullable(),
});

const eventSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  location: z.string().nullable(),
  race_date: z.string().nullable(),
  thumbnail_url: z.string().nullable(),
});

const raceSlugRedirectSchema = z.object({
  race_id: z.string().uuid(),
});

export type PublicRace = {
  id: string;
  eventId: string | null;
  slug: string;
  name: string;
  eventName: string | null;
  date: string | null;
  location: string | null;
  distanceKm: number | null;
  elevationGainM: number | null;
  thumbnailUrl: string | null;
  externalSiteUrl: string | null;
};

export type PublicRaceSlugResolution = {
  race: PublicRace;
  shouldRedirect: boolean;
};

const raceSelect = [
  "id",
  "event_id",
  "slug",
  "name",
  "race_date",
  "location_text",
  "location",
  "distance_km",
  "elevation_gain_m",
  "thumbnail_url",
  "external_site_url",
].join(",");

const eventSelect = ["id", "name", "location", "race_date", "thumbnail_url"].join(",");

const fetchPublicRows = async <T>(path: string, schema: z.ZodType<T>): Promise<T[]> => {
  const config = getSupabaseAnonConfig();
  if (!config) return [];

  try {
    const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
      },
      next: { revalidate: 3600 },
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

const toPublicRace = (
  race: z.infer<typeof raceSchema>,
  event: z.infer<typeof eventSchema> | undefined,
): PublicRace => ({
  id: race.id,
  eventId: race.event_id,
  slug: race.slug,
  name: race.name,
  eventName: event?.name ?? null,
  date: race.race_date ?? event?.race_date ?? null,
  location: race.location_text ?? race.location ?? event?.location ?? null,
  distanceKm: race.distance_km,
  elevationGainM: race.elevation_gain_m,
  thumbnailUrl: race.thumbnail_url ?? event?.thumbnail_url ?? null,
  externalSiteUrl: race.external_site_url,
});

export async function getPublicRaces(): Promise<PublicRace[]> {
  const [races, events] = await Promise.all([
    fetchPublicRows(
      `races?select=${raceSelect}&is_live=eq.true&is_public=eq.true&order=race_date.asc.nullslast,name.asc`,
      raceSchema,
    ),
    fetchPublicRows(`race_events?select=${eventSelect}&is_live=eq.true`, eventSchema),
  ]);
  const eventsById = new Map(events.map((event) => [event.id, event]));

  return races
    .filter((race) => !race.event_id || eventsById.has(race.event_id))
    .map((race) => toPublicRace(race, race.event_id ? eventsById.get(race.event_id) : undefined));
}

export async function getPublicRace(slug: string): Promise<PublicRace | null> {
  const encodedSlug = encodeURIComponent(slug);
  const races = await fetchPublicRows(
    `races?select=${raceSelect}&slug=eq.${encodedSlug}&is_live=eq.true&is_public=eq.true&limit=1`,
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

  // A format attached to an unpublished event must not become public merely
  // because its own flags are still live.
  if (race.event_id && !events[0]) return null;

  return toPublicRace(race, events[0]);
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
    `races?select=${raceSelect}&id=eq.${encodeURIComponent(redirect.race_id)}&is_live=eq.true&is_public=eq.true&limit=1`,
    raceSchema,
  );
  const canonicalRace = await loadPublicRace(races[0]);
  return canonicalRace ? { race: canonicalRace, shouldRedirect: true } : null;
}
