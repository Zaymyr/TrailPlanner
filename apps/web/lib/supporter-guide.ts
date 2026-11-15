import {
  isExplicitFinishName,
  normalizeSimpleClock,
  resolveOfficialCutoffSchedule,
  toRaceDayClock,
  type SupporterGuideFormat,
  type SupporterGuideLocation,
  type SupporterGuidePayload,
  type SupporterGuideService,
  type SupporterGuideStop,
  type SupporterGuideTimelineEntry,
} from "@trailplanner/shared";
import { z } from "zod";

import { serviceHeaders } from "./organizer";
import { partnerLinkSettingSchema, resolvePublicPartnerLink } from "./partner-links";
import { loadPublishedRacebookData } from "./racebook-public-data";
import type { SupabaseServiceConfig } from "./supabase";

const raceSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid(),
  edition_id: z.string().uuid(),
  name: z.string(),
  is_live: z.boolean(),
  racebook_is_live: z.boolean(),
  racebook_preview_is_visible: z.boolean().default(true),
});

const editionSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  race_events: z.union([z.object({
    name: z.string(), location: z.string().nullable(), thumbnail_url: z.string().nullable(),
  }), z.array(z.object({ name: z.string(), location: z.string().nullable(), thumbnail_url: z.string().nullable() }))]),
});

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const firstRecord = (value: unknown) => record(Array.isArray(value) ? value[0] : value);
const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() && Number.isFinite(Number(value)) ? Number(value) : null;
const bool = (value: unknown) => typeof value === "boolean" ? value : null;
// Standalone clocks only ("07:00:00" → "07:00"). Rich organizer wording such as
// "sam. 15h" is never truncated: cutoffs go through the official resolver.
const clock = (value: unknown) => normalizeSimpleClock(text(value));
const FINISH_CUTOFF_ID = "__finish__";

type GuideStation = SupporterGuideFormat["aidStations"][number];

/**
 * Resolves station and finish cutoffs exactly like the runner RaceBook: from
 * the official departure (common start, else first SAS), in course order, so
 * multi-day clocks land on the right day.
 */
function resolveFormatCutoffs(input: {
  startTime: string | null;
  raceDate: string | null;
  distanceKm: number;
  finishCutoffText: string | null;
  stations: Array<{ id: string; name: string; km: number; cutoffText: string | null }>;
}) {
  const finishStation = input.stations.at(-1) && isExplicitFinishName(input.stations.at(-1)!.name) ? input.stations.at(-1)! : null;
  const finishText = input.finishCutoffText ?? finishStation?.cutoffText ?? null;
  const schedule = resolveOfficialCutoffSchedule(input.startTime, input.raceDate, [
    ...input.stations
      .filter((station) => station.id !== finishStation?.id)
      .map((station) => ({
        id: station.id,
        km: station.km,
        cutoff: Math.abs(station.km - input.distanceKm) <= 0.2 ? finishText ?? station.cutoffText : station.cutoffText,
      })),
    { id: FINISH_CUTOFF_ID, km: Math.max(input.distanceKm, finishStation?.km ?? 0), cutoff: finishText },
  ]);
  const toClock = (minute: number | undefined) => minute === undefined ? null : toRaceDayClock(input.startTime, input.raceDate, minute);
  const finish = toClock(schedule[FINISH_CUTOFF_ID]);
  return {
    finish,
    finishStationId: finishStation?.id ?? null,
    byStationId: Object.fromEntries(input.stations.map((station) => [
      station.id,
      station.id === finishStation?.id ? finish : toClock(schedule[station.id]),
    ])) as Record<string, GuideStation["cutoff"]>,
  };
}

const STOP_MERGE_KM = 2;

/** Place-name key: accents, case and punctuation ignored, « St »/« Ste » read as Saint/Sainte. */
export function normalizePlaceName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bste\b/g, "sainte")
    .replace(/\bst\b/g, "saint")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Groups aid stations and supporter points of one format by place: rows with
 * the same normalized name within 2 km become one stop carrying all roles.
 */
export function buildSupporterStops(format: Pick<SupporterGuideFormat, "aidStations" | "supporterPoints">): SupporterGuideStop[] {
  type Item =
    | { kind: "station"; km: number; key: string; station: SupporterGuideFormat["aidStations"][number] }
    | { kind: "point"; km: number; key: string; point: SupporterGuideFormat["supporterPoints"][number] };
  const items: Item[] = [
    ...format.aidStations.map((station) => ({ kind: "station" as const, km: station.km, key: normalizePlaceName(station.name), station })),
    ...format.supporterPoints.map((point) => ({ kind: "point" as const, km: point.km, key: normalizePlaceName(point.name), point })),
  ].sort((left, right) => left.km - right.km);

  const groups: Item[][] = [];
  for (const item of items) {
    const group = item.key
      ? groups.find((candidate) => candidate.some((other) => other.key === item.key && Math.abs(other.km - item.km) <= STOP_MERGE_KM))
      : undefined;
    if (group) group.push(item);
    else groups.push([item]);
  }

  return groups.map((group) => {
    const stations = group.flatMap((item) => item.kind === "station" ? [item.station] : []);
    const points = group.flatMap((item) => item.kind === "point" ? [item.point] : []);
    const station = stations[0] ?? null;
    const located = points.find((point) => point.mapsUrl || (point.latitude !== null && point.longitude !== null)) ?? null;
    const kms = group.map((item) => item.km);
    const km = Math.min(...kms);
    const kmMax = Math.max(...kms);
    return {
      id: group.map((item) => item.kind === "station" ? `s:${item.station.id}` : `p:${item.point.id}`).join("+"),
      name: station?.name ?? points[0]!.name,
      km,
      kmMax: kmMax - km > 0.05 ? kmMax : null,
      aidStation: stations.length > 0,
      isFinish: stations.some((candidate) => candidate.isFinish === true),
      encouragementAllowed: points.some((point) => point.encouragementAllowed),
      assistanceAllowed: points.some((point) => point.assistanceAllowed),
      supportersAccess: station?.supportersAccess ?? null,
      maxStopMinutes: station?.maxStopMinutes ?? null,
      services: {
        water: stations.some((candidate) => candidate.waterAvailable !== false),
        food: stations.some((candidate) => candidate.solidAvailable !== false),
        runnerAssistance: stations.some((candidate) => candidate.assistanceAllowed),
        amenities: [...new Set(stations.flatMap((candidate) => candidate.amenities))],
      },
      cutoff: station?.cutoff ?? null,
      accessLabel: points.map((point) => point.accessLabel).find(Boolean) ?? null,
      accessNote: points.map((point) => point.accessNote).find(Boolean) ?? null,
      latitude: located?.latitude ?? null,
      longitude: located?.longitude ?? null,
      mapsUrl: located?.mapsUrl ?? null,
      planUrl: points.map((point) => point.planUrl).find(Boolean) ?? null,
    };
  });
}

type ProgrammeItem = {
  id: string;
  type: NonNullable<SupporterGuideTimelineEntry["animationType"]>;
  title: string;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
};

const PROGRAMME_TYPES = new Set(["animation", "concert", "kids_race", "briefing", "village", "other"]);

/** Edition programme items (animations...) from event organizer details; invalid rows are skipped. */
function parseProgramme(value: unknown): ProgrammeItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw, index) => {
    const row = record(raw);
    const title = text(row.title);
    const startTime = clock(row.startTime);
    if (!title || !startTime) return [];
    const type = text(row.type);
    return [{
      id: text(row.id) ?? `programme-${index}`,
      type: (type && PROGRAMME_TYPES.has(type) ? type : "animation") as ProgrammeItem["type"],
      title,
      date: text(row.date),
      startTime,
      endTime: clock(row.endTime),
      location: text(row.location),
    }];
  });
}

/** "7:45" / "26:30" → minutes. */
function durationMinutes(value: unknown): number | null {
  const match = /^(\d{1,3}):(\d{2})$/.exec(text(value) ?? "");
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function buildTimeline(
  formats: SupporterGuideFormat[],
  startMapsUrlByRaceId: Map<string, string | null> = new Map(),
  programme: ProgrammeItem[] = [],
  defaultDate: string | null = null,
): SupporterGuideTimelineEntry[] {
  const entries: SupporterGuideTimelineEntry[] = [];
  for (const format of formats) {
    if (format.startWaves.length > 0) {
      for (const wave of format.startWaves) {
        entries.push({ id: `start-${wave.id}`, raceId: format.raceId, raceName: format.name, kind: "start", date: format.date, time: wave.time, label: wave.name, location: null, mapsUrl: startMapsUrlByRaceId.get(format.raceId) ?? null });
      }
    } else if (format.startTime) {
      entries.push({ id: `start-${format.raceId}`, raceId: format.raceId, raceName: format.name, kind: "start", date: format.date, time: format.startTime, label: null, location: null, mapsUrl: startMapsUrlByRaceId.get(format.raceId) ?? null });
    }
    if (format.finishCutoff) {
      entries.push({ id: `finish-${format.raceId}`, raceId: format.raceId, raceName: format.name, kind: "finish_cutoff", date: format.finishCutoff.date ?? format.date, time: format.finishCutoff.time, label: null, location: null });
    }
    for (const audience of ["men", "women"] as const) {
      const estimate = format.estimatedWinners?.[audience];
      if (estimate) {
        entries.push({ id: `arrival-${audience}-${format.raceId}`, raceId: format.raceId, raceName: format.name, kind: "arrival_estimate", date: estimate.date ?? format.date, time: estimate.time, label: null, location: null, audience });
      }
    }
    for (const award of format.awards) {
      entries.push({ id: `awards-${award.id}`, raceId: format.raceId, raceName: format.name, kind: "awards", date: format.date, time: award.time, label: award.label, location: award.location });
    }
  }
  for (const item of programme) {
    entries.push({
      id: `animation-${item.id}`, raceId: "", raceName: "", kind: "animation", date: item.date ?? defaultDate, time: item.startTime!,
      label: item.title, location: item.location, eventWide: true, endTime: item.endTime, animationType: item.type,
    });
  }
  return entries.sort((left, right) =>
    (left.date ?? "9999").localeCompare(right.date ?? "9999") || left.time.localeCompare(right.time) || left.raceName.localeCompare(right.raceName, "fr"),
  );
}

function startDirectionsUrl(location: SupporterGuideLocation): string | null {
  if (location.mapsUrl) return location.mapsUrl;
  if (location.latitude !== null && location.longitude !== null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`;
  }
  return location.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address)}` : null;
}

function firstStartTime(format: Pick<SupporterGuideFormat, "startTime" | "startWaves">) {
  return format.startTime ?? format.startWaves[0]?.time ?? "99:99";
}
const stringArray = (value: unknown) => Array.isArray(value) ? value.flatMap((item) => text(item) ? [text(item)!] : []) : [];

function location(value: unknown, fallbackAddress: unknown = null): SupporterGuideLocation {
  const source = record(value);
  return {
    label: text(source.label),
    address: text(fallbackAddress) ?? text(source.label),
    latitude: number(source.lat ?? source.latitude),
    longitude: number(source.lng ?? source.longitude),
    mapsUrl: text(source.googleMapsUrl ?? source.google_maps_url),
  };
}

function normalizeService(rowValue: unknown): SupporterGuideService | null {
  const row = record(rowValue);
  const type = text(row.service_type);
  const name = text(row.name);
  if (!name || !type || !["restaurant", "accommodation", "recovery", "other"].includes(type)) return null;
  return {
    id: String(row.id),
    type: type as SupporterGuideService["type"],
    name,
    description: text(row.description),
    location: {
      label: text(row.address), address: text(row.address), latitude: number(row.latitude), longitude: number(row.longitude), mapsUrl: text(row.google_maps_url),
    },
    websiteUrl: text(row.website_url),
    phone: text(row.phone),
  };
}

export async function loadSupporterGuide(
  config: SupabaseServiceConfig,
  editionId: string,
  organizerPreview: boolean,
  publicBaseUrl = "https://pace-yourself.com",
): Promise<SupporterGuidePayload | null> {
  const headers = serviceHeaders(config, "");
  const [editionResponse, racesResponse] = await Promise.all([
    fetch(`${config.supabaseUrl}/rest/v1/race_event_editions?id=eq.${encodeURIComponent(editionId)}&select=id,event_id,start_date,end_date,race_events(name,location,thumbnail_url)&limit=1`, { headers, cache: "no-store" }),
    fetch(`${config.supabaseUrl}/rest/v1/races?edition_id=eq.${encodeURIComponent(editionId)}&select=id,event_id,edition_id,name,is_live,racebook_is_live,racebook_preview_is_visible&order=race_date.asc,name.asc`, { headers, cache: "no-store" }),
  ]);
  if (!editionResponse.ok || !racesResponse.ok) throw new Error("Unable to load Supporter Guide edition.");
  const edition = z.array(editionSchema).parse(await editionResponse.json())[0] ?? null;
  const candidates = z.array(raceSchema).parse(await racesResponse.json()).filter((race) =>
    race.racebook_preview_is_visible && (organizerPreview || (race.is_live && race.racebook_is_live)),
  );
  if (!edition || candidates.length === 0) return null;

  const loaded = (await Promise.all(candidates.map(async (race) => ({ race, snapshot: await loadPublishedRacebookData(config, race) }))))
    .filter((item): item is { race: z.infer<typeof raceSchema>; snapshot: NonNullable<Awaited<ReturnType<typeof loadPublishedRacebookData>>> } =>
      Boolean(item.snapshot?.modules.supporter_guide),
    );
  if (loaded.length === 0) return null;

  const formats: SupporterGuideFormat[] = loaded.map(({ race, snapshot }) => {
    const raceRow = record(snapshot.raceRow);
    const raceDetails = record(raceRow.organizer_details);
    const schedule = record(raceDetails.schedule);
    const raceDate = text(raceRow.race_date);
    const distanceKm = number(raceRow.distance_km) ?? 0;
    const startWaves = snapshot.startWaveRows.flatMap((value) => {
      const row = record(value); const name = text(row.name); const time = clock(row.start_time);
      return name && time ? [{ id: String(row.id), name, time, orderIndex: number(row.order_index) ?? 0 }] : [];
    }).sort((left, right) => left.orderIndex - right.orderIndex || left.time.localeCompare(right.time))
      .map(({ orderIndex: _orderIndex, ...wave }) => wave);
    const startTime = clock(schedule.startTime) ?? startWaves[0]?.time ?? null;
    const stationRows = snapshot.stationRows.flatMap((value) => {
      const row = record(value); const name = text(row.name); const km = number(row.km);
      return name && km !== null ? [{ row, name, km, orderIndex: number(row.order_index) ?? 0 }] : [];
    }).sort((left, right) => left.orderIndex - right.orderIndex || left.km - right.km);
    const cutoffs = resolveFormatCutoffs({
      startTime,
      raceDate,
      distanceKm,
      finishCutoffText: text(schedule.finishCutoffTime),
      stations: stationRows.map(({ row, name, km }) => ({ id: String(row.id), name, km, cutoffText: text(record(row.organizer_details).cutoffTime) })),
    });
    return {
      raceId: race.id,
      name: text(raceRow.name) ?? race.name,
      date: raceDate,
      distanceKm,
      elevationGainM: number(raceRow.elevation_gain_m),
      startTime,
      finishCutoffTime: cutoffs.finish?.time ?? clock(schedule.finishCutoffTime),
      finishCutoff: cutoffs.finish,
      estimatedWinners: {
        men: durationMinutes(schedule.estimatedWinnerMen) !== null ? toRaceDayClock(startTime, raceDate, durationMinutes(schedule.estimatedWinnerMen)!) : null,
        women: durationMinutes(schedule.estimatedWinnerWomen) !== null ? toRaceDayClock(startTime, raceDate, durationMinutes(schedule.estimatedWinnerWomen)!) : null,
      },
      startWaves,
      awards: snapshot.awardRows.flatMap((value) => {
        const row = record(value); const label = text(row.category_label); const time = clock(row.podium_time);
        return label && time ? [{ id: String(row.id), label, time, location: text(row.podium_location) }] : [];
      }),
      supporterPoints: snapshot.supporterPointRows.flatMap((value) => {
        const row = record(value); const name = text(row.name); const km = number(row.km);
        return name && km !== null && (row.encouragement_allowed === true || row.assistance_allowed === true) ? [{
          id: String(row.id), name, km, encouragementAllowed: row.encouragement_allowed === true, assistanceAllowed: row.assistance_allowed === true,
          accessLabel: text(row.access_label), accessNote: text(row.access_note), latitude: number(row.latitude), longitude: number(row.longitude), mapsUrl: text(row.google_maps_url), planUrl: text(row.plan_url),
        }] : [];
      }),
      aidStations: stationRows.map(({ row, name, km }) => {
        const details = record(row.organizer_details);
        const id = String(row.id);
        const supportersAccessValue = text(details.supportersAccess);
        const supportersAccess: "allowed" | "restricted" | "forbidden" | null =
          supportersAccessValue === "allowed" || supportersAccessValue === "restricted" || supportersAccessValue === "forbidden"
            ? supportersAccessValue
            : null;
        const cutoff = cutoffs.byStationId[id] ?? null;
        return {
          id, name, km, assistanceAllowed: row.assistance_allowed !== false,
          supportersAccess,
          maxStopMinutes: number(details.maxStopMinutes), amenities: stringArray(details.amenities),
          cutoffTime: cutoff?.time ?? clock(details.cutoffTime),
          cutoff,
          waterAvailable: row.water_available !== false,
          solidAvailable: row.solid_available !== false,
          isFinish: id === cutoffs.finishStationId,
        };
      }),
    };
  }).sort((left, right) => (left.date ?? "9999").localeCompare(right.date ?? "9999") || firstStartTime(left).localeCompare(firstStartTime(right)))
    .map((format) => ({ ...format, stops: buildSupporterStops(format) }));

  const representative = loaded[0]!.snapshot;
  const eventRow = firstRecord(record(representative.raceRow).race_events);
  const eventDetails = record(eventRow.organizer_details);
  const eventAccess = record(eventDetails.access);
  const eventBib = record(eventDetails.bibPickup);
  const servicesById = new Map<string, SupporterGuideService>();
  for (const { snapshot } of loaded) for (const value of snapshot.editionServiceRows) {
    const service = normalizeService(value); if (service) servicesById.set(service.id, service);
  }
  const services = [...servicesById.values()];
  const access = loaded.flatMap(({ race, snapshot }) => {
    if (!snapshot.modules.access) return [];
    const raceDetails = record(record(snapshot.raceRow).organizer_details);
    const raceAccess = record(raceDetails.access);
    const override = raceAccess.overrideEnabled === true;
    const source = override ? raceAccess : eventAccess;
    return [{
      raceId: race.id, raceName: race.name,
      start: location(source.startLocation, source.startAddress), finish: location(source.finishLocation, source.finishAddress),
      parking: text(source.officialParkings), shuttles: text(source.shuttles), shuttleSchedule: text(source.shuttleSchedule),
      roadRestrictions: text(source.roadRestrictions), mapUrl: text(source.mapUrl), note: text(source.note),
    }];
  });
  const thirdPartyBibPickup = loaded.flatMap(({ race, snapshot }) => {
    if (!snapshot.modules.bib_pickup) return [];
    const raceBib = record(record(record(snapshot.raceRow).organizer_details).bibPickup);
    const source = raceBib.overrideEnabled === true ? raceBib : eventBib;
    return bool(source.thirdPartyPickupAllowed) === true ? [{ raceId: race.id, raceName: race.name, allowed: true, conditions: text(source.thirdPartyPickupConditions) }] : [];
  });
  const linkCandidates: Array<{ kind: SupporterGuidePayload["practical"]["links"][number]["kind"]; url: string | null }> = [
    { kind: "official", url: text(eventDetails.officialWebsiteUrl) },
    { kind: "instagram", url: text(eventDetails.instagramUrl) },
    { kind: "facebook", url: text(eventDetails.facebookUrl) },
  ];
  const links = linkCandidates.flatMap((link) => link.url ? [{ kind: link.kind, url: link.url }] : []);
  const lodgingSlot = representative.partnerSlots?.find((slot) => slot.slot === "lodging");
  let lodgingPartner: SupporterGuidePayload["lodgingPartner"] = null;
  if (lodgingSlot?.mode === "partner" && lodgingSlot.partner) {
    lodgingPartner = {
      mode: "partner", name: lodgingSlot.partner.name, logoUrl: lodgingSlot.partner.logoUrl, headline: lodgingSlot.partner.headline,
      clickUrl: new URL(`/api/racebook-partner-slots/lodging/click?raceId=${loaded[0]!.race.id}`, publicBaseUrl).toString(),
    };
  } else if (lodgingSlot?.mode !== "hidden") {
    const linkResponse = await fetch(`${config.supabaseUrl}/rest/v1/partner_link_settings?partner_key=eq.booking&is_enabled=eq.true&select=partner_key,standard_url,affiliate_url,affiliate_enabled,is_enabled,updated_at&limit=1`, { headers, cache: "no-store" });
    if (linkResponse.ok) {
      const row = (await linkResponse.json() as unknown[])[0] as Record<string, unknown> | undefined;
      if (row) {
        const setting = partnerLinkSettingSchema.safeParse({ partnerKey: row.partner_key, standardUrl: row.standard_url, affiliateUrl: row.affiliate_url, affiliateEnabled: row.affiliate_enabled, isEnabled: row.is_enabled, updatedAt: row.updated_at });
        const resolved = setting.success ? resolvePublicPartnerLink(setting.data) : null;
        if (resolved) lodgingPartner = { mode: "affiliate", name: "Booking.com", logoUrl: null, headline: null, clickUrl: resolved.url };
      }
    }
  }
  const event = Array.isArray(edition.race_events) ? edition.race_events[0] : edition.race_events;
  const publishedDates = loaded.map(({ snapshot }) => snapshot.publishedAt).filter(Boolean).sort();
  return {
    schemaVersion: 1,
    edition: { id: edition.id, eventId: edition.event_id, name: event.name, location: event.location, startDate: edition.start_date, endDate: edition.end_date, imageUrl: event.thumbnail_url },
    formats,
    timeline: buildTimeline(
      formats,
      new Map(access.map((item) => [item.raceId, startDirectionsUrl(item.start)])),
      parseProgramme(eventDetails.programme),
      edition.start_date,
    ),
    onSiteServices: services.filter((service) => service.type === "recovery" || service.type === "other"),
    stayServices: services.filter((service) => service.type === "restaurant" || service.type === "accommodation"),
    lodgingPartner,
    practical: { access, thirdPartyBibPickup, emergencyPhone: text(record(eventDetails.emergencyContact).phone), links },
    publicationIds: loaded.map(({ snapshot }) => snapshot.publicationId),
    publishedAt: publishedDates.at(-1) ?? new Date(0).toISOString(),
    organizerPreview,
  };
}
