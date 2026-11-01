import { describe, expect, it } from 'vitest';
import { getRunnerAccessModeErrorMessage, resolveRunnerPlanCapabilities } from './runnerPlanAccess';

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
