import { describe, expect, it } from 'vitest';
import {
  getRunnerAccessModeErrorMessage,
  resolveRunnerPlanAccess,
  resolveRunnerPlanCapabilities,
  resolveRunnerPlanUnlockBadge,
} from './runnerPlanAccess';

describe('server plan capabilities', () => {
  it('distinguishes an unknown response from a verified denial and reuses verified cache', () => {
    const denied = { enabled: true, mode: 'free' as const, canEdit: false, canViewDetails: false };
    const allowed = { enabled: true, mode: 'premium' as const, canEdit: true, canViewDetails: true };
    expect(resolveRunnerPlanAccess(denied, allowed)).toEqual({ status: 'verified', capabilities: denied });
    expect(resolveRunnerPlanAccess(null, allowed)).toEqual({ status: 'cached', capabilities: allowed });
    expect(resolveRunnerPlanAccess(null, null)).toEqual({ status: 'unknown', capabilities: null });
  });

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
  it('honors free admin simulation before rollout is enabled', () => {
    expect(resolveRunnerPlanCapabilities({ enabled: false, mode: 'free', canEdit: true, canViewDetails: true })).toMatchObject({ canEdit: false, canViewDetails: false });
  });
  it('preserves premium admin simulation before rollout is enabled', () => {
    expect(resolveRunnerPlanCapabilities({ enabled: false, mode: 'premium', canEdit: true, canViewDetails: true })).toMatchObject({ canEdit: true, canViewDetails: true });
  });
});

describe('admin access mode errors', () => {
  it('explains when the configured API does not expose the test route yet', () => {
    expect(getRunnerAccessModeErrorMessage(404, 'fr')).toContain('pas encore disponible');
    expect(getRunnerAccessModeErrorMessage(404, 'en')).toContain('not available yet');
  });

  it('asks the administrator to reconnect after an authorization failure', () => {
    expect(getRunnerAccessModeErrorMessage(403, 'fr')).toContain('reconnectée');
    expect(getRunnerAccessModeErrorMessage(401, 'en')).toContain('Reconnect');
  });
});

describe('resolveRunnerPlanUnlockBadge', () => {
  const granted = { enabled: true, canEdit: true, canViewDetails: true } as const;

  it('labels a per-plan purchase, a subscription and a launch offer', () => {
    expect(resolveRunnerPlanUnlockBadge({ ...granted, source: 'plan_unlock' })).toBe('planUnlocked');
    expect(resolveRunnerPlanUnlockBadge({ ...granted, source: 'subscription' })).toBe('premium');
    expect(resolveRunnerPlanUnlockBadge({ ...granted, source: 'admin' })).toBe('premium');
    expect(resolveRunnerPlanUnlockBadge({ ...granted, source: 'grandfathered_plan' })).toBe('planOffered');
  });

  it('shows nothing without edit access, without monetization or without a source', () => {
    expect(resolveRunnerPlanUnlockBadge({ ...granted, canEdit: false, source: 'historical_subscription' })).toBeNull();
    expect(resolveRunnerPlanUnlockBadge({ ...granted, enabled: false, source: 'plan_unlock' })).toBeNull();
    expect(resolveRunnerPlanUnlockBadge({ ...granted })).toBeNull();
    expect(resolveRunnerPlanUnlockBadge(null)).toBeNull();
  });
});
