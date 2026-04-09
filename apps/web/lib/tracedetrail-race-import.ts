import "server-only";

import { haversineMeters, parseGpx } from "./gpx/parseGpx";

const TRACE_DE_TRAIL_HOST_PATTERN = /(^|\.)tracedetrail\.fr$/i;

export type TraceDeTrailAidStation = {
  name: string;
  distanceKm: number;
  waterRefill: boolean;
};

export type TraceDeTrailRaceData = {
  traceId: number;
  normalizedUrl: string;
  courseName: string;
  eventName: string;
  officialSiteUrl: string | null;
  thumbnailUrl: string | null;
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  date: string | null;
  location: string | null;
  aidStations: TraceDeTrailAidStation[];
  elevationProfile: Array<{
    distanceKm: number;
    elevationM: number;
  }>;
  gpxContent: string;
};

type TraceDeTrailWaypoint = {
  lat: number;
  lng: number;
  name: string | null;
  type: string | null;
};

export class TraceDeTrailImportError extends Error {
  code: "INVALID_URL" | "FETCH_FAILED" | "INVALID_DATA";

  constructor(code: TraceDeTrailImportError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

function toNonEmptyString(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function toFiniteNumber(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function decodeHtmlEntities(value: string | null | undefined) {
  if (!value) return "";
  return value
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCharCode(Number(digits)))
    .replace(/&#x([0-9a-f]+);/gi, (_, digits: string) => String.fromCharCode(Number.parseInt(digits, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .trim();
}

function stripHtml(value: string | null | undefined) {
  if (!value) return "";
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
}

function normalizeComparableName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeTraceDeTrailDate(value: string | null | undefined) {
  const normalized = toNonEmptyString(value);
  if (!normalized) return null;

  const dayMonthYear = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dayMonthYear) {
    const [, day, month, year] = dayMonthYear;
    return `${year}-${month}-${day}`;
  }

  const iso = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function readAttribute(attributes: string, name: string): string | null {
  const match = attributes.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]+)"|'([^']+)'|([^\\s"'>/]+))`, "i")
  );
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

function readTagText(content: string, name: string): string | null {
  const match = content.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  return match?.[1] ?? null;
}

function extractMatch(html: string, pattern: RegExp) {
  return pattern.exec(html)?.[1] ?? null;
}

function normalizeTraceDeTrailUrl(input: string) {
  let parsed: URL;

  try {
    parsed = new URL(input.trim());
  } catch {
    throw new TraceDeTrailImportError("INVALID_URL", "URL Trace de Trail invalide.");
  }

  if (!/^https?:$/i.test(parsed.protocol) || !TRACE_DE_TRAIL_HOST_PATTERN.test(parsed.hostname)) {
    throw new TraceDeTrailImportError("INVALID_URL", "URL Trace de Trail invalide.");
  }

  const pathMatch = parsed.pathname.match(/\/(?:fr|en)\/trace\/(\d+)(?:\/)?$/i) ?? parsed.pathname.match(/\/trace\/(\d+)(?:\/)?$/i);
  const traceId = pathMatch?.[1] ? Number(pathMatch[1]) : Number.NaN;

  if (!Number.isInteger(traceId) || traceId <= 0) {
    throw new TraceDeTrailImportError("INVALID_URL", "URL Trace de Trail invalide.");
  }

  return {
    traceId,
    normalizedUrl: `https://tracedetrail.fr/fr/trace/${traceId}`,
  };
}

function extractRaceStats(html: string) {
  const match = html.match(
    /<img[^>]+class=["']sportIcon["'][^>]*>[\s\S]*?<span class=["']line["'][^>]*>[\s\S]*?([\d.,]+)\s*km[\s\S]*?<\/span>[\s\S]*?<span class=["']line["'][^>]*>[\s\S]*?([\d.,]+)\s*m[\s\S]*?<\/span>[\s\S]*?<span class=["']line["'][^>]*>[\s\S]*?([\d.,]+)\s*m[\s\S]*?<\/span>/i
  );

  return {
    distanceKm: toFiniteNumber(match?.[1] ?? null),
    elevationGainM: toFiniteNumber(match?.[2] ?? null),
    elevationLossM: toFiniteNumber(match?.[3] ?? null),
  };
}

function extractLocation(html: string) {
  const raw = extractMatch(html, /id=["']traceLocalite["'][^>]*>([\s\S]*?)<\/div>/i);
  if (!raw) return null;

  const normalized = stripHtml(raw)
    .replace(/\s*-\s*>\s*/g, " -> ")
    .replace(/\s+/g, " ")
    .trim();

  return toNonEmptyString(normalized);
}

async function downloadTraceDeTrailGpx(traceId: number) {
  const response = await fetch("https://tracedetrail.fr/download/getFile/tracedetrail", {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "user-agent": "Pace Yourself Trace de Trail Importer",
      accept: "application/json,text/plain,*/*",
    },
    body: new URLSearchParams({
      traceID: String(traceId),
      format: "gpx",
      trace: "1",
      pi: "1",
      waytypes: "0",
      devneg: "0",
      devpos: "0",
      distance: "0",
      dir: "0",
    }),
  }).catch(() => null);

  if (!response?.ok) {
    throw new TraceDeTrailImportError(
      "FETCH_FAILED",
      "Impossible de recuperer les donnees Trace de Trail pour cette course."
    );
  }

  const payload = (await response.json().catch(() => null)) as { success?: number; gpx?: string | null } | null;
  const gpxContent = toNonEmptyString(payload?.gpx ?? null);

  if (payload?.success !== 1 || !gpxContent || !gpxContent.includes("<gpx")) {
    throw new TraceDeTrailImportError(
      "INVALID_DATA",
      "Impossible de recuperer les donnees Trace de Trail pour cette course."
    );
  }

  return gpxContent;
}

function parseTraceDeTrailWaypoints(gpxContent: string): TraceDeTrailWaypoint[] {
  const waypoints: TraceDeTrailWaypoint[] = [];
  const waypointPattern = /<wpt\b([^>]*)(?:>([\s\S]*?)<\/wpt>|\s*\/>)/gi;
  let match: RegExpExecArray | null = null;

  while ((match = waypointPattern.exec(gpxContent))) {
    const attributes = match[1] ?? "";
    const inner = match[2] ?? "";
    const lat = toFiniteNumber(readAttribute(attributes, "lat"));
    const lng = toFiniteNumber(readAttribute(attributes, "lon"));

    if (lat === null || lng === null) continue;

    waypoints.push({
      lat,
      lng,
      name: toNonEmptyString(decodeHtmlEntities(readTagText(inner, "name"))),
      type: toNonEmptyString(decodeHtmlEntities(readTagText(inner, "type"))),
    });
  }

  return waypoints;
}

function isAidStationType(value: string | null) {
  const normalized = normalizeComparableName(value ?? "");
  return /ravito|eau/.test(normalized);
}

function getTraceDeTrailAidStations(
  gpxContent: string,
  points: Array<{ lat: number; lng: number; distKmCum: number }>
): TraceDeTrailAidStation[] {
  const totalDistanceKm = points.at(-1)?.distKmCum ?? 0;
  const seen = new Set<string>();

  return parseTraceDeTrailWaypoints(gpxContent)
    .flatMap((waypoint) => {
      if (!isAidStationType(waypoint.type)) return [];

      let nearestDistanceKm = points[0]?.distKmCum ?? 0;
      let nearestMeters = Number.POSITIVE_INFINITY;

      for (const point of points) {
        const meters = haversineMeters(waypoint.lat, waypoint.lng, point.lat, point.lng);
        if (meters < nearestMeters) {
          nearestMeters = meters;
          nearestDistanceKm = point.distKmCum;
        }
      }

      const distanceKm = Number(nearestDistanceKm.toFixed(1));
      if (distanceKm <= 0.05 || distanceKm >= totalDistanceKm - 0.05) return [];

      const name =
        waypoint.name ??
        (normalizeComparableName(waypoint.type).includes("eau") ? "Point d'eau" : "Ravitaillement");
      const dedupeKey = `${normalizeComparableName(name)}:${distanceKm.toFixed(1)}`;

      if (seen.has(dedupeKey)) return [];
      seen.add(dedupeKey);

      return [
        {
          name,
          distanceKm,
          waterRefill: true,
        },
      ];
    })
    .sort((left, right) => left.distanceKm - right.distanceKm);
}

export async function getTraceDeTrailRaceData(inputUrl: string): Promise<TraceDeTrailRaceData> {
  const { traceId, normalizedUrl } = normalizeTraceDeTrailUrl(inputUrl);

  const response = await fetch(normalizedUrl, {
    cache: "no-store",
    headers: {
      "user-agent": "Pace Yourself Trace de Trail Importer",
      accept: "text/html,application/xhtml+xml",
    },
  }).catch(() => null);

  if (!response?.ok) {
    throw new TraceDeTrailImportError(
      "FETCH_FAILED",
      "Impossible de recuperer les donnees Trace de Trail pour cette course."
    );
  }

  const html = await response.text();
  const gpxContent = await downloadTraceDeTrailGpx(traceId);
  const parsedGpx = parseGpx(gpxContent);

  const courseName = toNonEmptyString(stripHtml(extractMatch(html, /id=["']traceNom["'][^>]*>([\s\S]*?)<\/div>/i)));
  const eventName = toNonEmptyString(
    stripHtml(extractMatch(html, /href=["']https?:\/\/tracedetrail\.fr\/(?:fr|en)\/event\/[^"']+["'][^>]*>([\s\S]*?)<\/a>/i))
  );
  const officialSiteUrl = toNonEmptyString(extractMatch(html, /id=["']siteweb["'][^>]*>\s*<a[^>]+href=["']([^"']+)["']/i));
  const thumbnailUrl =
    toNonEmptyString(extractMatch(html, /id=['"]logoTrace['"][^>]*\ssrc=['"]([^'"]+)['"]/i)) ??
    toNonEmptyString(extractMatch(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i));
  const stats = extractRaceStats(html);
  const date = normalizeTraceDeTrailDate(extractMatch(html, /id=["']datecompetTrace["'][^>]*>([\s\S]*?)<\/div>/i));
  const location = extractLocation(html);

  if (!courseName) {
    throw new TraceDeTrailImportError(
      "INVALID_DATA",
      "Impossible de recuperer les donnees Trace de Trail pour cette course."
    );
  }

  const elevationProfile = parsedGpx.points
    .flatMap((point) =>
      point.ele === null
        ? []
        : [
            {
              distanceKm: Number(point.distKmCum.toFixed(3)),
              elevationM: Math.round(point.ele),
            },
          ]
    )
    .filter((point, index, all) => index === 0 || point.distanceKm !== all[index - 1]?.distanceKm);

  return {
    traceId,
    normalizedUrl,
    courseName,
    eventName: eventName ?? courseName,
    officialSiteUrl,
    thumbnailUrl,
    distanceKm: Number((stats.distanceKm ?? parsedGpx.stats.distanceKm).toFixed(2)),
    elevationGainM: Math.round(stats.elevationGainM ?? parsedGpx.stats.gainM),
    elevationLossM: Math.round(stats.elevationLossM ?? parsedGpx.stats.lossM),
    date,
    location,
    aidStations: getTraceDeTrailAidStations(gpxContent, parsedGpx.points),
    elevationProfile,
    gpxContent,
  };
}
