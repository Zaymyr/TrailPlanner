import type { ElevationPoint } from '../components/PlanForm';
import { WEB_API_BASE_URL } from './webApi';

export type CatalogAidStation = {
  name: string;
  distanceKm: number;
  waterRefill: boolean;
  pauseMinutes?: number;
};

type ElevationProfileStats = {
  pointCount: number;
  distanceSpanKm: number;
  elevationRangeM: number;
  elevationGainM: number;
  score: number;
};

function sanitizeElevationProfile(points: unknown): ElevationPoint[] {
  if (!Array.isArray(points)) return [];

  return points
    .filter(
      (point): point is ElevationPoint =>
        typeof point === 'object' &&
        point !== null &&
        typeof (point as ElevationPoint).distanceKm === 'number' &&
        Number.isFinite((point as ElevationPoint).distanceKm) &&
        typeof (point as ElevationPoint).elevationM === 'number' &&
        Number.isFinite((point as ElevationPoint).elevationM),
    )
    .map((point) => ({
      distanceKm: point.distanceKm,
      elevationM: point.elevationM,
    }))
    .sort((left, right) => left.distanceKm - right.distanceKm);
}

function toNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function readAttribute(attributes: string, name: string): string | null {
  const match = attributes.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]+)"|'([^']+)'|([^\\s"'>/]+))`, 'i'),
  );
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

function readTagText(content: string, name: string): string | null {
  const match = content.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return match?.[1] ?? null;
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radius = 6371e3;
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return radius * c;
}

function parseGpxElevationProfile(content: string): ElevationPoint[] {
  const points: ElevationPoint[] = [];
  let totalMeters = 0;
  let previousPoint: { lat: number; lng: number } | null = null;

  const appendPointElements = (tagName: 'trkpt' | 'rtept') => {
    const pointRegex = new RegExp(
      `<(?:[\\w.-]+:)?${tagName}\\b([^>]*)(?:>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${tagName}>|\\s*\\/>)`,
      'gi',
    );
    let pointMatch: RegExpExecArray | null = null;
    let count = 0;

    while ((pointMatch = pointRegex.exec(content))) {
      const attributes = pointMatch[1] ?? '';
      const inner = pointMatch[2] ?? '';
      const lat = toNumber(readAttribute(attributes, 'lat'));
      const lng = toNumber(readAttribute(attributes, 'lon'));
      const ele = toNumber(readTagText(inner, 'ele'));

      if (lat === null || lng === null) continue;

      if (previousPoint) {
        totalMeters += haversineMeters(previousPoint.lat, previousPoint.lng, lat, lng);
      }
      previousPoint = { lat, lng };

      if (ele === null) continue;

      points.push({
        distanceKm: Number((totalMeters / 1000).toFixed(3)),
        elevationM: ele,
      });
      count += 1;
    }

    return count;
  };

  const trackPointCount = appendPointElements('trkpt');
  if (trackPointCount === 0) {
    appendPointElements('rtept');
  }

  return sanitizeElevationProfile(points);
}

function summarizeElevationProfile(points: ElevationPoint[]): ElevationProfileStats {
  const sanitized = sanitizeElevationProfile(points);
  if (sanitized.length === 0) {
    return { pointCount: 0, distanceSpanKm: 0, elevationRangeM: 0, elevationGainM: 0, score: 0 };
  }

  let minElevation = sanitized[0].elevationM;
  let maxElevation = sanitized[0].elevationM;
  let gain = 0;

  for (let index = 1; index < sanitized.length; index += 1) {
    const previous = sanitized[index - 1];
    const current = sanitized[index];
    minElevation = Math.min(minElevation, current.elevationM);
    maxElevation = Math.max(maxElevation, current.elevationM);

    const deltaElevation = current.elevationM - previous.elevationM;
    if (deltaElevation > 0.5) {
      gain += deltaElevation;
    }
  }

  const distanceSpanKm = Math.max(0, (sanitized[sanitized.length - 1]?.distanceKm ?? 0) - sanitized[0].distanceKm);
  const elevationRangeM = Math.max(0, maxElevation - minElevation);
  const pointCount = sanitized.length;
  const score =
    pointCount * 8 +
    Math.min(150, distanceSpanKm * 3) +
    Math.min(120, elevationRangeM / 4) +
    Math.min(120, gain / 6);

  return {
    pointCount,
    distanceSpanKm,
    elevationRangeM,
    elevationGainM: gain,
    score,
  };
}

export function pickBestElevationProfile(
  profiles: Array<ElevationPoint[] | null | undefined>,
  expectedDistanceKm?: number | null,
): ElevationPoint[] {
  let bestProfile: ElevationPoint[] = [];
  let bestStats = summarizeElevationProfile([]);

  for (const profile of profiles) {
    const sanitized = sanitizeElevationProfile(profile);
    const stats = summarizeElevationProfile(sanitized);
    if (stats.score <= 0) continue;

    const bestCoverage =
      typeof expectedDistanceKm === 'number' && expectedDistanceKm > 0
        ? bestStats.distanceSpanKm / expectedDistanceKm
        : bestStats.distanceSpanKm;
    const nextCoverage =
      typeof expectedDistanceKm === 'number' && expectedDistanceKm > 0
        ? stats.distanceSpanKm / expectedDistanceKm
        : stats.distanceSpanKm;

    const nextIsClearlyBetter =
      stats.score > bestStats.score + 20 ||
      stats.pointCount > bestStats.pointCount + 8 ||
      (stats.elevationRangeM > bestStats.elevationRangeM + 25 && stats.elevationGainM > bestStats.elevationGainM + 60) ||
      nextCoverage > bestCoverage + 0.2;

    if (bestProfile.length === 0 || nextIsClearlyBetter) {
      bestProfile = sanitized;
      bestStats = stats;
    }
  }

  return bestProfile;
}

async function fetchStoredRaceElevationProfile(raceId: string): Promise<ElevationPoint[]> {
  const { supabase } = await import('./supabase');

  try {
    const { data, error } = await supabase
      .from('race_plans')
      .select('elevation_profile, updated_at')
      .eq('race_id', raceId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return [];
    return sanitizeElevationProfile(data?.elevation_profile);
  } catch {
    return [];
  }
}

async function fetchRaceElevationProfileFromStorage(raceId: string): Promise<ElevationPoint[]> {
  const { supabase } = await import('./supabase');

  try {
    const { data: race, error } = await supabase
      .from('races')
      .select('gpx_storage_path')
      .eq('id', raceId)
      .maybeSingle();

    if (error || typeof race?.gpx_storage_path !== 'string' || race.gpx_storage_path.trim().length === 0) {
      return [];
    }

    const { data: gpxFile, error: downloadError } = await supabase.storage
      .from('race-gpx')
      .download(race.gpx_storage_path);

    if (downloadError || !gpxFile) return [];

    const gpxContent = await gpxFile.text();
    return parseGpxElevationProfile(gpxContent);
  } catch {
    return [];
  }
}

export async function fetchRaceElevationProfile(raceId: string | null | undefined): Promise<ElevationPoint[]> {
  if (!raceId) return [];

  const apiBase = WEB_API_BASE_URL;
  if (!apiBase) {
    return pickBestElevationProfile([
      await fetchRaceElevationProfileFromStorage(raceId),
      await fetchStoredRaceElevationProfile(raceId),
    ]);
  }

  let apiProfile: ElevationPoint[] = [];

  try {
    const { supabase } = await import('./supabase');
    const session = await supabase.auth.getSession();
    const accessToken = session.data?.session?.access_token ?? null;

    const response = await fetch(`${apiBase}/api/onboarding/race-profile?raceId=${encodeURIComponent(raceId)}`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
    if (response.ok) {
      const data = (await response.json().catch(() => null)) as { elevationProfile?: ElevationPoint[] } | null;
      apiProfile = sanitizeElevationProfile(data?.elevationProfile);
    }
  } catch {
    apiProfile = [];
  }

  const [storageProfile, storedProfile] = await Promise.all([
    fetchRaceElevationProfileFromStorage(raceId),
    fetchStoredRaceElevationProfile(raceId),
  ]);

  return pickBestElevationProfile([apiProfile, storageProfile, storedProfile]);
}

export async function fetchRaceAidStations(raceId: string | null | undefined): Promise<CatalogAidStation[]> {
  if (!raceId) return [];

  const { supabase } = await import('./supabase');

  try {
    const { data, error } = await supabase
      .from('race_aid_stations')
      .select('name, km, water_available, order_index')
      .eq('race_id', raceId)
      .order('order_index', { ascending: true });

    if (error || !Array.isArray(data)) return [];

    return data
      .map((row) => ({
        name: typeof row.name === 'string' ? row.name : '',
        distanceKm: typeof row.km === 'number' ? row.km : Number(row.km ?? 0),
        waterRefill: row.water_available !== false,
        pauseMinutes: 0,
      }))
      .filter(
        (station) =>
          station.name.trim().length > 0 &&
          Number.isFinite(station.distanceKm) &&
          station.distanceKm > 0,
      );
  } catch {
    return [];
  }
}
