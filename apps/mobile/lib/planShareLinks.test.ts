import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PlanSummary } from './planSummary';
import type { CreatePlanShareLinkArgs } from './planShareLinks';
import { createPlanShareLinkSynchronizer, synchronizePlanShareIfFollowed } from './planShareLinks';
import { supabase } from './supabase';

vi.mock('./supabase', () => ({
  supabase: { auth: { getSession: vi.fn() } },
}));
vi.mock('./webApi', () => ({ WEB_API_BASE_URL: 'https://example.test' }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function buildArgs(totalDurationMin = 120): CreatePlanShareLinkArgs {
  return {
    summary: {
      id: '9c13f405-6842-4f62-8f6c-a60f8af03d9e',
      name: 'Plan test',
      distanceKm: 20,
      elevationGainM: 800,
      waterBagLiters: 1.5,
      targetCarbsPerHour: 60,
      targetWaterPerHour: 500,
      targetSodiumPerHour: 400,
      movingDurationMin: totalDurationMin - 10,
      totalPauseMinutes: 10,
      totalDurationMin,
      totalProductUnits: 0,
      totalCarbsG: 0,
      totalSodiumMg: 0,
      productTotals: [],
      checkpoints: [],
    } satisfies PlanSummary,
    departureTime: new Date(2026, 8, 23, 6, 30),
    locale: 'fr',
  };
}

describe('createPlanShareLinkSynchronizer', () => {
  it('reuses one in-flight request and the resulting stable URL for an unchanged recap', async () => {
    let resolveRequest!: (value: string) => void;
    const createLink = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    const synchronize = createPlanShareLinkSynchronizer(createLink);
    const args = buildArgs();

    const first = synchronize(args);
    const second = synchronize(args);
    expect(createLink).toHaveBeenCalledTimes(1);

    resolveRequest('https://pace-yourself.com/share/plan/stable');
    await expect(first).resolves.toContain('/share/plan/stable');
    await expect(second).resolves.toContain('/share/plan/stable');
    await expect(synchronize(args)).resolves.toContain('/share/plan/stable');
    expect(createLink).toHaveBeenCalledTimes(1);
  });

  it('updates the stable link when the recalculated recap changes', async () => {
    let resolveFirstRequest!: (value: string) => void;
    const createLink = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveFirstRequest = resolve;
          }),
      )
      .mockResolvedValue('https://pace-yourself.com/share/plan/stable');
    const synchronize = createPlanShareLinkSynchronizer(createLink);

    const first = synchronize(buildArgs(120));
    const updated = synchronize(buildArgs(145));

    expect(createLink).toHaveBeenCalledTimes(1);
    resolveFirstRequest('https://pace-yourself.com/share/plan/stable');
    await first;
    await updated;

    expect(createLink).toHaveBeenCalledTimes(2);
    expect(createLink.mock.calls[1]?.[0].summary.totalDurationMin).toBe(145);
  });

  it('retries after a failed background synchronization', async () => {
    const createLink = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce('https://pace-yourself.com/share/plan/stable');
    const synchronize = createPlanShareLinkSynchronizer(createLink);
    const args = buildArgs();

    await expect(synchronize(args)).rejects.toThrow('network');
    await expect(synchronize(args)).resolves.toContain('/share/plan/stable');
    expect(createLink).toHaveBeenCalledTimes(2);
  });
});

describe('synchronizePlanShareIfFollowed', () => {
  it('does not write a snapshot when the active link has no followers', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { access_token: 'token' } } } as any);
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      share: { id: 'share', revoked: false, activeFollowerCount: 0 },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(synchronizePlanShareIfFollowed(buildArgs(201))).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).not.toMatchObject({ method: 'POST' });
  });

  it('uses the deduplicated share writer when at least one follower is active', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { access_token: 'token' } } } as any);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ share: { id: 'share', revoked: false, activeFollowerCount: 1 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ shareUrl: 'https://pace-yourself.com/share/plan/stable' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(synchronizePlanShareIfFollowed(buildArgs(202))).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'POST' });
  });
});
