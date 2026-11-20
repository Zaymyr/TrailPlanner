import "server-only";

import { z } from "zod";

import { getReelShortName } from "../../app/admin/video-generator/reel-hook";
import {
  buildRunnerOrganizerDetails,
  getOrganizerBibPickupLocations,
  parseOrganizerAidStationDetails,
  parseOrganizerEventDetails,
  parseOrganizerRaceDetails,
} from "../organizer-dashboard-details";
import { buildPublicRaceRoutePreview } from "../public-race-detail";
import { addDays, getEditionKey, getFormatDate } from "../reel-planner";
import type { SupabaseServiceConfig } from "../supabase";
import { buildBriefSnapshot, type BriefSnapshot } from "./carousel-brief";
import { isNightStart, parisStartUtcMs } from "./carousel-band";
import { formatKm, upper } from "./carousel-format";
import { buildPlanSnapshot, titleWithDistance, type CarouselRaceData, type PlanFigures, type PlanSnapshot } from "./carousel-plan";
import type { CarouselCoverage, CarouselFormat, CarouselLockedSlot } from "./carousel-planner";
import type { CarouselSeries } from "./carousel-snapshot";
import { buildWeekSnapshot, isListedFormat, type WeekEvent, type WeekSnapshot } from "./carousel-week";

/**
 * Server reads of the carousels (service role): one race with its profile, stations, schedule and
 * livret signal; the races of a week; the catalog the slot planner needs.
 */

/** France's centre: only used for the sky colours when neither the GPX nor the race has coordinates. */
const FALLBACK_COORDINATES = { lat: 46.6, lon: 2.4 };
/** Tiers whose edition right includes the livret coureur (`racebook.publish`). */
const LIVRET_TIERS = new Set(["essential", "complete", "signature"]);

const headers = (supabase: SupabaseServiceConfig) => ({
  apikey: supabase.supabaseServiceRoleKey,
  Authorization: `Bearer ${supabase.supabaseServiceRoleKey}`,
});

const read = async (supabase: SupabaseServiceConfig, path: string) => {
  const response = await fetch(`${supabase.supabaseUrl}/rest/v1/${path}`, { headers: headers(supabase), cache: "no-store" });
  if (!response.ok) throw new Error(`Lecture du catalogue impossible (${response.status}).`);
  return response.json() as Promise<unknown>;
};

const raceRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  distance_km: z.coerce.number().nullable(),
  elevation_gain_m: z.coerce.number().nullable(),
  elevation_loss_m: z.coerce.number().nullable(),
  race_date: z.string().nullable(),
  gpx_storage_path: z.string().nullable(),
  event_id: z.string().uuid().nullable(),
  edition_id: z.string().uuid().nullable(),
  organizer_details: z.unknown().nullable().optional(),
  racebook_is_live: z.boolean().nullable().optional(),
  start_lat: z.number().nullable().optional(),
  start_lng: z.number().nullable().optional(),
  race_events: z.object({ name: z.string(), short_name: z.string().nullable().optional(), race_date: z.string().nullable().optional(), organizer_details: z.unknown().nullable().optional() }).nullable().optional(),
  edition: z.object({ start_date: z.string().nullable(), is_visible: z.boolean().nullable().optional() }).nullable().optional(),
});

const stationRowSchema = z.object({
  name: z.string(),
  km: z.coerce.number(),
  water_available: z.boolean().nullable().optional(),
  solid_available: z.boolean().nullable().optional(),
  organizer_details: z.unknown().nullable().optional(),
});

const hasText = (value: unknown) => typeof value === "string" && value.trim().length > 0;

/** Thrown when a race cannot be covered (missing data): the item is skipped, never failed. */
export class CarouselSkip extends Error {}

/**
 * The livret coureur signal of the brief: an active edition entitlement whose tier includes the
 * RaceBook (Essentiel, Complet, Signature; any source, including an admin or complimentary grant),
 * and the RaceBook of this format live and visible in the app. A paid livret that is not published
 * yet is not shown, since runners could not open it.
 */
const loadLivretAvailable = async (supabase: SupabaseServiceConfig, race: z.infer<typeof raceRowSchema>) => {
  if (!race.edition_id || race.racebook_is_live !== true || race.edition?.is_visible !== true) return false;
  const rows = z.array(z.object({ tier: z.string(), status: z.string() })).parse(await read(supabase,
    `organizer_edition_entitlements?edition_id=eq.${race.edition_id}&select=tier,status&limit=1`));
  return rows.some((row) => row.status === "active" && LIVRET_TIERS.has(row.tier));
};

/** Everything a plan or brief carousel needs about one format. */
export const loadCarouselRace = async (supabase: SupabaseServiceConfig, raceId: string): Promise<CarouselRaceData> => {
  const [race] = z.array(raceRowSchema).parse(await read(supabase,
    `races?id=eq.${raceId}&select=id,name,distance_km,elevation_gain_m,elevation_loss_m,race_date,gpx_storage_path,event_id,edition_id,organizer_details,racebook_is_live,start_lat,start_lng,`
    + "race_events(name,short_name,race_date,organizer_details),edition:race_event_editions!races_edition_id_fkey(start_date,is_visible)&limit=1"));
  if (!race) throw new CarouselSkip("Course introuvable.");
  if (!race.distance_km || race.distance_km <= 0) throw new CarouselSkip("Distance inconnue.");
  const raceDate = getFormatDate({ raceDate: race.race_date, editionStartDate: race.edition?.start_date ?? null, eventDate: race.race_events?.race_date ?? null });
  if (!raceDate) throw new CarouselSkip("Date de course inconnue.");

  const stations = z.array(stationRowSchema).parse(await read(supabase,
    `race_aid_stations?race_id=eq.${raceId}&select=name,km,water_available,solid_available,organizer_details&order=km.asc`));

  let profile: CarouselRaceData["profile"] = null;
  if (race.gpx_storage_path) {
    const response = await fetch(`${supabase.supabaseUrl}/storage/v1/object/race-gpx/${race.gpx_storage_path}`, { headers: headers(supabase), cache: "no-store" });
    if (response.ok) {
      try {
        const preview = buildPublicRaceRoutePreview(await response.text(), 800);
        const points = preview.points.flatMap((point) => (point.elevationM === null ? [] : [{ km: point.distanceKm, elevationM: point.elevationM, lat: point.lat, lon: point.lon }]));
        if (points.length >= 2) profile = points;
      } catch (error) {
        console.error("Carousel GPX unreadable", error instanceof Error ? error.message : error);
      }
    }
  }

  const eventName = race.race_events?.name ?? race.name;
  const runner = buildRunnerOrganizerDetails(parseOrganizerEventDetails(race.race_events?.organizer_details), parseOrganizerRaceDetails(race.organizer_details));
  const first = profile?.[0] as { lat?: number; lon?: number } | undefined;
  const lat = first?.lat ?? race.start_lat ?? FALLBACK_COORDINATES.lat;
  const lon = first?.lon ?? race.start_lng ?? FALLBACK_COORDINATES.lon;
  const access = runner.access as Record<string, unknown>;
  const services = runner.services as Record<string, unknown>;

  return {
    raceId: race.id,
    raceName: race.name,
    eventName,
    shortName: getReelShortName(eventName, race.race_events?.short_name ?? null),
    raceDate,
    startTime: runner.schedule.startTime ?? null,
    distanceKm: race.distance_km,
    elevationGainM: race.elevation_gain_m,
    elevationLossM: race.elevation_loss_m,
    profile: profile?.map((point) => ({ km: point.km, elevationM: point.elevationM })) ?? null,
    lat,
    lon,
    stations: stations
      .filter((station) => station.km > 0 && station.km < (race.distance_km as number))
      .map((station) => ({
        name: station.name,
        km: station.km,
        waterAvailable: station.water_available ?? true,
        solidAvailable: station.solid_available ?? true,
        cutoffTime: parseOrganizerAidStationDetails(station.organizer_details).cutoffTime ?? null,
      })),
    finishCutoffTime: runner.schedule.finishCutoffTime ?? null,
    startName: null,
    finishName: null,
    livret: {
      available: await loadLivretAvailable(supabase, race),
      equipment: runner.equipmentStatus.items.length > 0,
      bibPickup: getOrganizerBibPickupLocations(runner.bibPickup).length > 0 || hasText(runner.bibPickup.schedule),
      access: hasText(access.startAddress) || (Array.isArray(access.parkings) && access.parkings.length > 0) || hasText(access.officialParkings),
      services: Object.values(services).some(hasText),
    },
  };
};

export type BuiltCarousel =
  | { series: "plan"; raceId: string; title: string; snapshot: PlanSnapshot; facts: Record<string, unknown>; allowed: Array<string | number> }
  | { series: "brief"; raceId: string; title: string; snapshot: BriefSnapshot; facts: Record<string, unknown>; allowed: Array<string | number> }
  | { series: "week"; raceId: null; title: string; snapshot: WeekSnapshot; facts: Record<string, unknown>; allowed: Array<string | number> };

const planFacts = (race: CarouselRaceData, figures: PlanFigures) => ({
  course: race.raceName,
  evenement: race.eventName,
  date: race.raceDate,
  distanceKm: figures.distanceKm,
  denivelePositifM: figures.elevationGainM,
  ravitos: figures.stationCount,
  objectifs: figures.objectives.map((label, index) => ({ objectif: label, glucidesParHeure: figures.perHour[index], glucidesAuTotal: figures.totals[index] })),
});

/** Snapshot and writer facts of a plan or brief carousel for one race; CarouselSkip when it cannot be covered. */
export const buildRaceCarousel = async (supabase: SupabaseServiceConfig, series: "plan" | "brief", raceId: string): Promise<BuiltCarousel> => {
  const race = await loadCarouselRace(supabase, raceId);
  const title = titleWithDistance(race.raceName, race.distanceKm).replace(/ /g, " ");
  if (series === "plan") {
    const result = buildPlanSnapshot(race);
    if (!result.ok) throw new CarouselSkip(result.reason);
    const facts = planFacts(race, result.figures);
    return {
      series, raceId, title, snapshot: result.snapshot, facts,
      allowed: [race.raceName, race.eventName, race.raceDate, result.figures.distanceKm, result.figures.elevationGainM, race.distanceKm, race.elevationGainM ?? 0,
        result.figures.stationCount, ...result.figures.objectives, ...result.figures.perHour, ...result.figures.totals, 3],
    };
  }
  if (!race.stations.length) throw new CarouselSkip("Aucun ravito connu.");
  const startUtcMs = parisStartUtcMs(race.raceDate, race.startTime);
  const snapshot = buildBriefSnapshot({
    eventName: race.eventName,
    raceTitle: titleWithDistance(race.raceName, race.distanceKm),
    shortLabel: `${upper(race.shortName)} ${formatKm(race.distanceKm)} KM`,
    raceDate: race.raceDate,
    distanceKm: race.distanceKm,
    elevationGainM: race.elevationGainM,
    stations: race.stations,
    finishCutoffTime: race.finishCutoffTime,
    nightStart: isNightStart(startUtcMs, race.lat, race.lon),
    livret: race.livret,
  });
  const facts = {
    course: race.raceName,
    evenement: race.eventName,
    date: race.raceDate,
    heureDeDepart: race.startTime,
    departDeNuit: snapshot.palette === "night",
    distanceKm: race.distanceKm,
    denivelePositifM: race.elevationGainM,
    ravitos: race.stations.map((station) => ({ nom: station.name, km: station.km, barriereHoraire: station.cutoffTime })),
    livretCoureurDisponible: race.livret.available,
  };
  return {
    series, raceId, title, snapshot, facts,
    allowed: [race.raceName, race.eventName, race.raceDate, race.startTime ?? "", race.distanceKm, race.elevationGainM ?? 0, race.stations.length, race.finishCutoffTime ?? "",
      ...race.stations.flatMap((station) => [station.name, station.km, station.cutoffTime ?? ""])],
  };
};

// -- Week ---------------------------------------------------------------------------------------

const weekRaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  distance_km: z.coerce.number().nullable(),
  elevation_gain_m: z.coerce.number().nullable(),
  participation_mode: z.string().nullable().optional(),
  race_date: z.string().nullable(),
  event_id: z.string().uuid().nullable(),
  race_events: z.object({
    id: z.string().uuid(),
    name: z.string(),
    location: z.string().nullable().optional(),
    location_city: z.string().nullable().optional(),
    location_department: z.string().nullable().optional(),
    location_department_code: z.string().nullable().optional(),
    location_country: z.string().nullable().optional(),
    location_country_code: z.string().nullable().optional(),
  }).nullable().optional(),
  edition: z.object({ start_date: z.string().nullable() }).nullable().optional(),
});

const WEEK_SELECT = "id,name,distance_km,elevation_gain_m,participation_mode,race_date,event_id,"
  + "race_events(id,name,location,location_city,location_department,location_department_code,location_country,location_country_code)";

/** « EURE (27) », « LA RÉUNION », « THAÏLANDE » (abroad: the country), else the city or the free text. */
export const eventLocationLabel = (event: z.infer<typeof weekRaceSchema>["race_events"]) => {
  if (!event) return null;
  if (event.location_country_code && event.location_country_code !== "FR" && event.location_country) return event.location_country;
  if (event.location_department) return event.location_department_code ? `${event.location_department} (${event.location_department_code})` : event.location_department;
  return event.location_city ?? event.location ?? null;
};

/** Live formats dated in [from, to] (own date, else their edition start), with their event. */
const loadDatedRaces = async (supabase: SupabaseServiceConfig, from: string, to: string) => {
  const [own, byEdition] = await Promise.all([
    read(supabase, `races?is_live=eq.true&race_date=gte.${from}&race_date=lte.${to}&select=${WEEK_SELECT},edition:race_event_editions!races_edition_id_fkey(start_date)&limit=3000`),
    read(supabase, `races?is_live=eq.true&race_date=is.null&edition.start_date=gte.${from}&edition.start_date=lte.${to}&select=${WEEK_SELECT},edition:race_event_editions!races_edition_id_fkey!inner(start_date)&limit=3000`),
  ]);
  return [...z.array(weekRaceSchema).parse(own), ...z.array(weekRaceSchema).parse(byEdition)];
};

/** The events of the week starting on `monday` with their listed formats. */
export const loadWeekEvents = async (supabase: SupabaseServiceConfig, monday: string): Promise<WeekEvent[]> => {
  const races = await loadDatedRaces(supabase, monday, addDays(monday, 6));
  const events = new Map<string, WeekEvent>();
  races.forEach((race) => {
    const date = (race.race_date ?? race.edition?.start_date ?? "").slice(0, 10);
    if (!date || !race.distance_km) return;
    const key = race.race_events?.id ?? race.event_id ?? `race:${race.id}`;
    const event = events.get(key) ?? { eventId: key, name: race.race_events?.name ?? race.name, location: eventLocationLabel(race.race_events), formats: [] };
    event.formats.push({ raceId: race.id, name: race.name, date, distanceKm: race.distance_km, elevationGainM: race.elevation_gain_m, participationMode: race.participation_mode ?? null });
    events.set(key, event);
  });
  return Array.from(events.values());
};

/** Upcoming formats for the « Générer maintenant » picker (name with its event and date), soonest first. */
export const loadUpcomingRaces = async (supabase: SupabaseServiceConfig, from: string, days: number) => {
  const races = await loadDatedRaces(supabase, from, addDays(from, days));
  return races
    .flatMap((race) => {
      const date = (race.race_date ?? race.edition?.start_date ?? "").slice(0, 10);
      if (!date || !race.distance_km) return [];
      const eventName = race.race_events?.name;
      return [{ id: race.id, label: eventName && eventName !== race.name ? `${eventName} · ${race.name}` : race.name, date }];
    })
    .sort((left, right) => left.date.localeCompare(right.date) || left.label.localeCompare(right.label, "fr"))
    .slice(0, 400);
};

export const buildWeekCarousel = async (supabase: SupabaseServiceConfig, monday: string): Promise<BuiltCarousel> => {
  const events = await loadWeekEvents(supabase, monday);
  const snapshot = buildWeekSnapshot(events, monday);
  if (!snapshot) throw new CarouselSkip("Aucune course cette semaine.");
  const listed = snapshot.days.flatMap((day) => day.rows.map((row) => ({ jour: day.label, course: row.name, lieu: row.meta, formats: row.tiles.map((tile) => tile.km) })));
  return {
    series: "week",
    raceId: null,
    title: `La semaine qui vient · ${snapshot.range}`,
    snapshot,
    facts: { semaine: snapshot.range, nombreDeCourses: snapshot.eventCount, courses: listed },
    allowed: [snapshot.range, snapshot.eventCount, snapshot.subtitle, ...listed.flatMap((entry) => [entry.jour, entry.course, entry.lieu ?? "", ...entry.formats])],
  };
};

// -- Planner catalog ------------------------------------------------------------------------------

const catalogRaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  distance_km: z.coerce.number().nullable(),
  elevation_gain_m: z.coerce.number().nullable(),
  participation_mode: z.string().nullable().optional(),
  is_live: z.boolean().nullable(),
  gpx_storage_path: z.string().nullable(),
  race_date: z.string().nullable(),
  event_id: z.string().uuid().nullable(),
  edition_id: z.string().uuid().nullable(),
  race_events: z.object({ race_date: z.string().nullable().optional() }).nullable().optional(),
  edition: z.object({ start_date: z.string().nullable() }).nullable().optional(),
});

const CATALOG_SELECT = "id,name,distance_km,elevation_gain_m,participation_mode,is_live,gpx_storage_path,race_date,event_id,edition_id,race_events(race_date)";

export type CarouselCatalog = {
  formats: CarouselFormat[];
  coverage: CarouselCoverage[];
  /** Days taken by another publication: locked reel items and posts scheduled outside the carousel items. */
  occupiedDates: string[];
  weekEventCounts: Record<string, number>;
};

/** Everything `planCarousels` needs, for slots from `today` to the horizon. */
export const loadCarouselCatalog = async (
  supabase: SupabaseServiceConfig,
  today: string,
  horizonDays: number,
  weekMondays: string[],
  carouselPostIds: Set<string>,
): Promise<CarouselCatalog> => {
  const from = today;
  const to = addDays(today, horizonDays + 28);
  const [own, byEdition] = await Promise.all([
    read(supabase, `races?is_live=eq.true&race_date=gte.${from}&race_date=lte.${to}&select=${CATALOG_SELECT},edition:race_event_editions!races_edition_id_fkey(start_date)&limit=5000`),
    read(supabase, `races?is_live=eq.true&race_date=is.null&edition.start_date=gte.${from}&edition.start_date=lte.${to}&select=${CATALOG_SELECT},edition:race_event_editions!races_edition_id_fkey!inner(start_date)&limit=5000`),
  ]);
  const races = [...z.array(catalogRaceSchema).parse(own), ...z.array(catalogRaceSchema).parse(byEdition)];
  const ids = races.map((race) => race.id);
  const inIds = `race_id=in.(${ids.join(",")})`;
  const coverageRow = z.object({ race_id: z.string().uuid().nullable(), created_at: z.string(), media_type: z.string().optional(), carousel_series: z.string().nullable().optional(), series: z.string().optional() });
  const [stations, jobs, posts, carouselJobs, reelItems, scheduled] = await Promise.all([
    ids.length ? read(supabase, `race_aid_stations?${inIds}&select=race_id&limit=50000`) : Promise.resolve([]),
    ids.length ? read(supabase, `video_render_jobs?${inIds}&status=neq.failed&select=race_id,created_at&limit=5000`) : Promise.resolve([]),
    ids.length ? read(supabase, `social_posts?${inIds}&status=neq.failed&select=race_id,created_at,media_type,carousel_series&limit=5000`) : Promise.resolve([]),
    ids.length ? read(supabase, `carousel_render_jobs?${inIds}&status=neq.failed&select=race_id,created_at,series&limit=5000`) : Promise.resolve([]),
    read(supabase, "reel_automation_items?status=in.(generating,rendering,drafted,scheduled)&select=planned_publish_date,social_post_id&limit=1000"),
    read(supabase, "social_posts?status=in.(scheduled,publishing)&scheduled_at=not.is.null&select=id,scheduled_at&limit=1000"),
  ]);
  const stationCounts = new Map<string, number>();
  z.array(z.object({ race_id: z.string() })).parse(stations).forEach((row) => stationCounts.set(row.race_id, (stationCounts.get(row.race_id) ?? 0) + 1));

  const coverage: CarouselCoverage[] = [
    ...z.array(coverageRow).parse(jobs).map((row) => ({ ...row, kind: "reel" as const, series: null })),
    ...z.array(coverageRow).parse(posts).map((row) => ({
      ...row,
      kind: row.media_type === "carousel" ? "carousel" as const : "reel" as const,
      series: (row.carousel_series ?? null) as CarouselSeries | null,
    })),
    ...z.array(coverageRow).parse(carouselJobs).map((row) => ({ ...row, kind: "carousel" as const, series: (row.series ?? null) as CarouselSeries | null })),
  ].flatMap((row) => (row.race_id ? [{ raceId: row.race_id, createdAt: row.created_at, kind: row.kind, series: row.series }] : []));

  const reelRows = z.array(z.object({ planned_publish_date: z.string(), social_post_id: z.string().nullable() })).parse(reelItems);
  const reelPosts = new Set(reelRows.flatMap((row) => (row.social_post_id ? [row.social_post_id] : [])));
  const parisDay = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  const occupiedDates = [
    ...reelRows.map((row) => row.planned_publish_date.slice(0, 10)),
    ...z.array(z.object({ id: z.string(), scheduled_at: z.string() })).parse(scheduled)
      .filter((row) => !carouselPostIds.has(row.id) && !reelPosts.has(row.id))
      .map((row) => parisDay(row.scheduled_at)),
  ];

  const weekEventCounts: Record<string, number> = {};
  for (const monday of weekMondays) {
    const sunday = addDays(monday, 6);
    const listedEvents = new Set(races.flatMap((race) => {
      const date = (race.race_date ?? race.edition?.start_date ?? "").slice(0, 10);
      if (!date || date < monday || date > sunday || !race.distance_km) return [];
      const listed = isListedFormat({ raceId: race.id, name: race.name, date, distanceKm: race.distance_km, elevationGainM: race.elevation_gain_m, participationMode: race.participation_mode ?? null });
      return listed ? [race.event_id ?? race.id] : [];
    }));
    weekEventCounts[monday] = listedEvents.size;
  }

  return {
    formats: races.flatMap((race) => (race.distance_km ? [{
      raceId: race.id,
      name: race.name,
      distanceKm: race.distance_km,
      elevationGainM: race.elevation_gain_m,
      isLive: Boolean(race.is_live),
      hasGpx: Boolean(race.gpx_storage_path),
      aidStationCount: stationCounts.get(race.id) ?? 0,
      participationMode: race.participation_mode ?? null,
      raceDate: race.race_date,
      editionStartDate: race.edition?.start_date ?? null,
      eventDate: race.race_events?.race_date ?? null,
      eventId: race.event_id,
      editionId: race.edition_id,
    }] : [])),
    coverage,
    occupiedDates,
    weekEventCounts,
  };
};

/** Edition key of a format (same rule as the reels). */
export const editionKeyOf = (format: CarouselFormat) => getEditionKey(format);

export type { CarouselLockedSlot };
