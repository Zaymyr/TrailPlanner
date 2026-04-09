import type { ElevationPoint } from '../components/PlanForm';
import { WEB_API_BASE_URL } from './webApi';

export type CatalogAidStation = {
  name: string;
  distanceKm: number;
  waterRefill: boolean;
  pauseMinutes?: number;
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
    }));
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

export async function fetchRaceElevationProfile(raceId: string | null | undefined): Promise<ElevationPoint[]> {
  if (!raceId) return [];

  const apiBase = WEB_API_BASE_URL;
  if (!apiBase) return fetchStoredRaceElevationProfile(raceId);

  try {
    const { supabase } = await import('./supabase');
    const session = await supabase.auth.getSession();
    const accessToken = session.data?.session?.access_token ?? null;

    const response = await fetch(`${apiBase}/api/onboarding/race-profile?raceId=${encodeURIComponent(raceId)}`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
    if (!response.ok) return fetchStoredRaceElevationProfile(raceId);

    const data = (await response.json().catch(() => null)) as { elevationProfile?: ElevationPoint[] } | null;
    const elevationProfile = sanitizeElevationProfile(data?.elevationProfile);
    if (elevationProfile.length > 0) return elevationProfile;
    return fetchStoredRaceElevationProfile(raceId);
  } catch {
    return fetchStoredRaceElevationProfile(raceId);
  }
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
