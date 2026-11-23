import { z } from "zod";

/**
 * Data and pure helpers of Catalogue › Courses & événements (`AdminRaceCatalogSection` and its
 * dialogs of `catalog/`, lot 5): row schemas of `GET /api/admin/race-catalog`, form schemas, aid
 * station drafts, the grouping by event, the image checks and the PATCH bodies. Moved out of the
 * 2 348-line component without behaviour change.
 */

export const basePillClass = "whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold";

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export const raceEventSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  short_name: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  race_date: z.string().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  is_live: z.boolean().nullable().optional(),
});

export const raceRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  event_id: z.string().uuid().nullable().optional(),
  location_text: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  distance_km: z.number(),
  elevation_gain_m: z.number().nullable(),
  elevation_loss_m: z.number().nullable().optional(),
  trace_provider: z.string().nullable().optional(),
  trace_id: z.number().nullable().optional(),
  external_site_url: z.string().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  gpx_storage_path: z.string().nullable().optional(),
  is_live: z.boolean(),
  slug: z.string(),
  created_at: z.string().optional(),
  race_events: raceEventSchema.nullable().optional(),
});

export const aidStationRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  km: z.number(),
  water_available: z.boolean(),
  notes: z.string().nullable().optional(),
  order_index: z.number(),
});

export type RaceRow = z.infer<typeof raceRowSchema>;
export type RaceEventRow = z.infer<typeof raceEventSchema>;
export type AidStationRow = z.infer<typeof aidStationRowSchema>;

export const editFormSchema = z.object({
  name: z.string().trim().min(1),
  event_id: z.string().trim().optional(),
  location_text: z.string().trim().optional(),
  elevation_gain_m: z.string().trim().optional(),
  elevation_loss_m: z.string().trim().optional(),
  trace_id: z.string().trim().optional(),
  external_site_url: z.string().trim().optional(),
  thumbnail_url: z.string().trim().optional(),
  is_live: z.boolean(),
});

export type EditFormValues = z.infer<typeof editFormSchema>;

export const editEventFormSchema = z.object({
  name: z.string().trim().min(1),
  short_name: z.string().trim().max(40, "40 caractères au plus.").refine((value) => !value.includes("…"), "Sans « … » : le nom s’affiche en entier.").optional(),
  location: z.string().trim().optional(),
  race_date: z.string().trim().optional(),
  thumbnail_url: z.string().trim().optional(),
  is_live: z.boolean(),
});

export type EditEventFormValues = z.infer<typeof editEventFormSchema>;

export const addFormSchema = z.object({
  name: z.string().trim().optional(),
  event_id: z.string().trim().optional(),
  event_name: z.string().trim().optional(),
  event_location: z.string().trim().optional(),
  event_race_date: z.string().trim().optional(),
  event_thumbnail_url: z.string().trim().optional(),
  race_date: z.string().trim().optional(),
  location_text: z.string().trim().optional(),
  elevation_gain_m: z.string().trim().optional(),
  elevation_loss_m: z.string().trim().optional(),
  trace_id: z.string().trim().optional(),
  external_site_url: z.string().trim().optional(),
  thumbnail_url: z.string().trim().optional(),
  is_live: z.boolean(),
});

export type AddFormValues = z.infer<typeof addFormSchema>;

export const ADD_FORM_DEFAULTS: AddFormValues = {
  name: "",
  event_id: "",
  event_name: "",
  event_location: "",
  event_race_date: "",
  event_thumbnail_url: "",
  race_date: "",
  location_text: "",
  elevation_gain_m: "",
  elevation_loss_m: "",
  trace_id: "",
  external_site_url: "",
  thumbnail_url: "",
  is_live: false,
};

export type ParsedPreview = { distanceKm: number; gainM: number; lossM: number; waypointCount: number };
export type EventMode = "none" | "existing" | "new";
export type AidStationDraft = { name: string; distanceKm: string; waterRefill: boolean };
export type PreparedAidStation = AidStationDraft & { distanceKmValue: number; hasValue: boolean };
export type ImportedRacePreview = {
  url: string;
  courseName: string;
  eventName: string;
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  date: string | null;
  location: string | null;
  aidStationCount: number;
  gpxAccessMode?: "public" | "authenticated" | "embedded";
};
export type ExistingRacePreview = {
  id: string;
  name: string;
  slug?: string | null;
};
export type RaceGroup = {
  key: string;
  title: string;
  meta: string | null;
  event: RaceEventRow | null;
  thumbnailUrl: string | null;
  races: RaceRow[];
  isWithoutEvent: boolean;
};

export const normalizeAidStationDrafts = (stations: AidStationDraft[]): PreparedAidStation[] =>
  stations
    .map((station) => {
      const name = station.name.trim();
      const distanceText = station.distanceKm.trim();
      return {
        name,
        distanceKm: distanceText,
        distanceKmValue: distanceText ? Number(distanceText.replace(",", ".")) : Number.NaN,
        waterRefill: station.waterRefill,
        hasValue: name.length > 0 || distanceText.length > 0,
      };
    })
    .filter((station) => station.hasValue);

/** A kept aid station needs a name and a distance ≥ 0. */
export const hasInvalidAidStation = (stations: PreparedAidStation[]) =>
  stations.some((station) => station.name.length === 0 || !Number.isFinite(station.distanceKmValue) || station.distanceKmValue < 0);

/** Body of the aid-station requests (`PUT …/aid-stations`, `aid_stations` of the creation form). */
export const aidStationPayload = (stations: PreparedAidStation[]) =>
  stations.map((station) => ({
    name: station.name,
    distanceKm: station.distanceKmValue,
    waterRefill: station.waterRefill,
  }));

export const aidStationRowsToDrafts = (stations: AidStationRow[]): AidStationDraft[] =>
  [...stations]
    .sort((a, b) => a.order_index - b.order_index)
    .map((station) => ({
      name: station.name,
      distanceKm: String(station.km),
      waterRefill: station.water_available,
    }));

/** A new draft row: « Ravito N », water on. */
export const appendAidStationDraft = (stations: AidStationDraft[]): AidStationDraft[] => [
  ...stations,
  { name: `Ravito ${stations.length + 1}`, distanceKm: "", waterRefill: true },
];

/** Case-insensitive match on the race name (the list search). */
export const filterRacesByName = (races: RaceRow[], search: string) =>
  search ? races.filter((race) => race.name.toLowerCase().includes(search.toLowerCase())) : races;

/**
 * One group per event (event of `events`, else the embedded `race_events`), sorted by title; races
 * without an event go last under `noEventTitle`.
 */
export const groupRacesByEvent = (races: RaceRow[], events: RaceEventRow[], noEventTitle: string): RaceGroup[] => {
  const eventById = new Map(events.map((event) => [event.id, event]));
  const groups = new Map<string, RaceGroup>();

  for (const race of races) {
    const event = race.event_id ? (eventById.get(race.event_id) ?? race.race_events ?? null) : race.race_events ?? null;
    const key = event?.id ? `event:${event.id}` : "event:none";
    const existingGroup = groups.get(key);

    if (existingGroup) {
      existingGroup.races.push(race);
      continue;
    }

    groups.set(key, {
      key,
      title: event?.name ?? noEventTitle,
      meta: event ? [event.location, event.race_date].filter(Boolean).join(" - ") || null : null,
      event,
      thumbnailUrl: event?.thumbnail_url ?? null,
      races: [race],
      isWithoutEvent: !event,
    });
  }

  return [...groups.values()].sort((left, right) => {
    if (left.isWithoutEvent !== right.isWithoutEvent) return left.isWithoutEvent ? 1 : -1;
    return left.title.localeCompare(right.title, undefined, { sensitivity: "base" });
  });
};

/** `"type"` / `"size"` when an image cannot be uploaded (JPEG, PNG, WebP, AVIF up to 5 MB). */
export const imageFileProblem = (file: Pick<File, "type" | "size">): "type" | "size" | null => {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return "type";
  if (file.size > MAX_IMAGE_SIZE) return "size";
  return null;
};

/** PATCH body of `/api/race-catalog/[id]`: only the fields given, empty texts as `null`. */
export const racePatchBody = (fields: Partial<EditFormValues>): Record<string, unknown> => {
  const body: Record<string, unknown> = {};
  if (fields.name !== undefined) body.name = fields.name;
  if (fields.event_id !== undefined) body.event_id = fields.event_id || null;
  if (fields.location_text !== undefined) body.location_text = fields.location_text || null;
  if (fields.elevation_gain_m !== undefined && fields.elevation_gain_m !== "") {
    body.elevation_gain_m = Number(fields.elevation_gain_m.replace(",", "."));
  }
  if (fields.elevation_loss_m !== undefined) {
    body.elevation_loss_m = fields.elevation_loss_m === "" ? null : Number(fields.elevation_loss_m.replace(",", "."));
  }
  if (fields.trace_id !== undefined) body.trace_id = fields.trace_id || null;
  if (fields.external_site_url !== undefined) body.external_site_url = fields.external_site_url || null;
  if (fields.thumbnail_url !== undefined) body.thumbnail_url = fields.thumbnail_url || null;
  if (fields.is_live !== undefined) body.is_live = fields.is_live;
  return body;
};

/** PATCH body of `/api/admin/race-events/[id]`. */
export const eventPatchBody = (fields: Partial<EditEventFormValues>): Record<string, unknown> => {
  const body: Record<string, unknown> = {};
  if (fields.name !== undefined) body.name = fields.name;
  if (fields.location !== undefined) body.location = fields.location || null;
  if (fields.race_date !== undefined) body.race_date = fields.race_date || null;
  if (fields.thumbnail_url !== undefined) body.thumbnail_url = fields.thumbnail_url || null;
  if (fields.is_live !== undefined) body.is_live = fields.is_live;
  if (fields.short_name !== undefined) body.short_name = fields.short_name || null;
  return body;
};

/** Form values of « Modifier » for a race. */
export const raceEditDefaults = (race: RaceRow): EditFormValues => ({
  name: race.name,
  event_id: race.event_id ?? "",
  location_text: race.location_text ?? "",
  elevation_gain_m: race.elevation_gain_m === null ? "" : Math.round(race.elevation_gain_m).toString(),
  elevation_loss_m: race.elevation_loss_m != null ? Math.round(race.elevation_loss_m).toString() : "",
  trace_id: race.trace_id?.toString() ?? "",
  external_site_url: race.external_site_url ?? "",
  thumbnail_url: race.thumbnail_url ?? "",
  is_live: race.is_live,
});

/** Form values of « Modifier l’événement ». */
export const eventEditDefaults = (event: RaceEventRow): EditEventFormValues => ({
  name: event.name,
  short_name: event.short_name ?? "",
  location: event.location ?? "",
  race_date: event.race_date ?? "",
  thumbnail_url: event.thumbnail_url ?? "",
  is_live: event.is_live !== false,
});

/** A race whose GPX can be re-imported from Trace de Trail. */
export const canEnrichFromTraceDeTrail = (race: Pick<RaceRow, "trace_id" | "trace_provider" | "external_site_url"> | null | undefined) =>
  Boolean(race?.trace_id || race?.trace_provider === "tracedetrail" || race?.external_site_url?.includes("tracedetrail.fr"));

/** JSON body of a mutation error (`message`), or the fallback. */
export const readErrorMessage = async (response: Response, fallback: string) => {
  const data = (await response.json().catch(() => null)) as { message?: string } | null;
  return data?.message ?? fallback;
};
