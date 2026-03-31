import type { ElevationPoint } from '../components/PlanForm';

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
