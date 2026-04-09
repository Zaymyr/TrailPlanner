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
  gpxAccessMode: "public" | "authenticated" | "embedded";
};

export type TraceDeTrailCredentials = {
  login: string;
  password: string;
};

type TraceDeTrailWaypoint = {
  lat: number;
  lng: number;
  name: string | null;
  type: string | null;
};

type TraceDeTrailEmbeddedGeometryPoint = {
  lon?: number | null;
  lat?: number | null;
  x?: number | null;
  y?: number | null;
};

type TraceDeTrailEmbeddedPi = {
  abs?: string | number | null;
  ord?: string | number | null;
  x?: string | number | null;
  y?: string | number | null;
  bh?: string | null;
  type?: string | null;
  type2?: string | null;
  type3?: string | null;
  labels?: string | null;
  infobulleTitre?: string | null;
};

export class TraceDeTrailImportError extends Error {
  code: "INVALID_URL" | "FETCH_FAILED" | "INVALID_DATA" | "AUTH_REQUIRED" | "AUTH_FAILED";

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

function decodeJsStringLiteral(value: string) {
  let decoded = "";

  for (let index = 0; index < value.length; index += 1) {
    const current = value[index];
    if (current !== "\\") {
      decoded += current;
      continue;
    }

    const next = value[index + 1];
    if (!next) {
      decoded += "\\";
      break;
    }

    index += 1;
    switch (next) {
      case "\\":
      case '"':
      case "'":
      case "/":
        decoded += next;
        break;
      case "b":
        decoded += "\b";
        break;
      case "f":
        decoded += "\f";
        break;
      case "n":
        decoded += "\n";
        break;
      case "r":
        decoded += "\r";
        break;
      case "t":
        decoded += "\t";
        break;
      case "v":
        decoded += "\v";
        break;
      case "u": {
        const hex = value.slice(index + 1, index + 5);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          decoded += String.fromCharCode(Number.parseInt(hex, 16));
          index += 4;
        } else {
          decoded += "u";
        }
        break;
      }
      case "x": {
        const hex = value.slice(index + 1, index + 3);
        if (/^[0-9a-fA-F]{2}$/.test(hex)) {
          decoded += String.fromCharCode(Number.parseInt(hex, 16));
          index += 2;
        } else {
          decoded += "x";
        }
        break;
      }
      default:
        decoded += next;
        break;
    }
  }

  return decoded;
}

function extractEmbeddedPropertyString(html: string, propertyName: string) {
  const marker = `${propertyName}:`;
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) return null;

  let valueIndex = markerIndex + marker.length;
  while (valueIndex < html.length && /\s/.test(html[valueIndex] ?? "")) valueIndex += 1;

  const quote = html[valueIndex];
  if (quote !== '"' && quote !== "'") return null;

  let raw = "";
  let escaped = false;

  for (let index = valueIndex + 1; index < html.length; index += 1) {
    const current = html[index] ?? "";
    if (escaped) {
      raw += current;
      escaped = false;
      continue;
    }

    if (current === "\\") {
      raw += current;
      escaped = true;
      continue;
    }

    if (current === quote) {
      return decodeJsStringLiteral(raw);
    }

    raw += current;
  }

  return null;
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
  return downloadTraceDeTrailGpxWithCookie(traceId, null);
}

function extractSetCookieHeaders(response: Response) {
  const headers = response.headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const combined = response.headers.get("set-cookie");
  return combined ? [combined] : [];
}

function buildCookieHeader(setCookieHeaders: string[]) {
  return setCookieHeaders
    .map((header) => header.split(";", 1)[0]?.trim() ?? "")
    .filter(Boolean)
    .join("; ");
}

async function loginTraceDeTrail(credentials: TraceDeTrailCredentials) {
  const response = await fetch("https://tracedetrail.fr/user/login", {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "user-agent": "Pace Yourself Trace de Trail Importer",
      accept: "application/json,text/plain,*/*",
      "x-requested-with": "XMLHttpRequest",
    },
    body: new URLSearchParams({
      login: credentials.login,
      password: credentials.password,
    }),
  }).catch(() => null);

  if (!response?.ok) {
    throw new TraceDeTrailImportError(
      "AUTH_FAILED",
      "Impossible de se connecter a Trace de Trail avec ces identifiants."
    );
  }

  const payload = (await response.json().catch(() => null)) as { success?: number; msg?: string | null } | null;
  if (payload?.success !== 1) {
    throw new TraceDeTrailImportError(
      "AUTH_FAILED",
      toNonEmptyString(payload?.msg) ?? "Impossible de se connecter a Trace de Trail avec ces identifiants."
    );
  }

  const cookieHeader = buildCookieHeader(extractSetCookieHeaders(response));
  if (!cookieHeader) {
    throw new TraceDeTrailImportError(
      "AUTH_FAILED",
      "Connexion Trace de Trail reussie, mais la session GPX n'a pas pu etre ouverte."
    );
  }

  return cookieHeader;
}

async function downloadTraceDeTrailGpxWithCookie(traceId: number, cookieHeader: string | null) {
  const response = await fetch("https://tracedetrail.fr/download/getFile/tracedetrail", {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "user-agent": "Pace Yourself Trace de Trail Importer",
      accept: "application/json,text/plain,*/*",
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
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

  const payload = (await response.json().catch(() => null)) as { success?: number; msg?: string | null; gpx?: string | null } | null;
  const gpxContent = toNonEmptyString(payload?.gpx ?? null);

  if (payload?.success !== 1 || !gpxContent || !gpxContent.includes("<gpx")) {
    const message = toNonEmptyString(payload?.msg);
    if (message && /connectez-vous|telecharger ce fichier/i.test(normalizeComparableName(message))) {
      throw new TraceDeTrailImportError(
        "AUTH_REQUIRED",
        "Le GPX officiel est protege sur Trace de Trail. Ajoutez vos identifiants pour y acceder."
      );
    }

    throw new TraceDeTrailImportError(
      "INVALID_DATA",
      "Impossible de recuperer les donnees Trace de Trail pour cette course."
    );
  }

  return gpxContent;
}

function extractEmbeddedTraceGeometry(html: string) {
  const geometryJson = extractEmbeddedPropertyString(html, "geometry");
  if (!geometryJson) return [];

  const parsed = JSON.parse(geometryJson) as TraceDeTrailEmbeddedGeometryPoint[];
  return Array.isArray(parsed) ? parsed : [];
}

function extractEmbeddedTracePi(html: string) {
  const piJson = extractEmbeddedPropertyString(html, "dataPi");
  if (!piJson) return [];

  const parsed = JSON.parse(piJson) as TraceDeTrailEmbeddedPi[];
  return Array.isArray(parsed) ? parsed : [];
}

function webMercatorToWgs84(x: number, y: number) {
  const lng = (x / 20037508.34) * 180;
  let lat = (y / 20037508.34) * 180;
  lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
  return { lat, lng };
}

function buildTraceDeTrailFallbackData(html: string) {
  const geometry = extractEmbeddedTraceGeometry(html);
  const passages = extractEmbeddedTracePi(html);

  const points = geometry
    .flatMap((point) => {
      const mercatorX = typeof point.lon === "number" ? point.lon : null;
      const mercatorY = typeof point.lat === "number" ? point.lat : null;
      const distanceKm = typeof point.x === "number" ? point.x : null;
      const elevationM = typeof point.y === "number" ? point.y : null;

      if (mercatorX === null || mercatorY === null || distanceKm === null || elevationM === null) return [];

      const { lat, lng } = webMercatorToWgs84(mercatorX, mercatorY);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];

      return [
        {
          lat,
          lng,
          elevationM,
          distanceKm,
        },
      ];
    })
    .filter((point, index, all) => index === 0 || point.distanceKm !== all[index - 1]?.distanceKm);

  const totalDistanceKm = points.at(-1)?.distanceKm ?? 0;
  const seenAidStations = new Set<string>();
  const aidStations = passages
    .flatMap((passage) => {
      const distanceKm = toFiniteNumber(String(passage.x ?? ""));
      if (distanceKm === null || distanceKm <= 0.05 || distanceKm >= totalDistanceKm - 0.05) return [];

      const passageType = normalizeComparableName(
        [passage.type, passage.type2, passage.type3, passage.labels].filter(Boolean).join(" ")
      );
      if (!/(ravito|ravitoc|eau|basevie)/.test(passageType)) return [];

      const rawName = toNonEmptyString(passage.infobulleTitre) ?? toNonEmptyString(passage.bh);
      const name = rawName ?? (passageType.includes("eau") ? "Point d'eau" : "Ravitaillement");
      const dedupeKey = `${normalizeComparableName(name)}:${distanceKm.toFixed(1)}`;

      if (seenAidStations.has(dedupeKey)) return [];
      seenAidStations.add(dedupeKey);

      return [
        {
          name,
          distanceKm: Number(distanceKm.toFixed(1)),
          waterRefill: true,
        },
      ];
    })
    .sort((left, right) => left.distanceKm - right.distanceKm);

  const waypointXml = aidStations
    .flatMap((aidStation) => {
      const nearestPoint =
        points.find((point) => point.distanceKm >= aidStation.distanceKm) ??
        points.at(-1) ??
        null;
      if (!nearestPoint) return [];

      return [
        `  <wpt lat="${nearestPoint.lat.toFixed(6)}" lon="${nearestPoint.lng.toFixed(6)}">`,
        `    <name>${escapeXml(aidStation.name)}</name>`,
        `    <type>${escapeXml(aidStation.name.toLowerCase().includes("eau") ? "eau" : "ravitoc")}</type>`,
        `    <ele>${Math.round(nearestPoint.elevationM)}</ele>`,
        "  </wpt>",
      ];
    })
    .join("\n");

  const trackXml = points
    .map(
      (point) =>
        `    <trkpt lat="${point.lat.toFixed(6)}" lon="${point.lng.toFixed(6)}"><ele>${Math.round(point.elevationM)}</ele></trkpt>`
    )
    .join("\n");

  const gpxContent =
    points.length > 0
      ? [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<gpx version="1.1" creator="Pace Yourself" xmlns="http://www.topografix.com/GPX/1/1">',
          waypointXml,
          "  <trk>",
          "    <name>Trace de Trail import</name>",
          "    <trkseg>",
          trackXml,
          "    </trkseg>",
          "  </trk>",
          "</gpx>",
        ]
          .filter(Boolean)
          .join("\n")
      : "";

  return {
    gpxContent,
    aidStations,
    elevationProfile: points.map((point) => ({
      distanceKm: Number(point.distanceKm.toFixed(3)),
      elevationM: Math.round(point.elevationM),
    })),
  };
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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

      const normalizedWaypointType = normalizeComparableName(waypoint.type ?? "");
      const name =
        waypoint.name ?? (normalizedWaypointType.includes("eau") ? "Point d'eau" : "Ravitaillement");
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

export async function getTraceDeTrailRaceData(
  inputUrl: string,
  options?: { credentials?: TraceDeTrailCredentials | null }
): Promise<TraceDeTrailRaceData> {
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

  let gpxContent = "";
  let parsedGpx: ReturnType<typeof parseGpx>;
  let aidStations: TraceDeTrailAidStation[] = [];
  let elevationProfile: Array<{ distanceKm: number; elevationM: number }> = [];
  let gpxAccessMode: TraceDeTrailRaceData["gpxAccessMode"] = "public";

  try {
    if (options?.credentials) {
      const cookieHeader = await loginTraceDeTrail(options.credentials);
      gpxContent = await downloadTraceDeTrailGpxWithCookie(traceId, cookieHeader);
      gpxAccessMode = "authenticated";
    } else {
      gpxContent = await downloadTraceDeTrailGpx(traceId);
      gpxAccessMode = "public";
    }
    parsedGpx = parseGpx(gpxContent);
    elevationProfile = parsedGpx.points
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
    aidStations = getTraceDeTrailAidStations(gpxContent, parsedGpx.points);
  } catch (error) {
    if (!(error instanceof TraceDeTrailImportError)) throw error;
    if (options?.credentials || (error.code !== "AUTH_REQUIRED" && error.code !== "INVALID_DATA")) {
      throw error;
    }

    try {
      const fallback = buildTraceDeTrailFallbackData(html);
      gpxContent = fallback.gpxContent;
      aidStations = fallback.aidStations;
      elevationProfile = fallback.elevationProfile;
      parsedGpx = parseGpx(gpxContent);
      gpxAccessMode = "embedded";
    } catch {
      throw new TraceDeTrailImportError(
        "INVALID_DATA",
        "Impossible de recuperer les donnees Trace de Trail pour cette course."
      );
    }
  }

  if (!gpxContent || elevationProfile.length === 0) {
    throw new TraceDeTrailImportError(
      "INVALID_DATA",
      "Impossible de recuperer les donnees Trace de Trail pour cette course."
    );
  }

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
    aidStations,
    elevationProfile,
    gpxContent,
    gpxAccessMode,
  };
}
