import { describe, expect, it, vi } from 'vitest';

import type { PlanSummary } from './planSummary';
import type { CreatePlanShareLinkArgs } from './planShareLinks';
import { createPlanShareLinkSynchronizer } from './planShareLinks';

vi.mock('./supabase', () => ({
  supabase: { auth: { getSession: vi.fn() } },
}));
vi.mock('./webApi', () => ({ WEB_API_BASE_URL: 'https://example.test' }));

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
