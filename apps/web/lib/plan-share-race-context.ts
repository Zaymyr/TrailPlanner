import { resolveFollowedPlanCompletionAt } from "@trailplanner/shared";

import { loadPublishedRacebookData } from "./racebook-public-data";
import type { PlanShareSnapshot } from "./plan-share";
import { planShareServiceHeaders } from "./plan-share-follow-service";
import type { SupabaseServiceConfig } from "./supabase";

const KM_MATCH_TOLERANCE = 0.15;

const record = (value: unknown): Record<string, any> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
const firstRecord = (value: unknown) => record(Array.isArray(value) ? value[0] : value);
const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
const number = (value: unknown) => {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};
const bool = (value: unknown) => value === true;

function location(value: unknown) {
  const item = record(value);
  return {
    label: text(item.label),
    latitude: number(item.lat),
    longitude: number(item.lng),
    googleMapsUrl: text(item.googleMapsUrl),
  };
}

function access(value: unknown) {
  const item = record(value);
  const enabled = record(item.enabledSections);
  return {
    startAddress: text(item.startAddress),
    startLocation: location(item.startLocation),
    finishAddress: text(item.finishAddress),
    finishLocation: location(item.finishLocation),
    officialParkings: enabled.officialParkings === false ? null : text(item.officialParkings),
    shuttles: enabled.shuttles === false ? null : text(item.shuttles),
    shuttleSchedule: enabled.shuttles === false ? null : text(item.shuttleSchedule),
    mapUrl: enabled.mapUrl === false ? null : text(item.mapUrl),
    note: text(item.note),
  };
}

function hasLocation(value: ReturnType<typeof location>) {
  return Boolean(value.label || value.googleMapsUrl || (value.latitude !== null && value.longitude !== null));
}

function mergeAccess(eventValue: unknown, raceValue: unknown) {
  const common = access(eventValue);
  const race = access(raceValue);
  return {
    startAddress: race.startAddress ?? common.startAddress,
    startLocation: hasLocation(race.startLocation) ? race.startLocation : common.startLocation,
    finishAddress: race.finishAddress ?? common.finishAddress,
    finishLocation: hasLocation(race.finishLocation) ? race.finishLocation : common.finishLocation,
    officialParkings: race.officialParkings ?? common.officialParkings,
    shuttles: race.shuttles ?? common.shuttles,
    shuttleSchedule: race.shuttleSchedule ?? common.shuttleSchedule,
    mapUrl: race.mapUrl ?? common.mapUrl,
    note: race.note ?? common.note,
  };
}

function bibPickup(eventDetails: Record<string, any>, raceDetails: Record<string, any>) {
  const raceBib = record(raceDetails.bibPickup);
  const chosen = raceBib.overrideEnabled === true ? raceBib : record(eventDetails.bibPickup);
  const allowed = typeof chosen.thirdPartyPickupAllowed === "boolean" ? chosen.thirdPartyPickupAllowed : null;
  return allowed === null && !text(chosen.thirdPartyPickupConditions)
    ? null
    : { thirdPartyPickupAllowed: allowed, thirdPartyPickupConditions: text(chosen.thirdPartyPickupConditions) };
}

export function matchPlanCheckpointToPublishedStation<T extends { id: string; km: number }>(
  checkpoint: Pick<PlanShareSnapshot["checkpoints"][number], "sourceAidStationId" | "distanceKm">,
  stations: T[],
) {
  if (checkpoint.sourceAidStationId) {
    return stations.find((station) => station.id === checkpoint.sourceAidStationId) ?? null;
  }
  const candidates = stations.filter((station) => Math.abs(station.km - checkpoint.distanceKm) <= KM_MATCH_TOLERANCE);
  return candidates.length === 1 ? candidates[0] : null;
}

function normalizeStation(row: Record<string, any>) {
  const details = record(row.organizer_details);
  const supportersAccess = ["allowed", "restricted", "forbidden"].includes(details.supportersAccess)
    ? details.supportersAccess as "allowed" | "restricted" | "forbidden"
    : null;
  const amenities = Array.isArray(details.amenities)
    ? details.amenities.map(text).filter((value): value is string => Boolean(value))
    : text(details.amenities)?.split(",").map((value) => value.trim()).filter(Boolean) ?? [];
  return {
    id: String(row.id ?? ""),
    name: text(row.name) ?? "",
    km: number(row.km) ?? NaN,
    supportersAccess,
    maxStopMinutes: number(details.maxStopMinutes),
    amenities,
    cutoffTime: text(details.cutoffTime),
    cutoffDayOffset: Math.max(0, Math.floor(number(details.cutoffDayOffset) ?? 0)),
    assistanceAllowed: row.assistance_allowed !== false,
  };
}

export async function loadPlanShareRaceContext(
  config: SupabaseServiceConfig,
  snapshot: PlanShareSnapshot,
) {
  if (!snapshot.raceId) return null;
  const visibility = await fetch(
    `${config.supabaseUrl}/rest/v1/races?id=eq.${encodeURIComponent(snapshot.raceId)}&select=id,edition_id,is_live,racebook_is_live,racebook_preview_is_visible,race_events(is_live)&limit=1`,
    { headers: planShareServiceHeaders(config), cache: "no-store" },
  );
  if (!visibility.ok) return null;
  const race = ((await visibility.json().catch(() => [])) as any[])[0];
  const eventVisibility = firstRecord(race?.race_events);
  if (!race || race.is_live !== true || race.racebook_is_live !== true || race.racebook_preview_is_visible === false || eventVisibility.is_live !== true) return null;

  const published = await loadPublishedRacebookData(config, race);
  if (!published) return null;
  const raceRow = record(published.raceRow);
  const eventRow = firstRecord(raceRow.race_events);
  const raceDetails = record(raceRow.organizer_details);
  const eventDetails = record(eventRow.organizer_details);
  const schedule = record(raceDetails.schedule);
  const stations = published.stationRows.map((row) => normalizeStation(record(row))).filter((row) => row.id && Number.isFinite(row.km));
  const matchedCheckpointContexts = snapshot.checkpoints.flatMap((checkpoint) => {
    if (!published.modules.aid_stations || checkpoint.isStart || checkpoint.isFinish) return [];
    const matched = matchPlanCheckpointToPublishedStation(checkpoint, stations);
    return matched ? [{ checkpointIndex: checkpoint.index, ...matched }] : [];
  });
  const startWaves = published.startWaveRows
    .map((row) => text(record(row).start_time))
    .filter((value): value is string => Boolean(value))
    .sort();
  const supporterPoints = published.modules.supporter_points ? published.supporterPointRows.map((raw) => {
    const row = record(raw);
    const latitude = number(row.latitude);
    const longitude = number(row.longitude);
    if (!text(row.id) || !text(row.name) || number(row.km) === null || latitude === null || longitude === null) return null;
    return {
      id: text(row.id)!, name: text(row.name)!, km: number(row.km)!,
      encouragementAllowed: bool(row.encouragement_allowed), assistanceAllowed: bool(row.assistance_allowed),
      accessLabel: text(row.access_label), latitude, longitude,
      googleMapsUrl: text(row.google_maps_url), accessNote: text(row.access_note), planUrl: text(row.plan_url),
    };
  }).filter((point): point is NonNullable<typeof point> => point !== null) : [];
  const checkpointContexts = matchedCheckpointContexts.map((checkpoint) => {
    const directions = supporterPoints.filter((point): point is NonNullable<typeof point> =>
      Boolean(point) && point.assistanceAllowed && Math.abs(point.km - checkpoint.km) <= KM_MATCH_TOLERANCE,
    );
    const point = directions.length === 1 ? directions[0] : null;
    return {
      ...checkpoint,
      accessLabel: point?.accessLabel ?? null,
      accessNote: point?.accessNote ?? null,
      googleMapsUrl: point?.googleMapsUrl ?? null,
      latitude: point?.latitude ?? null,
      longitude: point?.longitude ?? null,
    };
  });
  const emergency = record(eventDetails.emergencyContact);
  const raceDate = text(raceRow.race_date) ?? text(eventRow.race_date);
  const officialStartTime = text(schedule.startTime)?.slice(0, 5) ?? startWaves[0]?.slice(0, 5) ?? null;
  const finishCutoffTime = text(schedule.finishCutoffTime);
  const finishCutoffDayOffset = Math.max(0, Math.floor(number(schedule.cutoffDayOffset) ?? 0));

  return {
    raceId: snapshot.raceId,
    raceName: text(raceRow.name) ?? snapshot.name,
    raceDate,
    officialStartTime,
    finishCutoffTime,
    finishCutoffDayOffset,
    supporterPoints,
    checkpointContexts,
    access: published.modules.access ? mergeAccess(eventDetails.access, raceDetails.access) : null,
    bibPickup: published.modules.bib_pickup ? bibPickup(eventDetails, raceDetails) : null,
    emergencyContact: text(emergency.phone) ? { name: text(emergency.name), phone: text(emergency.phone)! } : null,
    publishedAt: published.publishedAt,
    completionAt: resolveFollowedPlanCompletionAt({
      raceDate,
      officialStartTime,
      totalDurationMin: snapshot.totalDurationMin,
      finishCutoffTime,
      finishCutoffDayOffset,
      checkpointCutoffs: checkpointContexts.map((checkpoint) => ({ cutoffTime: checkpoint.cutoffTime, cutoffDayOffset: checkpoint.cutoffDayOffset })),
    }),
  };
}
