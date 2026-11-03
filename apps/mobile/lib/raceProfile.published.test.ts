import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

import {
  clearRaceProfileRequestCache,
  fetchPublishedRacebookElevationProfile,
  fetchPublishedRacebookRoutePreviewPoints,
} from './raceProfile';

describe('published RaceBook GPX', () => {
  afterEach(() => {
    clearRaceProfileRequestCache('race-1');
    vi.unstubAllGlobals();
  });

  it('uses the published GPX endpoint and returns only its sanitized visual data', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      publicationId: 'publication-1',
      elevationProfile: [
        { distanceKm: 10, elevationM: 1200 },
        { distanceKm: 0, elevationM: 800 },
      ],
      routePreviewPoints: [
        { lat: 45.1, lng: 6.2, elevationM: 800, distanceKm: 0 },
      ],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchPublishedRacebookElevationProfile('race-1')).resolves.toEqual([
      { distanceKm: 0, elevationM: 800 },
      { distanceKm: 10, elevationM: 1200 },
    ]);
    await expect(fetchPublishedRacebookRoutePreviewPoints('race-1')).resolves.toEqual([
      { lat: 45.1, lng: 6.2, elevationM: 800, distanceKm: 0 },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/racebook-gpx?raceId=race-1');
  });
});
