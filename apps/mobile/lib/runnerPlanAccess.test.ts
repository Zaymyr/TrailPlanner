import { describe, expect, it } from 'vitest';
import { resolveRunnerPlanCapabilities } from './runnerPlanAccess';

describe('server plan capabilities', () => {
  it('keeps unpaid access closed after a failed load', () => {
    expect(resolveRunnerPlanCapabilities(null)).toMatchObject({ canEdit: false, canViewDetails: false });
  });
  it('preserves compatibility before rollout', () => {
    expect(resolveRunnerPlanCapabilities({ enabled: false, canEdit: false, canViewDetails: false })).toMatchObject({ canEdit: true, canViewDetails: true });
  });
  it('preserves read-only history without allowing editing', () => {
    expect(resolveRunnerPlanCapabilities({ enabled: true, canEdit: false, canViewDetails: true })).toMatchObject({ canEdit: false, canViewDetails: true });
  });
  it('honors free admin simulation rather than cached premium', () => {
    expect(resolveRunnerPlanCapabilities({ enabled: true, mode: 'free', canEdit: false, canViewDetails: false })).toMatchObject({ canEdit: false, canViewDetails: false });
  });
});
