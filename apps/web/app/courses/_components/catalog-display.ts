import type { PublicRaceAidStationSummary, PublicRaceDetail } from "../../../lib/public-race-detail";
import type { PublicRace } from "../../../lib/public-races";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
});

const shortMonthFormatter = new Intl.DateTimeFormat("fr-FR", {
  month: "short", timeZone: "UTC",
});

const parseCatalogDate = (value: string | null) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value.slice(0, 10))) return null;
  const isoDate = value.slice(0, 10);
  const parsed = new Date(`${isoDate}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== isoDate ? null : parsed;
};

export const formatCatalogDate = (date: string | null) => {
  const parsed = parseCatalogDate(date);
  return parsed ? dateFormatter.format(parsed) : "Date à confirmer";
};

const getSharedValue = (races: PublicRace[], select: (race: PublicRace) => string | null) => {
  const selectedValues = races.map(select);
  if (selectedValues.some((value) => !value)) return null;
  const values = Array.from(new Set(selectedValues.filter((value): value is string => Boolean(value))));
  return values.length === 1 ? values[0] : null;
};

export const getEventDateLabel = (races: PublicRace[]) => {
  const dates = Array.from(
    new Map(races.map((race) => parseCatalogDate(race.date)).filter((date): date is Date => date !== null).map((date) => [date.toISOString().slice(0, 10), date])).values(),
  ).sort((left, right) => left.getTime() - right.getTime());
  if (!dates.length) return "Date à confirmer";
  if (dates.length === 1) return races.every((race) => parseCatalogDate(race.date)) ? dateFormatter.format(dates[0]) : "Dates selon le format";

  const first = dates[0];
  const last = dates.at(-1) ?? first;
  const firstMonth = shortMonthFormatter.format(first);
  const lastMonth = shortMonthFormatter.format(last);
  const sameYear = first.getUTCFullYear() === last.getUTCFullYear();
  const sameMonth = sameYear && first.getUTCMonth() === last.getUTCMonth();
  if (sameMonth) return `${first.getUTCDate()}–${last.getUTCDate()} ${lastMonth} ${last.getUTCFullYear()}`;
  if (sameYear) return `${first.getUTCDate()} ${firstMonth} – ${last.getUTCDate()} ${lastMonth} ${last.getUTCFullYear()}`;
  return `${first.getUTCDate()} ${firstMonth} ${first.getUTCFullYear()} – ${last.getUTCDate()} ${lastMonth} ${last.getUTCFullYear()}`;
};

export const getEventLocationLabel = (races: PublicRace[]) => {
  const sharedLocation = getSharedValue(races, (race) => race.location);
  if (sharedLocation) return sharedLocation;
  const sharedCity = getSharedValue(races, (race) => race.locationCity);
  if (sharedCity) return sharedCity;
  const distinctLocations = new Set(races.map((race) => race.location?.trim()).filter((value): value is string => Boolean(value)));
  if (!distinctLocations.size) return "Lieu à confirmer";
  return `${distinctLocations.size} lieu${distinctLocations.size > 1 ? "x" : ""} de départ`;
};

const normalizeLabel = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * Display-only format label inside its event context: drops a leading copy of
 * the event name (« SaintéLyon — SaintéTic » → « SaintéTic »). The full name is
 * kept when nothing meaningful would remain.
 */
export const getFormatLabelWithinEvent = (name: string, eventName: string | null | undefined) => {
  if (!eventName) return name;
  const normalizedName = normalizeLabel(name);
  const normalizedEvent = normalizeLabel(eventName.trim());
  if (!normalizedEvent || !normalizedName.startsWith(normalizedEvent)) return name;
  const remainder = name.slice(eventName.trim().length).replace(/^[\s\-–—:|·,]+/, "").trim();
  return remainder.length >= 2 ? remainder : name;
};

/**
 * Sibling-format chip label: the format name within its event, followed by the
 * distance unless the name already carries it. A distance alone is ambiguous when
 * an edition has several formats of the same length (solo / relais / marche).
 */
export const getSiblingFormatLabel = (format: Pick<PublicRace, "name" | "eventName" | "distanceKm">) => {
  const label = getFormatLabelWithinEvent(format.name, format.eventName);
  if (format.distanceKm === null) return label;
  const distance = `${format.distanceKm.toLocaleString("fr-FR")} km`;
  const compact = (value: string) => normalizeLabel(value).replace(/s+/g, "");
  return compact(label).includes(compact(distance)) ? label : `${label} · ${distance}`;
};

/**
 * D− shown in the course hero. Catalogue imports store 0 when the source has no
 * descent figure, so a stored 0 is only trusted when the GPX confirms it; the GPX
 * descent replaces a missing or placeholder value. Null hides the metric.
 */
export const getDisplayedElevationLossM = (race: Pick<PublicRaceDetail, "elevationLossM" | "routePreview">) => {
  if (race.elevationLossM !== null && race.elevationLossM > 0) return race.elevationLossM;
  const gpxLossM = race.routePreview?.stats.lossM;
  return typeof gpxLossM === "number" && Number.isFinite(gpxLossM) ? gpxLossM : null;
};

export type AidStationTimelineEntry =
  | { kind: "start"; station: PublicRaceAidStationSummary | null }
  | { kind: "finish"; distanceKm: number | null; station: PublicRaceAidStationSummary | null }
  | { kind: "station"; station: PublicRaceAidStationSummary };

const START_NAMES = new Set(["depart", "start"]);
const FINISH_NAMES = new Set(["arrivee", "finish", "arrival"]);
const ENDPOINT_TOLERANCE_KM = 0.1;

/**
 * Start, aid stations, finish. An organizer row that already is the start or the
 * finish (same name, or same kilometre) is merged into that endpoint instead of
 * being listed twice (« Arrivée — 15 km » once, with the station services).
 */
export const buildAidStationTimelineEntries = (
  aidStations: PublicRaceAidStationSummary[],
  totalDistanceKm: number | null,
): AidStationTimelineEntry[] => {
  const stations = [...aidStations];
  const nameOf = (station: PublicRaceAidStationSummary) => normalizeLabel(station.name).trim();
  const first = stations[0];
  const startStation = first && (START_NAMES.has(nameOf(first)) || first.distanceKm <= ENDPOINT_TOLERANCE_KM)
    ? stations.shift() ?? null
    : null;
  const last = stations.at(-1);
  const isFinishStation = Boolean(last && (
    FINISH_NAMES.has(nameOf(last))
    || (totalDistanceKm !== null && Math.abs(last.distanceKm - totalDistanceKm) <= ENDPOINT_TOLERANCE_KM)
  ));
  const finishStation = isFinishStation ? stations.pop() ?? null : null;
  return [
    { kind: "start", station: startStation },
    ...stations.map((station): AidStationTimelineEntry => ({ kind: "station", station })),
    { kind: "finish", distanceKm: totalDistanceKm ?? finishStation?.distanceKm ?? null, station: finishStation },
  ];
};
