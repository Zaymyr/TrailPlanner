export type MobileGpxPointSource = 'track' | 'route' | 'waypoint';

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

const parsePointElements = (content: string, tagName: 'trkpt' | 'rtept' | 'wpt'): ParsedPoint[] => {
  const pointRegex = new RegExp(
    `<(?:[\\w.-]+:)?${tagName}\\b([^>]*)(?:>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${tagName}>|\\s*\\/>)`,
    'gi',
  );
  const points: ParsedPoint[] = [];
  let pointMatch: RegExpExecArray | null = null;

  while ((pointMatch = pointRegex.exec(content))) {
    const attributes = pointMatch[1];
    const inner = pointMatch[2] ?? '';
    const lat = toNumber(readAttribute(attributes, 'lat'));
    const lng = toNumber(readAttribute(attributes, 'lon'));

    if (lat === null || lng === null) continue;

    points.push({
      lat,
      lng,
      ele: toNumber(readTagText(inner, 'ele')),
    });
  }

  return points;
};

export const parseGpxForRaceImport = (content: string): MobileGpxParseResult => {
  let pointSource: MobileGpxPointSource = 'track';
  let points = parsePointElements(content, 'trkpt');

  if (points.length === 0) {
    pointSource = 'route';
    points = parsePointElements(content, 'rtept');
  }

  if (points.length === 0) {
    pointSource = 'waypoint';
    points = parsePointElements(content, 'wpt');
  }

  if (points.length === 0) {
    throw new Error('No track, route, or waypoint coordinates found in GPX.');
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
