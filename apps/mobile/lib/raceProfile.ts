import type { ElevationPoint } from '../components/PlanForm';

export type CatalogAidStation = {
  name: string;
  distanceKm: number;
  waterRefill: boolean;
  pauseMinutes?: number;
};

export async function fetchRaceElevationProfile(raceId: string | null | undefined): Promise<ElevationPoint[]> {
  if (!raceId) return [];

  const apiBase = process.env.EXPO_PUBLIC_API_URL ?? '';
  if (!apiBase) return [];

  try {
    const response = await fetch(`${apiBase}/api/onboarding/race-profile?raceId=${encodeURIComponent(raceId)}`);
    if (!response.ok) return [];

    const data = (await response.json().catch(() => null)) as { elevationProfile?: ElevationPoint[] } | null;
    const elevationProfile = Array.isArray(data?.elevationProfile) ? data?.elevationProfile : [];
    return elevationProfile
      .filter(
        (point): point is ElevationPoint =>
          typeof point?.distanceKm === 'number' &&
          Number.isFinite(point.distanceKm) &&
          typeof point?.elevationM === 'number' &&
          Number.isFinite(point.elevationM),
      )
      .map((point) => ({
        distanceKm: point.distanceKm,
        elevationM: point.elevationM,
      }));
  } catch {
    return [];
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
