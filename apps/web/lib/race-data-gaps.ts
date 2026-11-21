import { z } from "zod";

import { addDays, getFormatDate, REEL_MIN_DISTANCE_KM, REEL_SPACING_DAYS } from "./reel-planner";
import type { SupabaseServiceConfig } from "./supabase";

/**
 * « GPX à traiter » of the Publications admin: the upcoming formats whose missing data keeps a reel
 * or a carousel from being made, with what each missing piece unlocks and the date it is needed by.
 * Rules mirror the planners: a reel needs a GPX and 30 km, aid stations are optional
 * (reel-planner.ts); « Le plan chiffré » needs a known D+, « Le brief » at least one aid station
 * (carousel-planner.ts). The GPX also gives the plan chiffré its real profile.
 */

export const DATA_GAPS_HORIZON_DAYS = 60;
/** Below this distance a format only matters for the carousels when it is not a short side race. */
export const DATA_GAPS_MIN_CAROUSEL_KM = 15;
/** Relays, duos, teams, walks and kids' races are never covered. */
const EXCLUDED_FORMAT = /relais|relay|\bduo\b|team|[ée]quipe|marche|rando|walk|nordique|kid|enfant|canitrail|cani-?cross/i;

export type GapFormat = {
  raceId: string;
  eventName: string | null;
  name: string;
  distanceKm: number;
  elevationGainM: number | null;
  hasGpx: boolean;
  aidStationCount: number;
  participationMode: string | null;
  date: string;
};

export type RaceDataGap = {
  raceId: string;
  date: string;
  eventName: string | null;
  name: string;
  distanceKm: number;
  missing: Array<"gpx" | "aid_stations" | "elevation_gain">;
  unlocks: Array<"reel" | "plan" | "brief">;
  /** Last day the data can arrive for the reel (published 7 days before, generated `leadDays` before that). */
  reelDeadline: string | null;
  reelTooLate: boolean;
};

/** Upcoming formats with missing data, the ones that unlock a reel first (soonest deadline), then by date. */
export const buildRaceDataGaps = (formats: GapFormat[], today: string, leadDays: number): RaceDataGap[] => {
  const horizon = addDays(today, DATA_GAPS_HORIZON_DAYS);
  const gaps: RaceDataGap[] = [];
  for (const format of formats) {
    if (format.date <= today || format.date > horizon) continue;
    if (format.participationMode === "relay" || EXCLUDED_FORMAT.test(format.name)) continue;
    if (!Number.isFinite(format.distanceKm) || format.distanceKm <= 0) continue;
    const missing: RaceDataGap["missing"] = [];
    if (!format.hasGpx) missing.push("gpx");
    if (format.aidStationCount < 1) missing.push("aid_stations");
    if (!format.elevationGainM || format.elevationGainM <= 0) missing.push("elevation_gain");
    if (!missing.length) continue;
    const unlocks: RaceDataGap["unlocks"] = [];
    const reelSized = format.distanceKm >= REEL_MIN_DISTANCE_KM;
    if (reelSized && missing.includes("gpx")) unlocks.push("reel");
    const carouselSized = format.distanceKm >= DATA_GAPS_MIN_CAROUSEL_KM;
    if (carouselSized && (missing.includes("elevation_gain") || missing.includes("gpx"))) unlocks.push("plan");
    if (carouselSized && missing.includes("aid_stations")) unlocks.push("brief");
    if (!unlocks.length) continue;
    const reelDeadline = unlocks.includes("reel") ? addDays(format.date, -(REEL_SPACING_DAYS + leadDays)) : null;
    gaps.push({
      raceId: format.raceId,
      date: format.date,
      eventName: format.eventName,
      name: format.name,
      distanceKm: format.distanceKm,
      missing,
      unlocks,
      reelDeadline,
      reelTooLate: reelDeadline !== null && reelDeadline < today,
    });
  }
  const rank = (gap: RaceDataGap) => (gap.reelDeadline && !gap.reelTooLate ? 0 : 1);
  return gaps.sort((left, right) => rank(left) - rank(right)
    || (rank(left) === 0 ? (left.reelDeadline ?? "").localeCompare(right.reelDeadline ?? "") : 0)
    || left.date.localeCompare(right.date)
    || (left.eventName ?? "").localeCompare(right.eventName ?? "")
    || right.distanceKm - left.distanceKm);
};

const raceRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  distance_km: z.coerce.number().nullable(),
  elevation_gain_m: z.coerce.number().nullable(),
  gpx_storage_path: z.string().nullable(),
  participation_mode: z.string().nullable().optional(),
  race_date: z.string().nullable(),
  race_events: z.object({ name: z.string().nullable(), race_date: z.string().nullable() }).nullable().optional(),
  edition: z.object({ start_date: z.string().nullable() }).nullable().optional(),
});

/** Live formats of the catalog with their aid station counts (service role, two reads). */
export const loadGapFormats = async (supabase: SupabaseServiceConfig): Promise<GapFormat[]> => {
  const get = async (path: string) => {
    const response = await fetch(`${supabase.supabaseUrl}/rest/v1/${path}`, {
      headers: { apikey: supabase.supabaseServiceRoleKey, Authorization: `Bearer ${supabase.supabaseServiceRoleKey}` },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Unable to read the race catalog (${response.status}).`);
    return response.json() as Promise<unknown>;
  };
  const races = z.array(raceRowSchema).parse(await get(
    "races?is_live=eq.true&select=id,name,distance_km,elevation_gain_m,gpx_storage_path,participation_mode,race_date,"
    + "race_events(name,race_date),edition:race_event_editions!races_edition_id_fkey(start_date)&limit=5000",
  ));
  const formats = races.flatMap((race) => {
    const date = getFormatDate({ raceDate: race.race_date, editionStartDate: race.edition?.start_date ?? null, eventDate: race.race_events?.race_date ?? null });
    return date ? [{ race, date: date.slice(0, 10) }] : [];
  });
  const ids = formats.map(({ race }) => race.id);
  const counts = new Map<string, number>();
  for (let index = 0; index < ids.length; index += 200) {
    const chunk = ids.slice(index, index + 200);
    const rows = z.array(z.object({ race_id: z.string() })).parse(await get(`race_aid_stations?race_id=in.(${chunk.join(",")})&select=race_id&limit=20000`));
    rows.forEach((row) => counts.set(row.race_id, (counts.get(row.race_id) ?? 0) + 1));
  }
  return formats.map(({ race, date }) => ({
    raceId: race.id,
    eventName: race.race_events?.name ?? null,
    name: race.name,
    distanceKm: race.distance_km ?? 0,
    elevationGainM: race.elevation_gain_m,
    hasGpx: Boolean(race.gpx_storage_path),
    aidStationCount: counts.get(race.id) ?? 0,
    participationMode: race.participation_mode ?? null,
    date,
  }));
};
