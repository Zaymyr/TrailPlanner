import "server-only";

import { createHash } from "crypto";

import { parseGpx } from "./gpx/parseGpx";
import { normalizeImportedWaypoints } from "./gpx/normalizeImportedWaypoints";
import { getTraceDeTrailRaceData, type TraceDeTrailRaceData, TraceDeTrailImportError } from "./tracedetrail-race-import";
import { getUtmbRaceData, type UtmbRaceData, UtmbImportError } from "./utmb-race-import";

type WebsiteImportProvider = "utmb" | "tracedetrail" | "generic";

export type OrganizerWebsiteImportAidStation = {
  name: string;
  distanceKm: number;
  waterRefill: boolean;
};

export type OrganizerWebsiteImportRace = {
  key: string;
  name: string;
  seriesName: string;
  raceDate: string | null;
  locationText: string | null;
  distanceKm: number | null;
  elevationGainM: number | null;
  elevationLossM: number | null;
  externalSiteUrl: string | null;
  thumbnailUrl: string | null;
  aidStations: OrganizerWebsiteImportAidStation[];
  gpxContent: string | null;
  gpxStorageLabel: string | null;
  missingFields: string[];
  hasReliableGpx: boolean;
};

export type OrganizerWebsiteImportPreview = {
  source: {
    provider: WebsiteImportProvider;
    url: string;
    label: string;
  };
  event: {
    name: string | null;
    location: string | null;
    raceDate: string | null;
    officialWebsiteUrl: string | null;
    thumbnailUrl: string | null;
  };
  races: OrganizerWebsiteImportRace[];
  missingFields: string[];
  warnings: string[];
  canApply: boolean;
};

export class OrganizerWebsiteImportError extends Error {
  code: "INVALID_URL" | "FETCH_FAILED" | "INVALID_DATA" | "AUTH_REQUIRED" | "AUTH_FAILED";

  constructor(code: OrganizerWebsiteImportError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

type JsonLdRecord = Record<string, unknown>;

const UTMB_HOST_PATTERN = /(^|\.)utmb\.world$/i;
const TRACE_DE_TRAIL_HOST_PATTERN = /(^|\.)tracedetrail\.fr$/i;

const toNonEmptyString = (value: unknown) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const toFiniteNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeComparableName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

const normalizeDate = (value: unknown) => {
  const stringValue = toNonEmptyString(value);
  if (!stringValue) return null;

  const isoMatch = stringValue.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  const cleaned = stringValue.replace(/(\d+)(st|nd|rd|th)/gi, "$1");
  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

const pickFirst = <T,>(...values: Array<T | null | undefined>) => values.find((value) => value !== null && value !== undefined) ?? null;

const isRecord = (value: unknown): value is JsonLdRecord => typeof value === "object" && value !== null && !Array.isArray(value);

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCharCode(Number(digits)))
    .replace(/&#x([0-9a-f]+);/gi, (_, digits: string) => String.fromCharCode(Number.parseInt(digits, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");

const stripHtml = (value: string | null | undefined) => {
  if (!value) return "";
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).trim();
};

const extractMetaContent = (html: string, attribute: "property" | "name", key: string) =>
  toNonEmptyString(
    html.match(new RegExp(`<meta[^>]+${attribute}=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1] ?? null
  );

const extractTitle = (html: string) => toNonEmptyString(stripHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null));

const extractJsonLdRecords = (html: string): JsonLdRecord[] => {
  const matches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  const records: JsonLdRecord[] = [];

  for (const match of matches) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      const queue = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of queue) {
        if (!isRecord(item)) continue;
        records.push(item);
      }
    } catch {
      continue;
    }
  }

  return records;
};

const collectJsonLdEvents = (value: unknown, events: JsonLdRecord[] = []): JsonLdRecord[] => {
  if (Array.isArray(value)) {
    value.forEach((item) => collectJsonLdEvents(item, events));
    return events;
  }
  if (!isRecord(value)) return events;

  const typeValue = value["@type"];
  const types = Array.isArray(typeValue) ? typeValue : [typeValue];
  if (types.some((type) => typeof type === "string" && type.toLowerCase() === "event")) {
    events.push(value);
  }

  Object.values(value).forEach((child) => collectJsonLdEvents(child, events));
  return events;
};

const parseDistanceKm = (...values: Array<unknown>) => {
  for (const value of values) {
    const stringValue = toNonEmptyString(value);
    if (!stringValue) continue;
    const match = stringValue.match(/(\d{1,3}(?:[.,]\d+)?)\s*km/i);
    if (!match) continue;
    const parsed = toFiniteNumber(match[1]);
    if (parsed !== null && parsed > 0) return Number(parsed.toFixed(2));
  }
  return null;
};

const parseElevationMeters = (...values: Array<unknown>) => {
  for (const value of values) {
    const stringValue = toNonEmptyString(value);
    if (!stringValue) continue;
    const match = stringValue.match(/d\+\s*[:\-]?\s*(\d{2,5})/i) ?? stringValue.match(/elevation[^0-9]*(\d{2,5})/i);
    if (!match) continue;
    const parsed = toFiniteNumber(match[1]);
    if (parsed !== null && parsed >= 0) return Math.round(parsed);
  }
  return null;
};

const buildMissingFields = (race: Pick<OrganizerWebsiteImportRace, "name" | "raceDate" | "distanceKm" | "elevationGainM">) => {
  const missing: string[] = [];
  if (!race.name.trim()) missing.push("Nom format");
  if (!race.raceDate?.trim()) missing.push("Date format");
  if (race.distanceKm === null || race.distanceKm <= 0) missing.push("Distance");
  if (race.elevationGainM === null || race.elevationGainM < 0) missing.push("D+");
  return missing;
};

const buildPreviewHash = (preview: OrganizerWebsiteImportPreview) =>
  createHash("sha256")
    .update(
      JSON.stringify({
        source: preview.source,
        event: preview.event,
        races: preview.races.map((race) => ({
          key: race.key,
          name: race.name,
          seriesName: race.seriesName,
          raceDate: race.raceDate,
          locationText: race.locationText,
          distanceKm: race.distanceKm,
          elevationGainM: race.elevationGainM,
          elevationLossM: race.elevationLossM,
          externalSiteUrl: race.externalSiteUrl,
          thumbnailUrl: race.thumbnailUrl,
          aidStations: race.aidStations,
          hasReliableGpx: race.hasReliableGpx,
          missingFields: race.missingFields,
        })),
      })
    )
    .digest("hex");

export const computeOrganizerWebsiteImportPreviewHash = buildPreviewHash;

const mapUtmbPreview = (url: string, utmbRace: UtmbRaceData): OrganizerWebsiteImportPreview => {
  const race: OrganizerWebsiteImportRace = {
    key: `race:${normalizeComparableName(utmbRace.courseName)}`,
    name: utmbRace.courseName,
    seriesName: utmbRace.courseName,
    raceDate: utmbRace.date,
    locationText: utmbRace.location,
    distanceKm: utmbRace.distanceKm,
    elevationGainM: utmbRace.elevationGainM,
    elevationLossM: utmbRace.elevationLossM,
    externalSiteUrl: utmbRace.normalizedUrl,
    thumbnailUrl: null,
    aidStations: utmbRace.aidStations,
    gpxContent: null,
    gpxStorageLabel: "utmb",
    hasReliableGpx: true,
    missingFields: [],
  };
  race.missingFields = buildMissingFields(race);

  return {
    source: { provider: "utmb", url, label: "UTMB" },
    event: {
      name: utmbRace.eventName,
      location: utmbRace.location,
      raceDate: utmbRace.date,
      officialWebsiteUrl: utmbRace.normalizedUrl,
      thumbnailUrl: null,
    },
    races: [race],
    missingFields: [],
    warnings: [],
    canApply: true,
  };
};

const mapTraceDeTrailPreview = (url: string, traceRace: TraceDeTrailRaceData): OrganizerWebsiteImportPreview => {
  const race: OrganizerWebsiteImportRace = {
    key: `race:${normalizeComparableName(traceRace.courseName)}`,
    name: traceRace.courseName,
    seriesName: traceRace.courseName,
    raceDate: traceRace.date,
    locationText: traceRace.location,
    distanceKm: traceRace.distanceKm,
    elevationGainM: traceRace.elevationGainM,
    elevationLossM: traceRace.elevationLossM,
    externalSiteUrl: traceRace.officialSiteUrl ?? traceRace.normalizedUrl,
    thumbnailUrl: traceRace.thumbnailUrl,
    aidStations: traceRace.aidStations,
    gpxContent: traceRace.gpxContent,
    gpxStorageLabel: "tracedetrail",
    hasReliableGpx: true,
    missingFields: [],
  };
  race.missingFields = buildMissingFields(race);

  return {
    source: { provider: "tracedetrail", url, label: "Trace de Trail" },
    event: {
      name: traceRace.eventName,
      location: traceRace.location,
      raceDate: traceRace.date,
      officialWebsiteUrl: traceRace.officialSiteUrl ?? traceRace.normalizedUrl,
      thumbnailUrl: traceRace.thumbnailUrl,
    },
    races: [race],
    missingFields: [],
    warnings: [],
    canApply: true,
  };
};

const absoluteUrl = (baseUrl: string, maybeRelative: string | null | undefined) => {
  const raw = toNonEmptyString(maybeRelative);
  if (!raw) return null;
  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return null;
  }
};

const findSingleGpxUrl = (html: string, baseUrl: string) => {
  const matches = Array.from(html.matchAll(/href=["']([^"']+\.gpx(?:\?[^"']*)?)["']/gi))
    .map((match) => absoluteUrl(baseUrl, match[1]))
    .filter((value): value is string => Boolean(value));
  const unique = Array.from(new Set(matches));
  return unique.length === 1 ? unique[0] : null;
};

const extractLocationFromEvent = (event: JsonLdRecord) => {
  const location = event.location;
  if (typeof location === "string") return toNonEmptyString(location);
  if (!isRecord(location)) return null;
  return pickFirst(
    toNonEmptyString(location.name),
    toNonEmptyString((location.address as JsonLdRecord | undefined)?.addressLocality),
    toNonEmptyString((location.address as JsonLdRecord | undefined)?.streetAddress)
  );
};

const buildGenericRaceFromEvent = (event: JsonLdRecord, index: number, eventSiteUrl: string | null, eventImage: string | null): OrganizerWebsiteImportRace => {
  const description = stripHtml(toNonEmptyString(event.description));
  const name = toNonEmptyString(event.name) ?? `Format ${index + 1}`;
  const externalSiteUrl = pickFirst(absoluteUrl(eventSiteUrl ?? "", toNonEmptyString(event.url)), eventSiteUrl);
  const race: OrganizerWebsiteImportRace = {
    key: `race:${index}:${normalizeComparableName(name)}`,
    name,
    seriesName: name,
    raceDate: normalizeDate(event.startDate),
    locationText: extractLocationFromEvent(event),
    distanceKm: parseDistanceKm(event.name, description),
    elevationGainM: parseElevationMeters(event.name, description),
    elevationLossM: null,
    externalSiteUrl,
    thumbnailUrl: eventImage,
    aidStations: [],
    gpxContent: null,
    gpxStorageLabel: null,
    hasReliableGpx: false,
    missingFields: [],
  };
  race.missingFields = buildMissingFields(race);
  return race;
};

const fetchGenericGpx = async (gpxUrl: string) => {
  const response = await fetch(gpxUrl, {
    cache: "no-store",
    headers: {
      "user-agent": "Pace Yourself Organizer Importer",
      accept: "application/gpx+xml,text/xml,application/xml",
    },
  }).catch(() => null);
  if (!response?.ok) return null;

  const gpxContent = await response.text();
  const parsed = parseGpx(gpxContent);
  return {
    gpxContent,
    stats: parsed.stats,
    aidStations:
      parsed.pointSource !== "waypoint" && parsed.waypoints.length > 0
        ? normalizeImportedWaypoints(parsed.points, parsed.waypoints).aidStations.map((station) => ({
            name: station.name,
            distanceKm: Number(station.distanceKm.toFixed(1)),
            waterRefill: true,
          }))
        : [],
  };
};

const buildGenericPreview = async (url: string): Promise<OrganizerWebsiteImportPreview> => {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new OrganizerWebsiteImportError("INVALID_URL", "URL invalide.");
  }

  const response = await fetch(parsedUrl.toString(), {
    cache: "no-store",
    headers: {
      "user-agent": "Pace Yourself Organizer Importer",
      accept: "text/html,application/xhtml+xml",
    },
  }).catch(() => null);

  if (!response?.ok) {
    throw new OrganizerWebsiteImportError("FETCH_FAILED", "Impossible de recuperer le site de la course.");
  }

  const html = await response.text();
  const title = extractTitle(html);
  const ogTitle = extractMetaContent(html, "property", "og:title");
  const ogImage = extractMetaContent(html, "property", "og:image");
  const ogSiteName = extractMetaContent(html, "property", "og:site_name");
  const jsonLdRecords = extractJsonLdRecords(html);
  const jsonLdEvents = jsonLdRecords.flatMap((record) => collectJsonLdEvents(record));
  const normalizedUrl = parsedUrl.toString();

  const eventName =
    pickFirst(
      toNonEmptyString(jsonLdEvents[0]?.superEvent && isRecord(jsonLdEvents[0].superEvent) ? jsonLdEvents[0].superEvent.name : null),
      toNonEmptyString(jsonLdEvents[0]?.name),
      ogSiteName,
      ogTitle,
      title
    ) ?? "Course";

  const eventLocation =
    pickFirst(
      extractLocationFromEvent(jsonLdEvents[0] ?? {}),
      toNonEmptyString(stripHtml(html.match(/(lieu|location|ville)[^<:]{0,20}[:\-]\s*([^<\n]+)/i)?.[2] ?? null))
    ) ?? null;

  const eventDate = pickFirst(normalizeDate(jsonLdEvents[0]?.startDate), normalizeDate(html.match(/(\d{4}-\d{2}-\d{2})/)?.[1])) ?? null;
  const eventSiteUrl = pickFirst(absoluteUrl(normalizedUrl, toNonEmptyString(jsonLdEvents[0]?.url)), normalizedUrl);
  const races = (jsonLdEvents.length > 0 ? jsonLdEvents : [{ name: ogTitle ?? title ?? eventName, startDate: eventDate }]).map((event, index) =>
    buildGenericRaceFromEvent(event, index, eventSiteUrl, ogImage)
  );

  if (races.length === 1) {
    const gpxUrl = findSingleGpxUrl(html, normalizedUrl);
    if (gpxUrl) {
      try {
        const gpx = await fetchGenericGpx(gpxUrl);
        if (gpx) {
          races[0] = {
            ...races[0],
            distanceKm: races[0].distanceKm ?? Number(gpx.stats.distanceKm.toFixed(2)),
            elevationGainM: races[0].elevationGainM ?? Math.round(gpx.stats.gainM),
            elevationLossM: races[0].elevationLossM ?? Math.round(gpx.stats.lossM),
            aidStations: gpx.aidStations,
            gpxContent: gpx.gpxContent,
            gpxStorageLabel: "generic",
            hasReliableGpx: true,
          };
          races[0].missingFields = buildMissingFields(races[0]);
        }
      } catch {
        // Keep the generic preview usable even if the GPX link is broken.
      }
    }
  }

  const preview: OrganizerWebsiteImportPreview = {
    source: { provider: "generic", url: normalizedUrl, label: "Site detecte" },
    event: {
      name: eventName,
      location: eventLocation,
      raceDate: eventDate,
      officialWebsiteUrl: eventSiteUrl,
      thumbnailUrl: ogImage,
    },
    races,
    missingFields: [
      ...(eventName ? [] : ["Nom evenement"]),
      ...(eventLocation ? [] : ["Lieu evenement"]),
      ...(eventDate ? [] : ["Date evenement"]),
    ],
    warnings: [],
    canApply: races.length > 0,
  };

  if (jsonLdEvents.length === 0) {
    preview.warnings.push("Aucun schema Event detecte. Les donnees proviennent d'heuristiques HTML.");
  }
  if (races.some((race) => race.missingFields.length > 0)) {
    preview.warnings.push("Certains formats detectes sont incomplets et peuvent necessiter une reprise manuelle.");
  }

  return preview;
};

export async function buildOrganizerWebsiteImportPreview(
  url: string,
  options?: { traceCredentials?: { login: string; password: string } | null }
): Promise<OrganizerWebsiteImportPreview> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url.trim());
  } catch {
    throw new OrganizerWebsiteImportError("INVALID_URL", "URL invalide.");
  }

  try {
    if (UTMB_HOST_PATTERN.test(parsedUrl.hostname)) {
      const preview = mapUtmbPreview(parsedUrl.toString(), await getUtmbRaceData(parsedUrl.toString()));
      return preview;
    }
    if (TRACE_DE_TRAIL_HOST_PATTERN.test(parsedUrl.hostname)) {
      const preview = mapTraceDeTrailPreview(
        parsedUrl.toString(),
        await getTraceDeTrailRaceData(parsedUrl.toString(), { credentials: options?.traceCredentials ?? null })
      );
      return preview;
    }
    return await buildGenericPreview(parsedUrl.toString());
  } catch (error) {
    if (error instanceof UtmbImportError || error instanceof TraceDeTrailImportError) {
      throw new OrganizerWebsiteImportError(error.code, error.message);
    }
    if (error instanceof OrganizerWebsiteImportError) throw error;
    throw new OrganizerWebsiteImportError("INVALID_DATA", "Impossible d'analyser le site de la course.");
  }
}
