import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

import { fetchRaceRacebookData, fetchRaceRacebookDataOutcome } from './racebook';

describe('published RaceBook loading', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the immutable API payload as the sole source, including for a private published format', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      publicationId: 'publication-1',
      publicationRevision: 3,
      publishedAt: '2026-11-03T12:00:00.000Z',
      raceRow: {
        id: 'race-1',
        name: 'Format privé',
        distance_km: 42,
        elevation_gain_m: 2400,
        is_live: false,
        racebook_is_live: false,
        organizer_details: {},
        race_events: { id: 'event-1', name: 'Événement', organizer_details: {} },
      },
      stationRows: [],
      supporterPointRows: [],
      relayPointRows: [],
      startWaveRows: [],
      awardRows: [],
      editionServiceRows: [],
      modules: { supporter_guide: true },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchRaceRacebookData('race-1');

    expect(result).toMatchObject({
      race: { id: 'race-1', name: 'Format privé' },
      canOpen: true,
      aidStations: [],
      supporterGuideAvailable: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/racebook-data?raceId=race-1');
  });

  it('does not fall back to draft tables when no publication is available', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    await expect(fetchRaceRacebookData('race-without-publication')).resolves.toBeNull();
  });

  it('reports an unpublished RaceBook as a reachable answer, so its device copy is dropped', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    await expect(fetchRaceRacebookDataOutcome('race-without-publication')).resolves.toEqual({ data: null, reachable: true });
  });

  it('reports a network failure or an unavailable server as unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network request failed')));
    await expect(fetchRaceRacebookDataOutcome('race-1')).resolves.toEqual({ data: null, reachable: false });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    await expect(fetchRaceRacebookDataOutcome('race-1')).resolves.toEqual({ data: null, reachable: false });
  });
});
