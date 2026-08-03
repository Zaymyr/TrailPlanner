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

export type OrganizerWebsiteImportConfidence = "high" | "medium" | "low";

export type OrganizerWebsiteImportFinding = {
  key: string;
  label: string;
  value: string | null;
  required: boolean;
  confidence: OrganizerWebsiteImportConfidence | null;
  sourceUrl: string | null;
  sourceLabel: string | null;
};

export type OrganizerWebsiteImportAssessment = {
  score: number;
  coverageScore: number;
  reliabilityScore: number;
  foundCount: number;
  totalCount: number;
  reliableCount: number;
  findings: OrganizerWebsiteImportFinding[];
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
  assessment?: OrganizerWebsiteImportAssessment;
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
    logistics: {
      mandatoryEquipment: string[];
      shuttles: string | null;
      startAddress: string | null;
      officialParkings: string | null;
    };
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
type GenericPageCandidate = {
  url: string;
  html: string;
  text: string;
  title: string | null;
  ogTitle: string | null;
  ogImage: string | null;
  ogSiteName: string | null;
  jsonLdRecords: JsonLdRecord[];
  jsonLdEvents: JsonLdRecord[];
  dates: string[];
};

type GenericRaceCandidate = OrganizerWebsiteImportRace & {
  sourceUrl: string;
  sourceLabel: string;
  detectedYear: string | null;
  gpxUrl: string | null;
  score: number;
};

const UTMB_HOST_PATTERN = /(^|\.)utmb\.world$/i;
const TRACE_DE_TRAIL_HOST_PATTERN = /(^|\.)tracedetrail\.fr$/i;
const FRENCH_MONTHS: Record<string, number> = {
  janvier: 0,
  fevrier: 1,
  mars: 2,
  avril: 3,
  mai: 4,
  juin: 5,
  juillet: 6,
  aout: 7,
  septembre: 8,
  octobre: 9,
  novembre: 10,
  decembre: 11,
};
const GENERIC_PAGE_HINT_PATTERN =
  /(parcours|course|courses|formats|epreuves|programme|reglement|r[eè]glement|trace|gpx|ravitaillement|horaires?|roadbook|infos? (?:pratiques|utiles)|inscriptions?)/i;
const GENERIC_PAGE_LIMIT = 7;
const GENERIC_FETCH_TIMEOUT_MS = 8_000;
const GENERIC_HTML_LIMIT = 1_500_000;

const fetchGenericResource = async (url: string, init: RequestInit) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GENERIC_FETCH_TIMEOUT_MS);
  timeout.unref?.();
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

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

  const normalized = normalizeComparableName(stringValue).replace(/\b1er\b/g, "1");
  const frenchMatch = normalized.match(/\b(\d{1,2})\s+([a-z]+)\s+(\d{4})\b/);
  if (frenchMatch) {
    const monthIndex = FRENCH_MONTHS[frenchMatch[2]];
    if (monthIndex !== undefined) {
      const parsed = new Date(Date.UTC(Number(frenchMatch[3]), monthIndex, Number(frenchMatch[1])));
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    }
  }

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

const toPlainText = (html: string) =>
  decodeHtmlEntities(
    html
      .replace(/<(br|\/p|\/div|\/li|\/section|\/article|\/h\d)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{2,}/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
  ).trim();

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

const extractPageDates = (value: string) => {
  const dates = new Set<string>();
  const normalized = decodeHtmlEntities(value).replace(/\s+/g, " ");

  for (const match of normalized.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)) {
    const parsed = normalizeDate(match[1]);
    if (parsed) dates.add(parsed);
  }

  for (const match of normalized.matchAll(/\b(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\s+(\d{4})\b/g)) {
    const parsed = normalizeDate(match[0]);
    if (parsed) dates.add(parsed);
  }

  return Array.from(dates).sort();
};

const scoreEventDateContext = (context: string) => {
  const normalized = normalizeComparableName(context);
  let score = 0;
  if (/(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/.test(normalized)) score += 3;
  if (/(edition|epreuve|course|trail|rando|depart|accueillir|revient|organise)/.test(normalized)) score += 5;
  if (/(inscription|tarif|avant le|apres le|dossier|certificat|pps|resultat|archive)/.test(normalized)) score -= 7;
  return score;
};

const extractScoredPageDates = (page: GenericPageCandidate, pageIndex: number) =>
  Array.from(page.text.matchAll(/\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\s+[A-Za-zÀ-ÿ]+\s+\d{4})\b/g)).flatMap((match) => {
    const date = normalizeDate(match[0]);
    if (!date) return [];
    const start = Math.max(0, (match.index ?? 0) - 140);
    const end = Math.min(page.text.length, (match.index ?? 0) + match[0].length + 140);
    return [{ date, score: scoreEventDateContext(page.text.slice(start, end)) + (pageIndex === 0 ? 2 : 0) }];
  });

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
    const match =
      stringValue.match(/d\+\s*[:\-]?\s*(\d{2,5})/i) ??
      stringValue.match(/(\d{2,5})\s*(?:m\s*)?d\+/i) ??
      stringValue.match(/elevation[^0-9]*(\d{2,5})/i);
    if (!match) continue;
    const parsed = toFiniteNumber(match[1]);
    if (parsed !== null && parsed >= 0) return Math.round(parsed);
  }
  return null;
};

const parseAidStationsFromText = (value: string) => {
  const line = normalizeComparableName(value);
  if (!/(ravit|ravito)/.test(line)) return [];
  const relevantSlice = line.slice(Math.max(0, line.search(/ravit|ravito/)));

  const distances = new Set<number>();
  for (const match of relevantSlice.matchAll(/km\s*(\d{1,3}(?:[.,]\d+)?)/gi)) {
    const parsed = toFiniteNumber(match[1]);
    if (parsed !== null && parsed > 0) distances.add(Number(parsed.toFixed(1)));
  }
  for (const match of relevantSlice.matchAll(/(\d{1,3}(?:[.,]\d+)?)\s*km/gi)) {
    const parsed = toFiniteNumber(match[1]);
    if (parsed !== null && parsed > 0) distances.add(Number(parsed.toFixed(1)));
  }
  for (const match of relevantSlice.matchAll(/(\d{1,3}(?:[.,]\d+)?)\s*(?:e|eme|ème)?\s*kilomet/gi)) {
    const parsed = toFiniteNumber(match[1]);
    if (parsed !== null && parsed > 0) distances.add(Number(parsed.toFixed(1)));
  }
  for (const match of relevantSlice.matchAll(/\bau\s+(\d{1,3})\s*(?:e|eme|ème)?\s*(?:&|et|,)\s*(\d{1,3})\s*(?:e|eme|ème)?\s*kilomet/gi)) {
    for (const rawDistance of [match[1], match[2]]) {
      const parsed = toFiniteNumber(rawDistance);
      if (parsed !== null && parsed > 0) distances.add(Number(parsed.toFixed(1)));
    }
  }

  return Array.from(distances)
    .sort((left, right) => left - right)
    .map((distanceKm, index) => ({
      name: `Ravitaillement ${index + 1}`,
      distanceKm,
      waterRefill: true,
    }));
};

const buildMissingFields = (race: Pick<OrganizerWebsiteImportRace, "name" | "raceDate" | "distanceKm" | "elevationGainM">) => {
  const missing: string[] = [];
  if (!race.name.trim()) missing.push("Nom format");
  if (!race.raceDate?.trim()) missing.push("Date format");
  if (race.distanceKm === null || race.distanceKm <= 0) missing.push("Distance");
  if (race.elevationGainM === null || race.elevationGainM < 0) missing.push("D+");
  return missing;
};

const confidenceValue: Record<OrganizerWebsiteImportConfidence, number> = {
  high: 100,
  medium: 65,
  low: 35,
};

const buildRaceAssessment = (
  race: OrganizerWebsiteImportRace,
  source: {
    url: string | null;
    label: string;
    confidence: OrganizerWebsiteImportConfidence;
    gpxUrl?: string | null;
  }
): OrganizerWebsiteImportAssessment => {
  const definitions = [
    { key: "name", label: "Nom du format", value: race.name || null, required: true, weight: 2 },
    { key: "raceDate", label: "Date", value: race.raceDate, required: true, weight: 2 },
    {
      key: "distanceKm",
      label: "Distance",
      value: race.distanceKm === null ? null : `${race.distanceKm} km`,
      required: true,
      weight: 2,
    },
    {
      key: "elevationGainM",
      label: "Dénivelé positif",
      value: race.elevationGainM === null ? null : `${race.elevationGainM} m`,
      required: true,
      weight: 2,
    },
    {
      key: "elevationLossM",
      label: "Dénivelé négatif",
      value: race.elevationLossM === null ? null : `${race.elevationLossM} m`,
      required: false,
      weight: 1,
    },
    { key: "locationText", label: "Lieu", value: race.locationText, required: false, weight: 1 },
    { key: "externalSiteUrl", label: "Page du format", value: race.externalSiteUrl, required: false, weight: 1 },
    { key: "gpx", label: "Trace GPX", value: race.gpxContent ? "GPX exploitable" : null, required: false, weight: 1 },
    {
      key: "aidStations",
      label: "Ravitaillements",
      value:
        race.aidStations.length > 0
          ? `${race.aidStations.length} détecté(s) : ${race.aidStations
              .map((station) => `${station.name} (${station.distanceKm} km)`)
              .join(", ")}`
          : null,
      required: false,
      weight: 1,
    },
    { key: "thumbnailUrl", label: "Image", value: race.thumbnailUrl, required: false, weight: 1 },
  ];

  const findings = definitions.map((definition): OrganizerWebsiteImportFinding & { weight: number } => {
    const found = Boolean(definition.value);
    const gpxBacked = race.hasReliableGpx && ["distanceKm", "elevationGainM", "elevationLossM", "gpx"].includes(definition.key);
    const confidence = found ? (gpxBacked ? "high" : source.confidence) : null;
    return {
      key: definition.key,
      label: definition.label,
      value: definition.value,
      required: definition.required,
      confidence,
      sourceUrl: found ? (gpxBacked ? source.gpxUrl ?? source.url : source.url) : null,
      sourceLabel: found ? (gpxBacked ? "Trace GPX" : source.label) : null,
      weight: definition.weight,
    };
  });

  const totalWeight = findings.reduce((sum, finding) => sum + finding.weight, 0);
  const found = findings.filter((finding) => finding.value !== null);
  const foundWeight = found.reduce((sum, finding) => sum + finding.weight, 0);
  const reliabilityWeight = found.reduce(
    (sum, finding) => sum + (finding.confidence ? confidenceValue[finding.confidence] * finding.weight : 0),
    0
  );
  const coverageScore = Math.round((foundWeight / totalWeight) * 100);
  const reliabilityScore = foundWeight > 0 ? Math.round(reliabilityWeight / foundWeight) : 0;

  return {
    score: Math.round(coverageScore * 0.65 + reliabilityScore * 0.35),
    coverageScore,
    reliabilityScore,
    foundCount: found.length,
    totalCount: findings.length,
    reliableCount: found.filter((finding) => finding.confidence === "high").length,
    findings: findings.map(({ weight: _weight, ...finding }) => finding),
  };
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
          assessment: race.assessment,
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
  race.assessment = buildRaceAssessment(race, {
    url: utmbRace.normalizedUrl,
    label: "UTMB",
    confidence: "high",
    gpxUrl: utmbRace.normalizedUrl,
  });

  return {
    source: { provider: "utmb", url, label: "UTMB" },
    event: {
      name: utmbRace.eventName,
      location: utmbRace.location,
      raceDate: utmbRace.date,
      officialWebsiteUrl: utmbRace.normalizedUrl,
      thumbnailUrl: null,
      logistics: { mandatoryEquipment: [], shuttles: null, startAddress: null, officialParkings: null },
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
  race.assessment = buildRaceAssessment(race, {
    url: traceRace.officialSiteUrl ?? traceRace.normalizedUrl,
    label: "Trace de Trail",
    confidence: "high",
    gpxUrl: traceRace.normalizedUrl,
  });

  return {
    source: { provider: "tracedetrail", url, label: "Trace de Trail" },
    event: {
      name: traceRace.eventName,
      location: traceRace.location,
      raceDate: traceRace.date,
      officialWebsiteUrl: traceRace.officialSiteUrl ?? traceRace.normalizedUrl,
      thumbnailUrl: traceRace.thumbnailUrl,
      logistics: { mandatoryEquipment: [], shuttles: null, startAddress: null, officialParkings: null },
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

const findGpxUrls = (html: string, baseUrl: string) => {
  const anchorMatches = Array.from(html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi))
    .filter((match) => /\.gpx(?:\?|$)/i.test(match[1]) || /\bgpx\b/i.test(stripHtml(match[2])))
    .map((match) => absoluteUrl(baseUrl, match[1]))
    .filter((value): value is string => Boolean(value));

  const traceDeTrailMatches = Array.from(
    html.matchAll(/<(?:a|iframe)\b[^>]*(?:href|src|data-src|data-litespeed-src)=["']([^"']+)["'][^>]*>/gi)
  )
    .map((match) => absoluteUrl(baseUrl, match[1]))
    .filter((value): value is string => {
      if (!value) return false;
      try {
        const parsed = new URL(value);
        return (
          TRACE_DE_TRAIL_HOST_PATTERN.test(parsed.hostname) &&
          /\/(?:fr|en)\/(?:iframe\/\d+|trace\/(?:trace\/)?\d+)\/?$/i.test(parsed.pathname)
        );
      } catch {
        return false;
      }
    });

  return Array.from(new Set([...anchorMatches, ...traceDeTrailMatches]));
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
  const rawName = toNonEmptyString(event.name) ?? `Format ${index + 1}`;
  const distanceKm = parseDistanceKm(event.name, description);
  const name = formatRaceDisplayName(rawName, distanceKm);
  const externalSiteUrl = pickFirst(absoluteUrl(eventSiteUrl ?? "", toNonEmptyString(event.url)), eventSiteUrl);
  const race: OrganizerWebsiteImportRace = {
    key: `race:${index}:${normalizeComparableName(name)}`,
    name,
    seriesName: name,
    raceDate: normalizeDate(event.startDate),
    locationText: extractLocationFromEvent(event),
    distanceKm,
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

const sanitizeRaceName = (value: string | null) => {
  const normalized = toNonEmptyString(stripHtml(value));
  if (!normalized) return null;
  const cleaned = normalized.replace(/\s+/g, " ").trim();
  if (!/[A-Za-zÀ-ÿ]/.test(cleaned)) return null;
  if (cleaned.length > 80) return null;
  if (/^(les parcours|les courses|parcours|courses?|reglement|r[eè]glement|infos? pratiques?|article\s+\d+.*)$/i.test(cleaned)) return null;
  return cleaned;
};

const formatRaceDisplayName = (value: string, distanceKm: number | null) => {
  const withoutPrefix = value.replace(/^(?:format|course|parcours|[eé]preuve)\s*[:\-–—|]\s*/i, "").trim();
  const withoutMetricSuffix = withoutPrefix
    .replace(
      /\s*(?:[-–—|·:]\s*)?(?:\d{1,3}(?:[.,]\d+)?\s*km|(?:\d{2,5}\s*m?\s*)?d\+|d\+\s*[:\-]?\s*\d{2,5}\s*m?)(?:\s*(?:[-–—|·:]\s*)?(?:\d{1,3}(?:[.,]\d+)?\s*km|(?:\d{2,5}\s*m?\s*)?d\+|d\+\s*[:\-]?\s*\d{2,5}\s*m?))*\s*$/i,
      ""
    )
    .trim();
  const genericName = /^(?:format|course|parcours|[eé]preuve|trail)(?:\s+(?:complet|partiel|long|court))?$/i.test(withoutMetricSuffix);

  if ((!withoutMetricSuffix || genericName) && distanceKm !== null) {
    return `${Number(distanceKm.toFixed(2))} km`;
  }

  return withoutMetricSuffix || value;
};

const scoreGenericRaceCandidate = (race: OrganizerWebsiteImportRace, sourceLabel: string) =>
  (race.distanceKm ? 3 : 0) +
  (race.elevationGainM !== null ? 2 : 0) +
  (race.raceDate ? 2 : 0) +
  (race.aidStations.length > 0 ? 2 : 0) +
  (race.gpxContent ? 3 : 0) +
  (race.hasReliableGpx ? 2 : 0) +
  (/h\d/i.test(sourceLabel) ? 1 : 0);

const buildGenericRaceCandidate = (input: {
  key: string;
  name: string;
  seriesName?: string | null;
  raceDate?: string | null;
  locationText?: string | null;
  distanceKm?: number | null;
  elevationGainM?: number | null;
  elevationLossM?: number | null;
  externalSiteUrl?: string | null;
  thumbnailUrl?: string | null;
  aidStations?: OrganizerWebsiteImportAidStation[];
  gpxContent?: string | null;
  gpxStorageLabel?: string | null;
  gpxUrl?: string | null;
  hasReliableGpx?: boolean;
  detectedYear?: string | null;
  sourceUrl: string;
  sourceLabel: string;
}): GenericRaceCandidate => {
  const race: OrganizerWebsiteImportRace = {
    key: input.key,
    name: input.name,
    seriesName: input.seriesName ?? input.name,
    raceDate: input.raceDate ?? null,
    locationText: input.locationText ?? null,
    distanceKm: input.distanceKm ?? null,
    elevationGainM: input.elevationGainM ?? null,
    elevationLossM: input.elevationLossM ?? null,
    externalSiteUrl: input.externalSiteUrl ?? null,
    thumbnailUrl: input.thumbnailUrl ?? null,
    aidStations: input.aidStations ?? [],
    gpxContent: input.gpxContent ?? null,
    gpxStorageLabel: input.gpxStorageLabel ?? null,
    hasReliableGpx: input.hasReliableGpx ?? false,
    missingFields: [],
  };
  race.missingFields = buildMissingFields(race);
  return {
    ...race,
    sourceUrl: input.sourceUrl,
    sourceLabel: input.sourceLabel,
    detectedYear: input.detectedYear ?? race.raceDate?.slice(0, 4) ?? null,
    gpxUrl: input.gpxUrl ?? null,
    score: scoreGenericRaceCandidate(race, input.sourceLabel),
  };
};

const resolveTraceDeTrailGpxUrl = async (sourceUrl: string) => {
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    return null;
  }

  if (!TRACE_DE_TRAIL_HOST_PATTERN.test(parsed.hostname)) return null;

  const traceMatch = parsed.pathname.match(/\/(?:fr|en)\/trace\/(?:trace\/)?(\d+)\/?$/i);
  if (traceMatch?.[1]) return `https://tracedetrail.fr/fr/trace/${traceMatch[1]}`;

  if (!/\/(?:fr|en)\/iframe\/\d+\/?$/i.test(parsed.pathname)) return null;
  const response = await fetchGenericResource(parsed.toString(), {
    cache: "no-store",
    headers: {
      "user-agent": "Pace Yourself Organizer Importer",
      accept: "text/html,application/xhtml+xml",
    },
  }).catch(() => null);
  if (!response?.ok) return null;

  const html = (await response.text()).slice(0, GENERIC_HTML_LIMIT);
  const linkedTraceId = html.match(/https?:\/\/tracedetrail\.fr\/(?:fr|en)\/trace\/(?:trace\/)?(\d+)/i)?.[1];
  const embeddedTraceId = html.match(/\btraceID\s*:\s*["']?(\d+)/i)?.[1];
  const traceId = linkedTraceId ?? embeddedTraceId;
  return traceId ? `https://tracedetrail.fr/fr/trace/${traceId}` : null;
};

const resolveGenericGpxSourceUrl = async (sourceUrl: string) => {
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    return null;
  }

  if (!TRACE_DE_TRAIL_HOST_PATTERN.test(parsed.hostname)) return parsed.toString();
  return resolveTraceDeTrailGpxUrl(parsed.toString());
};

const fetchGenericGpx = async (sourceUrl: string) => {
  const gpxUrl = await resolveGenericGpxSourceUrl(sourceUrl);
  if (!gpxUrl) return null;

  if (TRACE_DE_TRAIL_HOST_PATTERN.test(new URL(gpxUrl).hostname)) {
    const traceRace = await getTraceDeTrailRaceData(gpxUrl);
    return {
      gpxContent: traceRace.gpxContent,
      stats: {
        distanceKm: traceRace.distanceKm,
        gainM: traceRace.elevationGainM,
        lossM: traceRace.elevationLossM,
      },
      aidStations: traceRace.aidStations,
      sourceUrl: traceRace.normalizedUrl,
      storageLabel: "tracedetrail" as const,
    };
  }

  const response = await fetchGenericResource(gpxUrl, {
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
    sourceUrl: gpxUrl,
    storageLabel: "generic" as const,
  };
};

const fetchSingleGenericGpxSource = async (sourceUrls: string[]) => {
  const resolvedUrls = await Promise.all(sourceUrls.map((sourceUrl) => resolveGenericGpxSourceUrl(sourceUrl)));
  const uniqueUrls = Array.from(new Set(resolvedUrls.filter((value): value is string => Boolean(value))));
  if (uniqueUrls.length !== 1) return null;
  return fetchGenericGpx(uniqueUrls[0]).catch(() => null);
};

const fetchGenericHtmlPage = async (url: string): Promise<GenericPageCandidate> => {
  const response = await fetchGenericResource(url, {
    cache: "no-store",
    headers: {
      "user-agent": "Pace Yourself Organizer Importer",
      accept: "text/html,application/xhtml+xml",
    },
  }).catch(() => null);

  if (!response?.ok) {
    throw new OrganizerWebsiteImportError("FETCH_FAILED", "Impossible de recuperer le site de la course.");
  }

  const html = (await response.text()).slice(0, GENERIC_HTML_LIMIT);
  const jsonLdRecords = extractJsonLdRecords(html);

  return {
    url,
    html,
    text: toPlainText(html),
    title: extractTitle(html),
    ogTitle: extractMetaContent(html, "property", "og:title"),
    ogImage: extractMetaContent(html, "property", "og:image"),
    ogSiteName: extractMetaContent(html, "property", "og:site_name"),
    jsonLdRecords,
    jsonLdEvents: jsonLdRecords.flatMap((record) => collectJsonLdEvents(record)),
    dates: extractPageDates(html),
  };
};

const extractCandidatePageUrls = (html: string, baseUrl: string) => {
  const base = new URL(baseUrl);
  const scoredUrls = new Map<string, number>();

  for (const match of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = stripHtml(match[2]);
    const href = absoluteUrl(baseUrl, match[1]);
    if (!href) continue;
    const parsedHref = new URL(href);
    if (parsedHref.origin !== base.origin || !/^https?:$/.test(parsedHref.protocol)) continue;
    if (!GENERIC_PAGE_HINT_PATTERN.test(label) && !GENERIC_PAGE_HINT_PATTERN.test(parsedHref.pathname)) continue;

    parsedHref.hash = "";
    const normalizedHref = parsedHref.toString();
    const hint = normalizeComparableName(`${label} ${parsedHref.pathname}`);
    const score =
      (/reglement/.test(hint) ? 10 : 0) +
      (/(courses?|parcours|formats?|epreuves?)/.test(hint) ? 8 : 0) +
      (/(programme|horaires?|ravitaillement|roadbook)/.test(hint) ? 6 : 0) +
      (/infos? (?:pratiques|utiles)/.test(hint) ? 4 : 0) +
      (/inscriptions?/.test(hint) ? 1 : 0);
    scoredUrls.set(normalizedHref, Math.max(score, scoredUrls.get(normalizedHref) ?? 0));
  }

  return [
    baseUrl,
    ...Array.from(scoredUrls.entries())
      .filter(([href]) => href !== baseUrl)
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, GENERIC_PAGE_LIMIT - 1)
      .map(([href]) => href),
  ];
};

const pickBestEventDate = (pages: GenericPageCandidate[]) => {
  const scored = new Map<string, { score: number; occurrences: number }>();
  pages.forEach((page, pageIndex) => {
    extractScoredPageDates(page, pageIndex).forEach((candidate) => {
      const current = scored.get(candidate.date) ?? { score: 0, occurrences: 0 };
      scored.set(candidate.date, {
        score: current.score + candidate.score,
        occurrences: current.occurrences + 1,
      });
    });
  });
  if (scored.size === 0) return null;

  const latestYear = Math.max(...Array.from(scored.keys()).map((date) => Number(date.slice(0, 4))));
  return (
    Array.from(scored.entries())
      .map(([date, value]) => ({ date, score: value.score + value.occurrences * 2 + (Number(date.slice(0, 4)) === latestYear ? 4 : 0) }))
      .sort((left, right) => right.score - left.score || right.date.localeCompare(left.date))[0]?.date ?? null
  );
};

const parseRaceDistanceMentions = (value: string) => {
  const distances = new Set<number>();
  for (const match of value.matchAll(/(\d{1,3}(?:[.,]\d+)?)\s*km/gi)) {
    const parsed = toFiniteNumber(match[1]);
    if (parsed !== null && parsed > 0) distances.add(Number(parsed.toFixed(2)));
  }
  return Array.from(distances).sort((left, right) => left - right);
};

const parseAidStationsForRace = (value: string, raceName: string) => {
  const normalizedName = normalizeComparableName(raceName);
  const relevantLines = value
    .split("\n")
    .map((line) => normalizeComparableName(line))
    .filter((line) => /(ravit|ravito)/.test(line) && line.includes(normalizedName));

  for (const line of relevantLines) {
    const raceIndex = line.lastIndexOf(normalizedName);
    if (raceIndex < 0) continue;
    const afterRace = line.slice(raceIndex + normalizedName.length);
    const nextRaceClause = afterRace.search(/\bet\s+\d+\s+ravit/);
    const raceSlice = nextRaceClause >= 0 ? afterRace.slice(0, nextRaceClause) : afterRace;
    const stations = parseAidStationsFromText(`ravitaillement ${raceSlice}`);
    if (stations.length > 0) return stations;
  }

  return [];
};

const parseCourseCandidatesFromNamedProse = (
  page: GenericPageCandidate,
  eventDate: string | null,
  eventLocation: string | null,
  eventImage: string | null
) => {
  const races: GenericRaceCandidate[] = [];
  const namedDistancePattern =
    /[«“"]\s*([^»”"]{2,80})\s*[»”"]\s*(?:d['’]une\s+longueur\s+de|d['’]une\s+distance\s+de|[:\-–])?[^.;\n]{0,45}?(\d{1,3}(?:[.,]\d+)?)\s*km/gi;

  for (const match of page.text.matchAll(namedDistancePattern)) {
    const rawName = sanitizeRaceName(match[1]);
    const distanceKm = toFiniteNumber(match[2]);
    if (!rawName || distanceKm === null || distanceKm <= 0) continue;
    const name = formatRaceDisplayName(rawName, distanceKm);
    const start = Math.max(0, (match.index ?? 0) - 120);
    const end = Math.min(page.text.length, (match.index ?? 0) + match[0].length + 220);
    const context = page.text.slice(start, end);
    const explicitDate = normalizeDate(context);

    races.push(
      buildGenericRaceCandidate({
        key: `race:${normalizeComparableName(name)}`,
        name,
        seriesName: name,
        raceDate: explicitDate ?? eventDate,
        locationText: eventLocation,
        distanceKm: Number(distanceKm.toFixed(2)),
        elevationGainM: parseElevationMeters(context),
        externalSiteUrl: page.url,
        thumbnailUrl: eventImage,
        aidStations: parseAidStationsForRace(page.text, name),
        detectedYear: explicitDate?.slice(0, 4) ?? context.match(/\b(20\d{2})\b/)?.[1] ?? eventDate?.slice(0, 4) ?? null,
        sourceUrl: page.url,
        sourceLabel: "named-prose",
      })
    );
  }

  return races;
};

const parseCourseCandidatesFromLines = (
  page: GenericPageCandidate,
  eventDate: string | null,
  eventLocation: string | null,
  eventImage: string | null
) => {
  const lines = page.text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const races: GenericRaceCandidate[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const previousLine = index > 0 ? lines[index - 1] : "";
    const distances = parseRaceDistanceMentions(line);
    if (distances.length !== 1) continue;

    const normalizedLine = normalizeComparableName(line);
    if (/^(ravit|ravito|barriere|materiel|analyse|resultat|tarif|prix|\d+\s*-\s*\d+\s+ans)/.test(normalizedLine)) continue;
    const courseSignal = normalizeComparableName(`${previousLine} ${line}`);
    if (
      !/(d\+|denivele|longueur|parcours|trace|gpx|trail|course|rando|marche)/.test(courseSignal) &&
      !/^\d{1,3}(?:[.,]\d+)?\s*km.*(?:ravit|ravito)/.test(normalizedLine)
    ) {
      continue;
    }

    const context = lines.slice(Math.max(0, index - 1), Math.min(lines.length, index + 4)).join(" ");
    if (!/(d\+|ravit|depart|départ|trace|gpx|barriere|barrière)/i.test(context)) continue;

    const yearMatch = context.match(/\b(20\d{2})\b/);
    const explicitDate = normalizeDate(context);
    const explicitYear = explicitDate?.slice(0, 4) ?? yearMatch?.[1] ?? null;
    const raceDate = explicitDate ?? eventDate;

    for (const distanceKm of distances) {
      let namePrefix = sanitizeRaceName(line.replace(/\s*(\d{1,3}(?:[.,]\d+)?)\s*km.*$/i, "").trim());
      if (
        !namePrefix &&
        /^\d{1,3}(?:[.,]\d+)?\s*km/i.test(line) &&
        !/(edition|ravit|depart|départ|barriere|barrière|trace|gpx|\b20\d{2}\b)/i.test(previousLine)
      ) {
        namePrefix = sanitizeRaceName(previousLine);
      }
      const name = namePrefix ? formatRaceDisplayName(namePrefix, distanceKm) : `${distanceKm} km`;
      const key = namePrefix ? `race:${normalizeComparableName(name)}` : `race:distance:${distanceKm}`;
      races.push(
        buildGenericRaceCandidate({
          key,
          name,
          seriesName: name,
          raceDate,
          locationText: eventLocation,
          distanceKm,
          elevationGainM: parseElevationMeters(context),
          externalSiteUrl: page.url,
          thumbnailUrl: eventImage,
          aidStations: parseAidStationsFromText(context),
          detectedYear: explicitYear,
          sourceUrl: page.url,
          sourceLabel: `line:${index + 1}`,
        })
      );
    }
  }

  return races;
};

const parseCourseCandidatesFromHeadings = (
  page: GenericPageCandidate,
  eventDate: string | null,
  eventLocation: string | null,
  eventImage: string | null
) => {
  const matches = Array.from(page.html.matchAll(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi));
  const races: GenericRaceCandidate[] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const rawName = sanitizeRaceName(match[2]);
    if (!rawName) continue;

    const sectionStart = match.index ?? 0;
    const nextStart = matches[index + 1]?.index ?? page.html.length;
    const sectionHtml = page.html.slice(sectionStart, nextStart);
    const sectionText = toPlainText(sectionHtml);
    const distanceKm = parseDistanceKm(sectionText, rawName);
    if (distanceKm === null) continue;
    const name = formatRaceDisplayName(rawName, distanceKm);

    const gpxUrl = findGpxUrls(sectionHtml, page.url)[0] ?? null;

    races.push(
      buildGenericRaceCandidate({
        key: `race:${normalizeComparableName(name)}`,
        name,
        seriesName: name,
        raceDate: pickFirst(normalizeDate(sectionText), eventDate),
        locationText: eventLocation,
        distanceKm,
        elevationGainM: parseElevationMeters(sectionText),
        externalSiteUrl: page.url,
        thumbnailUrl: eventImage,
        aidStations: parseAidStationsFromText(sectionText),
        detectedYear: sectionText.match(/\b(20\d{2})\b/)?.[1] ?? eventDate?.slice(0, 4) ?? null,
        sourceUrl: page.url,
        sourceLabel: match[1],
        gpxUrl,
        gpxStorageLabel: gpxUrl ? "generic" : null,
        hasReliableGpx: false,
      })
    );
  }

  return races;
};

const normalizeRaceIdentityName = (value: string) =>
  normalizeComparableName(value)
    .replace(/\b\d{1,3}(?:[.,]\d+)?\s*km\b/g, " ")
    .replace(/\b\d{2,5}\s*(?:m\s*)?d\+\b/g, " ")
    .replace(/\bd\+\s*[:\-]?\s*\d{2,5}\s*m?\b/g, " ")
    .replace(/[&+|·:()\-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const raceCandidatesMatch = (left: GenericRaceCandidate, right: GenericRaceCandidate) => {
  if (left.key === right.key) return true;
  if (
    left.distanceKm !== null &&
    right.distanceKm !== null &&
    Math.abs(left.distanceKm - right.distanceKm) <= 0.2
  ) {
    return true;
  }
  const leftIdentity = normalizeRaceIdentityName(left.name);
  const rightIdentity = normalizeRaceIdentityName(right.name);
  if (!leftIdentity || !rightIdentity) return false;
  if (leftIdentity === rightIdentity) return true;

  const distancesMatch =
    left.distanceKm !== null && right.distanceKm !== null && Math.abs(left.distanceKm - right.distanceKm) <= 1;
  if (!distancesMatch || Math.min(leftIdentity.length, rightIdentity.length) < 5) return false;
  return leftIdentity.includes(rightIdentity) || rightIdentity.includes(leftIdentity);
};

const chooseMergedRaceName = (left: string, right: string) => {
  const noisePattern = /\b\d{1,3}(?:[.,]\d+)?\s*km\b|\b\d{2,5}\s*(?:m\s*)?d\+\b|\bd\+\s*[:\-]?\s*\d{2,5}/i;
  const leftHasNoise = noisePattern.test(left);
  const rightHasNoise = noisePattern.test(right);
  if (leftHasNoise !== rightHasNoise) return leftHasNoise ? right : left;
  return left.length <= right.length ? left : right;
};

const formatNameSourceRank = (sourceLabel: string) => {
  if (/^h1$/i.test(sourceLabel)) return 5;
  if (/^h2$/i.test(sourceLabel)) return 4;
  if (/^h[3-6]$/i.test(sourceLabel)) return 3;
  if (sourceLabel === "jsonld") return 2;
  if (sourceLabel === "named-prose") return 1;
  return 0;
};

const mergeAidStations = (
  left: OrganizerWebsiteImportAidStation[],
  right: OrganizerWebsiteImportAidStation[]
) => {
  const byDistance = new Map<number, OrganizerWebsiteImportAidStation>();
  for (const station of [...left, ...right]) {
    const key = Math.round(station.distanceKm * 10);
    const existing = byDistance.get(key);
    if (!existing || (/^Ravitaillement \d+$/i.test(existing.name) && !/^Ravitaillement \d+$/i.test(station.name))) {
      byDistance.set(key, station);
    }
  }
  return Array.from(byDistance.values()).sort((a, b) => a.distanceKm - b.distanceKm);
};

const genericSourceRank = (sourceLabel: string) => {
  if (sourceLabel === "jsonld" || sourceLabel === "named-prose" || /^h[1-6]$/i.test(sourceLabel)) return 3;
  if (sourceLabel.startsWith("line:")) return 1;
  return 2;
};

const mergeCandidateAidStations = (preferred: GenericRaceCandidate, fallback: GenericRaceCandidate) => {
  if (preferred.aidStations.length === 0) return fallback.aidStations;
  if (fallback.aidStations.length === 0) return preferred.aidStations;
  const preferredRank = genericSourceRank(preferred.sourceLabel);
  const fallbackRank = genericSourceRank(fallback.sourceLabel);
  if (preferredRank !== fallbackRank) {
    return preferredRank > fallbackRank ? preferred.aidStations : fallback.aidStations;
  }
  return mergeAidStations(preferred.aidStations, fallback.aidStations);
};

const mergeRaceCandidates = (candidates: GenericRaceCandidate[], preferredYear: string | null) => {
  const keptByKey = new Map<string, GenericRaceCandidate>();
  const warnings: string[] = [];
  const droppedYears = new Set<string>();
  const hasNamedCandidateAtDistance = (candidate: GenericRaceCandidate) =>
    candidate.distanceKm !== null &&
    candidates.some(
      (other) =>
        other !== candidate &&
        other.distanceKm === candidate.distanceKm &&
        normalizeComparableName(other.name) !== `${candidate.distanceKm} km`
    );

  const filteredCandidates =
    preferredYear && candidates.some((candidate) => candidate.detectedYear === preferredYear)
      ? candidates.filter((candidate) => {
          if (candidate.detectedYear && candidate.detectedYear !== preferredYear) {
            droppedYears.add(candidate.detectedYear);
            return false;
          }
          return normalizeComparableName(candidate.name) !== `${candidate.distanceKm} km` || !hasNamedCandidateAtDistance(candidate);
        })
      : candidates.filter(
          (candidate) => normalizeComparableName(candidate.name) !== `${candidate.distanceKm} km` || !hasNamedCandidateAtDistance(candidate)
        );

  for (const candidate of filteredCandidates) {
    const existingEntry = Array.from(keptByKey.entries()).find(([, existing]) => raceCandidatesMatch(existing, candidate));
    if (!existingEntry) {
      keptByKey.set(candidate.key, candidate);
      continue;
    }
    const [existingKey, existing] = existingEntry;

    const hasConflict =
      (existing.distanceKm !== null && candidate.distanceKm !== null && existing.distanceKm !== candidate.distanceKm) ||
      (existing.elevationGainM !== null &&
        candidate.elevationGainM !== null &&
        existing.elevationGainM !== candidate.elevationGainM);
    if (hasConflict) {
      warnings.push(`Des informations contradictoires ont ete detectees pour ${candidate.name}.`);
    }

    const preferred = candidate.score > existing.score ? candidate : existing;
    const fallback = preferred === candidate ? existing : candidate;
    const namePreferred =
      formatNameSourceRank(existing.sourceLabel) >= formatNameSourceRank(candidate.sourceLabel) ? existing : candidate;
    const nameFallback = namePreferred === existing ? candidate : existing;
    const mergedName =
      formatNameSourceRank(namePreferred.sourceLabel) > formatNameSourceRank(nameFallback.sourceLabel)
        ? namePreferred.name
        : chooseMergedRaceName(namePreferred.name, nameFallback.name);
    const mergedRace: GenericRaceCandidate = {
      ...preferred,
      name: mergedName,
      seriesName: mergedName,
      raceDate: preferred.raceDate ?? fallback.raceDate,
      locationText: preferred.locationText ?? fallback.locationText,
      distanceKm: preferred.distanceKm ?? fallback.distanceKm,
      elevationGainM: preferred.elevationGainM ?? fallback.elevationGainM,
      elevationLossM: preferred.elevationLossM ?? fallback.elevationLossM,
      externalSiteUrl: preferred.externalSiteUrl ?? fallback.externalSiteUrl,
      thumbnailUrl: preferred.thumbnailUrl ?? fallback.thumbnailUrl,
      aidStations: mergeCandidateAidStations(preferred, fallback),
      gpxContent: preferred.gpxContent ?? fallback.gpxContent,
      gpxStorageLabel: preferred.gpxStorageLabel ?? fallback.gpxStorageLabel,
      gpxUrl: preferred.gpxUrl ?? fallback.gpxUrl,
      hasReliableGpx: preferred.hasReliableGpx || fallback.hasReliableGpx,
      score: 0,
      missingFields: [],
    };
    mergedRace.missingFields = buildMissingFields(mergedRace);
    mergedRace.score = scoreGenericRaceCandidate(mergedRace, mergedRace.sourceLabel);
    keptByKey.set(existingKey, mergedRace);
  }

  if (preferredYear && droppedYears.size > 0) {
    warnings.push(
      `Certaines pages mentionnent d'autres editions (${Array.from(droppedYears).sort().join(", ")}). L'import a privilegie ${preferredYear}.`
    );
  }

  return {
    candidates: Array.from(keptByKey.values()).sort((left, right) => {
        const leftDistance = left.distanceKm ?? Number.POSITIVE_INFINITY;
        const rightDistance = right.distanceKm ?? Number.POSITIVE_INFINITY;
        if (leftDistance !== rightDistance) return leftDistance - rightDistance;
        return left.name.localeCompare(right.name);
      }),
    warnings,
  };
};

const hydrateGenericRaceGpx = async (candidates: GenericRaceCandidate[]) => {
  const gpxRequests = new Map<string, Promise<Awaited<ReturnType<typeof fetchGenericGpx>>>>();

  const hydrated = await Promise.all(
    candidates.map(async (candidate) => {
      if (!candidate.gpxUrl) return candidate;
      let request = gpxRequests.get(candidate.gpxUrl);
      if (!request) {
        request = fetchGenericGpx(candidate.gpxUrl).catch(() => null);
        gpxRequests.set(candidate.gpxUrl, request);
      }
      const gpx = await request;
      if (!gpx) return candidate;

      const race: GenericRaceCandidate = {
        ...candidate,
        distanceKm: candidate.distanceKm ?? Number(gpx.stats.distanceKm.toFixed(2)),
        elevationGainM: Math.round(gpx.stats.gainM),
        elevationLossM: Math.round(gpx.stats.lossM),
        aidStations: candidate.aidStations.length > 0 ? candidate.aidStations : gpx.aidStations,
        gpxContent: gpx.gpxContent,
        gpxStorageLabel: gpx.storageLabel,
        gpxUrl: gpx.sourceUrl,
        hasReliableGpx: true,
        missingFields: [],
      };
      race.missingFields = buildMissingFields(race);
      return race;
    })
  );

  return hydrated.map(({ sourceLabel, sourceUrl, detectedYear: _detectedYear, gpxUrl, score: _score, ...race }) => {
    const confidence: OrganizerWebsiteImportConfidence =
      sourceLabel === "jsonld" || sourceLabel === "named-prose" || /^h[1-6]$/i.test(sourceLabel)
        ? "high"
        : sourceLabel.startsWith("line:")
          ? "low"
          : "medium";
    const sourceLabelText =
      sourceLabel === "jsonld"
        ? "Données structurées"
        : sourceLabel === "named-prose"
          ? "Règlement ou page pratique"
          : /^h[1-6]$/i.test(sourceLabel)
            ? "Page dédiée au format"
            : sourceLabel.startsWith("line:")
              ? "Mention dans la page"
              : "Page du site";

    race.assessment = buildRaceAssessment(race, {
      url: sourceUrl,
      label: sourceLabelText,
      confidence,
      gpxUrl,
    });
    return race;
  });
};

const extractGenericEventName = (pages: GenericPageCandidate[], fallback: string) => {
  for (const page of pages) {
    const regulationName = sanitizeRaceName(page.text.match(/r[eè]glement\s+20\d{2}\s*:\s*([^\n]{3,100})/i)?.[1] ?? null);
    if (regulationName) return regulationName;
  }
  return fallback;
};

const extractGenericLocation = (pages: GenericPageCandidate[], jsonLdEvents: JsonLdRecord[]) => {
  const eventLocation = jsonLdEvents.map((event) => extractLocationFromEvent(event)).find(Boolean);
  if (eventLocation) return eventLocation;

  for (const page of pages) {
    const addressTag = sanitizeRaceName(page.html.match(/<address[^>]*>([\s\S]*?)<\/address>/i)?.[1] ?? null);
    if (addressTag) return addressTag;

    const addressBlock = Array.from(page.html.matchAll(/<(p|div|li)[^>]*>([\s\S]*?)<\/\1>/gi))
      .map((match) => stripHtml(match[2]))
      .find((text) => text.length >= 10 && text.length <= 160 && /\b\d{5}\b/.test(text));
    if (addressBlock) return addressBlock;

    const lines = page.text.split("\n").map((line) => line.trim());
    const postalLine = lines.find((line) => line.length >= 10 && line.length <= 160 && /\b\d{5}\b/.test(line));
    if (postalLine) return postalLine;

    const startLocation = page.text.match(/(?:d[eé]parts? seront donn[eé]s?|d[eé]part et l['’]arriv[eé]e se situent)[^.\n]{0,120}?\b(?:au|à la|a la|de la|du)\s+([^.\n]{8,160})/i)?.[1];
    const cleaned = sanitizeRaceName(startLocation ?? null);
    if (cleaned) return cleaned;
  }

  return null;
};

const compactRelevantLines = (page: GenericPageCandidate, pattern: RegExp) =>
  Array.from(
    new Set(
      page.text
        .split("\n")
        .map((line) => line.trim().replace(/\s+/g, " "))
        .filter((line) => line.length > 3 && line.length <= 320 && pattern.test(line))
    )
  ).slice(0, 4);

const extractEventLogistics = (page: GenericPageCandidate) => {
  const equipmentLines = compactRelevantLines(page, /mat[eé]riel|[eé]quipement.*(?:obligatoire|requis)|obligatoire.*(?:emporter|pr[eé]voir)/i);
  const mandatoryEquipment = equipmentLines
    .flatMap((line) => line.split(/[:;,]/))
    .map((item) => item.replace(/^(?:mat[eé]riel|[eé]quipement)(?:\s+obligatoire)?\s*/i, "").trim())
    .filter((item) => item.length >= 3 && item.length <= 100)
    .slice(0, 12);
  const startAddress = compactRelevantLines(page, /(?:^|\b)d[eé]part\b|zone de d[eé]part|lieu de d[eé]part/i)[0] ?? null;
  const shuttles = compactRelevantLines(page, /navette|bus.*(?:course|d[eé]part)|transport.*(?:d[eé]part|coureur)/i).join("\n") || null;
  const officialParkings = compactRelevantLines(page, /parking|stationnement/i).join("\n") || null;

  return { mandatoryEquipment: Array.from(new Set(mandatoryEquipment)), shuttles, startAddress, officialParkings };
};

const normalizeFormatUrls = (formatUrls: string[]) =>
  Array.from(
    new Set(
      formatUrls.flatMap((value) => {
        try {
          return [new URL(value.trim()).toString()];
        } catch {
          return [];
        }
      })
    )
  );

const buildGenericPreview = async (url: string, formatUrls: string[] = []): Promise<OrganizerWebsiteImportPreview> => {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new OrganizerWebsiteImportError("INVALID_URL", "URL invalide.");
  }

  const normalizedUrl = parsedUrl.toString();
  const rootPage = await fetchGenericHtmlPage(normalizedUrl);
  const pages = [rootPage];
  const normalizedFormatUrls = normalizeFormatUrls(formatUrls).filter((formatUrl) => formatUrl !== normalizedUrl);
  const formatPages = await Promise.all(
    normalizedFormatUrls.map((formatUrl) => fetchGenericHtmlPage(formatUrl).catch(() => null))
  );
  const resolvedFormatPages = formatPages.filter((page): page is GenericPageCandidate => page !== null);

  const allJsonLdEvents = pages.flatMap((page) => page.jsonLdEvents);
  const title = rootPage.title;
  const ogTitle = rootPage.ogTitle;
  const ogImage = pages.map((page) => page.ogImage).find(Boolean) ?? null;
  const ogSiteName = rootPage.ogSiteName;

  const fallbackEventName =
    pickFirst(
      toNonEmptyString(allJsonLdEvents[0]?.superEvent && isRecord(allJsonLdEvents[0].superEvent) ? allJsonLdEvents[0].superEvent.name : null),
      toNonEmptyString(allJsonLdEvents[0]?.name),
      ogSiteName,
      ogTitle,
      title
    ) ?? "Course";
  const eventName = extractGenericEventName(pages, fallbackEventName);
  const eventLocation = extractGenericLocation(pages, allJsonLdEvents);

  const eventDate =
    pickFirst(normalizeDate(allJsonLdEvents[0]?.startDate), pickBestEventDate(pages), normalizeDate(rootPage.html.match(/(\d{4}-\d{2}-\d{2})/)?.[1])) ??
    null;
  const preferredYear = eventDate?.slice(0, 4) ?? null;
  const eventSiteUrl = pickFirst(absoluteUrl(normalizedUrl, toNonEmptyString(allJsonLdEvents[0]?.url)), normalizedUrl);

  const formatJsonLdEvents = resolvedFormatPages.flatMap((page) => page.jsonLdEvents);
  const jsonLdRaces = formatJsonLdEvents.map((event, index) => buildGenericRaceFromEvent(event, index, eventSiteUrl, ogImage));
  const genericCandidates = resolvedFormatPages.flatMap((page) => [
    ...parseCourseCandidatesFromHeadings(page, eventDate, eventLocation, ogImage),
    ...parseCourseCandidatesFromNamedProse(page, eventDate, eventLocation, ogImage),
    ...parseCourseCandidatesFromLines(page, eventDate, eventLocation, ogImage),
  ]);

  const merged = mergeRaceCandidates(
    [
      ...jsonLdRaces.map((race) =>
        buildGenericRaceCandidate({
          ...race,
          sourceUrl: eventSiteUrl ?? normalizedUrl,
          sourceLabel: "jsonld",
        })
      ),
      ...genericCandidates,
    ],
    preferredYear
  );

  let races =
    merged.candidates.length > 0 ? await hydrateGenericRaceGpx(merged.candidates) : [];

  if (races.length === 1) {
    const gpxUrls = Array.from(
      new Set([...resolvedFormatPages, ...pages].flatMap((page) => findGpxUrls(page.html, page.url)))
    );
    if (gpxUrls.length > 0) {
      try {
        const gpx = await fetchSingleGenericGpxSource(gpxUrls);
        if (gpx) {
          const hydratedRace: OrganizerWebsiteImportRace = {
            ...races[0],
            distanceKm: races[0].distanceKm ?? Number(gpx.stats.distanceKm.toFixed(2)),
            elevationGainM: Math.round(gpx.stats.gainM),
            elevationLossM: Math.round(gpx.stats.lossM),
            aidStations: gpx.aidStations,
            gpxContent: gpx.gpxContent,
            gpxStorageLabel: gpx.storageLabel,
            hasReliableGpx: true,
          };
          hydratedRace.missingFields = buildMissingFields(hydratedRace);
          hydratedRace.assessment = buildRaceAssessment(hydratedRace, {
            url: hydratedRace.externalSiteUrl ?? normalizedUrl,
            label: "Page du site",
            confidence: "medium",
            gpxUrl: gpx.sourceUrl,
          });
          races[0] = hydratedRace;
        }
      } catch {
        // Keep the generic preview usable even if the GPX link is broken.
      }
    }
  }

  races = races
    .map((race) => {
      if (race.assessment) return race;
      return {
        ...race,
        assessment: buildRaceAssessment(race, {
          url: race.externalSiteUrl ?? normalizedUrl,
          label: "Page du site",
          confidence: "medium",
        }),
      };
    })
    .sort((left, right) => {
      const scoreDifference = (right.assessment?.score ?? 0) - (left.assessment?.score ?? 0);
      if (scoreDifference !== 0) return scoreDifference;
      const coverageDifference = (right.assessment?.coverageScore ?? 0) - (left.assessment?.coverageScore ?? 0);
      if (coverageDifference !== 0) return coverageDifference;
      return 0;
    });

  const preview: OrganizerWebsiteImportPreview = {
    source: { provider: "generic", url: normalizedUrl, label: "Site detecte" },
    event: {
      name: eventName,
      location: eventLocation,
      raceDate: eventDate,
      officialWebsiteUrl: eventSiteUrl,
      thumbnailUrl: ogImage,
      logistics: extractEventLogistics(rootPage),
    },
    races,
    missingFields: [
      ...(eventName ? [] : ["Nom evenement"]),
      ...(eventLocation ? [] : ["Lieu evenement"]),
      ...(eventDate ? [] : ["Date evenement"]),
    ],
    warnings: [
      ...merged.warnings,
      ...(normalizedFormatUrls.length > resolvedFormatPages.length
        ? ["Certaines URLs de format n'ont pas pu etre analysees."]
        : []),
      ...(normalizedFormatUrls.length === 0
        ? ["Ajoute une URL par format pour analyser les parcours. La page generale est reservee aux informations evenement."]
        : []),
    ],
    canApply: races.length > 0,
  };

  if (allJsonLdEvents.length === 0) {
    preview.warnings.push("Aucun schema Event detecte. Les donnees proviennent d'heuristiques HTML.");
  }
  if (races.some((race) => race.missingFields.length > 0)) {
    preview.warnings.push("Certains formats detectes sont incomplets et peuvent necessiter une reprise manuelle.");
  }

  return preview;
};

export async function buildOrganizerWebsiteImportPreview(
  url: string,
  options?: { traceCredentials?: { login: string; password: string } | null; formatUrls?: string[] }
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
    return await buildGenericPreview(parsedUrl.toString(), options?.formatUrls ?? []);
  } catch (error) {
    if (error instanceof UtmbImportError || error instanceof TraceDeTrailImportError) {
      throw new OrganizerWebsiteImportError(error.code, error.message);
    }
    if (error instanceof OrganizerWebsiteImportError) throw error;
    throw new OrganizerWebsiteImportError("INVALID_DATA", "Impossible d'analyser le site de la course.");
  }
}
