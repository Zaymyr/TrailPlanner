export type GpxPoint = {
  lat: number;
  lng: number;
  ele: number | null;
  time?: string | null;
  distKmCum: number;
};

export type GpxWaypoint = {
  lat: number;
  lng: number;
  name?: string | null;
  desc?: string | null;
};

export type GpxStats = {
  distanceKm: number;
  gainM: number;
  lossM: number;
  minAltM: number | null;
  maxAltM: number | null;
  startLat: number | null;
  startLng: number | null;
  boundsMinLat: number | null;
  boundsMinLng: number | null;
  boundsMaxLat: number | null;
  boundsMaxLng: number | null;
};

export type ParsedGpx = {
  points: GpxPoint[];
  waypoints: GpxWaypoint[];
  stats: GpxStats;
  name?: string | null;
  pointSource: "track" | "route" | "waypoint";
};

export type GpxParseErrorCode =
  | "empty_file"
  | "invalid_encoding"
  | "not_gpx"
  | "unsupported_kml"
  | "unsupported_tcx"
  | "invalid_coordinates"
  | "no_coordinates";

const GPX_PARSE_ERROR_MESSAGES: Record<GpxParseErrorCode, string> = {
  empty_file: "The GPX file is empty.",
  invalid_encoding: "The file could not be read correctly. It may use an unsupported encoding.",
  not_gpx: "This file does not look like a GPX file.",
  unsupported_kml: "This file is KML, not GPX. Export it as a .gpx file and try again.",
  unsupported_tcx: "This file is TCX, not GPX. Export it as a .gpx file and try again.",
  invalid_coordinates: "Track, route, or waypoint coordinates are present but invalid.",
  no_coordinates: "No track, route, or waypoint coordinates found in GPX.",
};

export class GpxParseError extends Error {
  code: GpxParseErrorCode;

  constructor(code: GpxParseErrorCode, message = GPX_PARSE_ERROR_MESSAGES[code]) {
    super(message);
    this.name = "GpxParseError";
    this.code = code;
  }
}

type PointParseSummary = {
  totalTags: number;
  validCount: number;
};

const toNumber = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

const decodeNumericEntity = (value: string) => {
  const isHex = value[0]?.toLowerCase() === "x";
  const codePoint = Number.parseInt(isHex ? value.slice(1) : value, isHex ? 16 : 10);
  return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : `&#${value};`;
};

const decodeEntities = (text: string | null | undefined) => {
  if (!text) return "";
  return text
    .replace(/&#(x?[0-9a-f]+);/gi, (_match, value: string) => decodeNumericEntity(value))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const roundNullable = (value: number | null): number | null =>
  typeof value === "number" ? Number(value.toFixed(1)) : null;

const readAttribute = (attributes: string, name: string): string | null => {
  const match = attributes.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]+)"|'([^']+)'|([^\\s"'>/]+))`, "i")
  );
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
};

const readTagText = (content: string, name: string): string | null => {
  const match = content.match(
    new RegExp(`<(?:[\\w.-]+:)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${name}>`, "i")
  );
  return match?.[1] ?? null;
};

const sanitizeContent = (content: string) => {
  const withoutBom = content.replace(/^\uFEFF/, "");
  const hadNullBytes = withoutBom.includes("\u0000");

  return {
    content: withoutBom.replace(/\u0000/g, "").trim(),
    hadNullBytes,
  };
};

const validateGpxEnvelope = (content: string, hadNullBytes: boolean) => {
  if (!content) {
    throw new GpxParseError("empty_file");
  }

  if (/<(?:[\w.-]+:)?kml\b/i.test(content)) {
    throw new GpxParseError("unsupported_kml");
  }

  if (/<(?:[\w.-]+:)?(?:trainingcenterdatabase|tcx)\b/i.test(content)) {
    throw new GpxParseError("unsupported_tcx");
  }

  if (/<(?:!doctype\s+html|html|head|body)\b/i.test(content)) {
    throw new GpxParseError("not_gpx");
  }

  if (!/<(?:[\w.-]+:)?gpx\b/i.test(content)) {
    throw new GpxParseError(hadNullBytes ? "invalid_encoding" : "not_gpx");
  }
};

const isValidCoordinate = (lat: number, lng: number) =>
  lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

export const haversineMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const earthRadiusM = 6371e3;
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusM * c;
};

export const parseGpx = (content: string): ParsedGpx => {
  const normalized = sanitizeContent(content);
  validateGpxEnvelope(normalized.content, normalized.hadNullBytes);

  const points: GpxPoint[] = [];
  let totalMeters = 0;
  let gainM = 0;
  let lossM = 0;
  let minAltM: number | null = null;
  let maxAltM: number | null = null;
  let boundsMinLat: number | null = null;
  let boundsMinLng: number | null = null;
  let boundsMaxLat: number | null = null;
  let boundsMaxLng: number | null = null;
  const elevationThreshold = 1;
  let previousEle: number | null = null;
  const trackNameMatch =
    normalized.content.match(
      /<(?:[\w.-]+:)?metadata\b[\s\S]*?<(?:[\w.-]+:)?name\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?name>[\s\S]*?<\/(?:[\w.-]+:)?metadata>/i
    ) ??
    normalized.content.match(
      /<(?:[\w.-]+:)?trk\b[\s\S]*?<(?:[\w.-]+:)?name\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?name>/i
    );
  const trackName = decodeEntities(trackNameMatch?.[1]) || null;

  const appendPoint = (lat: number, lng: number, ele: number | null, time: string | null) => {
    if (points.length > 0) {
      const prev = points[points.length - 1];
      totalMeters += haversineMeters(prev.lat, prev.lng, lat, lng);
    }

    if (ele !== null) {
      minAltM = minAltM === null ? ele : Math.min(minAltM, ele);
      maxAltM = maxAltM === null ? ele : Math.max(maxAltM, ele);

      if (previousEle !== null) {
        const diff = ele - previousEle;
        if (diff > elevationThreshold) {
          gainM += diff;
        } else if (diff < -elevationThreshold) {
          lossM += Math.abs(diff);
        }
      }

      previousEle = ele;
    }

    boundsMinLat = boundsMinLat === null ? lat : Math.min(boundsMinLat, lat);
    boundsMaxLat = boundsMaxLat === null ? lat : Math.max(boundsMaxLat, lat);
    boundsMinLng = boundsMinLng === null ? lng : Math.min(boundsMinLng, lng);
    boundsMaxLng = boundsMaxLng === null ? lng : Math.max(boundsMaxLng, lng);

    points.push({
      lat,
      lng,
      ele,
      time,
      distKmCum: Number((totalMeters / 1000).toFixed(3)),
    });

    if (points.length === 1) {
      boundsMinLat = lat;
      boundsMaxLat = lat;
      boundsMinLng = lng;
      boundsMaxLng = lng;
    }
  };

  const appendPointElements = (tagName: "trkpt" | "rtept" | "wpt"): PointParseSummary => {
    const pointRegex = new RegExp(
      `<(?:[\\w.-]+:)?${tagName}\\b([^>]*)(?:>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${tagName}>|\\s*\\/>)`,
      "gi"
    );
    let pointMatch: RegExpExecArray | null = null;
    let totalTags = 0;
    let validCount = 0;

    while ((pointMatch = pointRegex.exec(normalized.content))) {
      totalTags += 1;
      const attributes = pointMatch[1];
      const inner = pointMatch[2] ?? "";
      const lat = toNumber(readAttribute(attributes, "lat"));
      const lng = toNumber(readAttribute(attributes, "lon") ?? readAttribute(attributes, "lng"));

      if (lat === null || lng === null || !isValidCoordinate(lat, lng)) continue;

      const ele = toNumber(readTagText(inner, "ele"));
      const time = readTagText(inner, "time");
      appendPoint(lat, lng, ele, time);
      validCount += 1;
    }

    return { totalTags, validCount };
  };

  let pointSource: ParsedGpx["pointSource"] = "track";
  const parsedTrackPoints = appendPointElements("trkpt");

  if (parsedTrackPoints.validCount === 0) {
    pointSource = "route";
    appendPointElements("rtept");
  }

  if (points.length === 0) {
    pointSource = "waypoint";
    appendPointElements("wpt");
  }

  if (points.length === 0) {
    const trackPoints = appendPointElements("trkpt");
    const routePoints = appendPointElements("rtept");
    const waypointPoints = appendPointElements("wpt");
    const hasPointTags = trackPoints.totalTags + routePoints.totalTags + waypointPoints.totalTags > 0;
    throw new GpxParseError(hasPointTags ? "invalid_coordinates" : "no_coordinates");
  }

  const waypoints: GpxWaypoint[] = [];
  const wptRegex = /<(?:[\w.-]+:)?wpt\b([^>]*)(?:>([\s\S]*?)<\/(?:[\w.-]+:)?wpt>|\s*\/>)/gi;
  let wptMatch: RegExpExecArray | null = null;

  while ((wptMatch = wptRegex.exec(normalized.content))) {
    const attributes = wptMatch[1];
    const inner = wptMatch[2] ?? "";
    const lat = toNumber(readAttribute(attributes, "lat"));
    const lng = toNumber(readAttribute(attributes, "lon") ?? readAttribute(attributes, "lng"));

    if (lat === null || lng === null || !isValidCoordinate(lat, lng)) continue;

    const name = decodeEntities(readTagText(inner, "name")) || null;
    const desc = decodeEntities(readTagText(inner, "desc")) || null;
    waypoints.push({ lat, lng, name, desc });
  }

  return {
    points,
    waypoints,
    stats: {
      distanceKm: Number((totalMeters / 1000).toFixed(2)),
      gainM: Number(gainM.toFixed(1)),
      lossM: Number(lossM.toFixed(1)),
      minAltM: roundNullable(minAltM),
      maxAltM: roundNullable(maxAltM),
      startLat: points[0]?.lat ?? null,
      startLng: points[0]?.lng ?? null,
      boundsMinLat,
      boundsMinLng,
      boundsMaxLat,
      boundsMaxLng,
    },
    name: trackName || null,
    pointSource,
  };
};
