export type MobileGpxPointSource = 'track' | 'route' | 'waypoint';

export type MobileGpxParseErrorCode =
  | 'empty_file'
  | 'invalid_encoding'
  | 'not_gpx'
  | 'unsupported_kml'
  | 'unsupported_tcx'
  | 'invalid_coordinates'
  | 'no_coordinates';

export type MobileGpxStats = {
  distanceKm: number;
  gainM: number;
  lossM: number;
};

export type MobileGpxParseResult = {
  pointCount: number;
  pointSource: MobileGpxPointSource;
  hasElevation: boolean;
  stats: MobileGpxStats;
};

type ParsedPoint = {
  lat: number;
  lng: number;
  ele: number | null;
};

type ParsedPointBatch = {
  points: ParsedPoint[];
  totalTags: number;
};

const MOBILE_GPX_PARSE_ERROR_MESSAGES: Record<MobileGpxParseErrorCode, string> = {
  empty_file: 'The GPX file is empty.',
  invalid_encoding: 'The file could not be read correctly. It may use an unsupported encoding.',
  not_gpx: 'This file does not look like a GPX file.',
  unsupported_kml: 'This file is KML, not GPX.',
  unsupported_tcx: 'This file is TCX, not GPX.',
  invalid_coordinates: 'Track, route, or waypoint coordinates are present but invalid.',
  no_coordinates: 'No track, route, or waypoint coordinates found in GPX.',
};

export class MobileGpxParseError extends Error {
  code: MobileGpxParseErrorCode;

  constructor(code: MobileGpxParseErrorCode, message = MOBILE_GPX_PARSE_ERROR_MESSAGES[code]) {
    super(message);
    this.name = 'MobileGpxParseError';
    this.code = code;
  }
}

const toNumber = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

const readAttribute = (attributes: string, name: string): string | null => {
  const match = attributes.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]+)"|'([^']+)'|([^\\s"'>/]+))`, 'i'),
  );
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
};

const readTagText = (content: string, name: string): string | null => {
  const match = content.match(
    new RegExp(`<(?:[\\w.-]+:)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${name}>`, 'i'),
  );
  return match?.[1] ?? null;
};

const sanitizeContent = (content: string) => {
  const withoutBom = content.replace(/^\uFEFF/, '');
  const hadNullBytes = withoutBom.includes('\u0000');

  return {
    content: withoutBom.replace(/\u0000/g, '').trim(),
    hadNullBytes,
  };
};

const validateGpxEnvelope = (content: string, hadNullBytes: boolean) => {
  if (!content) {
    throw new MobileGpxParseError('empty_file');
  }

  if (/<(?:[\w.-]+:)?kml\b/i.test(content)) {
    throw new MobileGpxParseError('unsupported_kml');
  }

  if (/<(?:[\w.-]+:)?(?:trainingcenterdatabase|tcx)\b/i.test(content)) {
    throw new MobileGpxParseError('unsupported_tcx');
  }

  if (/<(?:!doctype\s+html|html|head|body)\b/i.test(content)) {
    throw new MobileGpxParseError('not_gpx');
  }

  if (!/<(?:[\w.-]+:)?gpx\b/i.test(content)) {
    throw new MobileGpxParseError(hadNullBytes ? 'invalid_encoding' : 'not_gpx');
  }
};

const isValidCoordinate = (lat: number, lng: number) =>
  lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const haversineMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
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

const parsePointElements = (content: string, tagName: 'trkpt' | 'rtept' | 'wpt'): ParsedPointBatch => {
  const pointRegex = new RegExp(
    `<(?:[\\w.-]+:)?${tagName}\\b([^>]*)(?:>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${tagName}>|\\s*\\/>)`,
    'gi',
  );
  const points: ParsedPoint[] = [];
  let totalTags = 0;
  let pointMatch: RegExpExecArray | null = null;

  while ((pointMatch = pointRegex.exec(content))) {
    totalTags += 1;
    const attributes = pointMatch[1];
    const inner = pointMatch[2] ?? '';
    const lat = toNumber(readAttribute(attributes, 'lat'));
    const lng = toNumber(readAttribute(attributes, 'lon') ?? readAttribute(attributes, 'lng'));

    if (lat === null || lng === null || !isValidCoordinate(lat, lng)) continue;

    points.push({
      lat,
      lng,
      ele: toNumber(readTagText(inner, 'ele')),
    });
  }

  return { points, totalTags };
};

export const parseGpxForRaceImport = (content: string): MobileGpxParseResult => {
  const normalized = sanitizeContent(content);
  validateGpxEnvelope(normalized.content, normalized.hadNullBytes);

  let pointSource: MobileGpxPointSource = 'track';
  const trackPoints = parsePointElements(normalized.content, 'trkpt');
  let points = trackPoints.points;

  if (points.length === 0) {
    pointSource = 'route';
    points = parsePointElements(normalized.content, 'rtept').points;
  }

  if (points.length === 0) {
    pointSource = 'waypoint';
    points = parsePointElements(normalized.content, 'wpt').points;
  }

  if (points.length === 0) {
    const routePoints = parsePointElements(normalized.content, 'rtept');
    const waypointPoints = parsePointElements(normalized.content, 'wpt');
    const hasPointTags = trackPoints.totalTags + routePoints.totalTags + waypointPoints.totalTags > 0;
    throw new MobileGpxParseError(hasPointTags ? 'invalid_coordinates' : 'no_coordinates');
  }

  let distanceM = 0;
  let gainM = 0;
  let lossM = 0;
  let previousEle: number | null = null;
  let hasElevation = false;
  const elevationThresholdM = 1;

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const previousPoint = points[index - 1];

    if (previousPoint) {
      distanceM += haversineMeters(previousPoint.lat, previousPoint.lng, point.lat, point.lng);
    }

    if (point.ele !== null) {
      hasElevation = true;

      if (previousEle !== null) {
        const diff = point.ele - previousEle;
        if (diff > elevationThresholdM) {
          gainM += diff;
        } else if (diff < -elevationThresholdM) {
          lossM += Math.abs(diff);
        }
      }

      previousEle = point.ele;
    }
  }

  return {
    pointCount: points.length,
    pointSource,
    hasElevation,
    stats: {
      distanceKm: Number((distanceM / 1000).toFixed(2)),
      gainM: Number(gainM.toFixed(1)),
      lossM: Number(lossM.toFixed(1)),
    },
  };
};
