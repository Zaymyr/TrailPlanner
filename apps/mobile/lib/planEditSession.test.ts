import { describe, expect, it } from 'vitest';

import type { PlanFormValues } from '../components/PlanForm';
import type { PlanProductsBootstrap } from '../components/plan-form/usePlanProducts';
import {
  consumePlanWorkspaceWarmStart,
  stagePlanWorkspaceWarmStart,
} from './planEditSession';

describe('plan workspace warm start', () => {
  it('is consumed once when returning from the RaceBook', () => {
    const values = { name: 'Plan 80 km' } as PlanFormValues;
    const products = { allProducts: [] } as unknown as PlanProductsBootstrap;

    const token = stagePlanWorkspaceWarmStart('plan-1', {
      draft: {
        elevationProfile: [],
        lastSavedSnapshot: 'saved-snapshot',
        planName: values.name,
        values,
      },
      products,
    });

    expect(consumePlanWorkspaceWarmStart('plan-1', token)).toEqual({
      planId: 'plan-1',
      draft: {
        elevationProfile: [],
        lastSavedSnapshot: 'saved-snapshot',
        planName: 'Plan 80 km',
        values,
      },
      products,
    });
    expect(consumePlanWorkspaceWarmStart('plan-1', token)).toBeNull();
  });

  it('keeps warm starts isolated by plan id', () => {
    const values = { name: 'Plan A' } as PlanFormValues;
    const products = { allProducts: [] } as unknown as PlanProductsBootstrap;
    const token = stagePlanWorkspaceWarmStart('plan-a', {
      draft: { elevationProfile: [], lastSavedSnapshot: null, planName: values.name, values },
      products,
    });

    expect(consumePlanWorkspaceWarmStart('plan-b', token)).toBeNull();
    expect(consumePlanWorkspaceWarmStart('plan-a', 'wrong-token')).toBeNull();
    expect(consumePlanWorkspaceWarmStart('plan-a', token)).toMatchObject({
      planId: 'plan-a',
      draft: { planName: 'Plan A' },
    });
  });
});
