import { describe, expect, it } from 'vitest';

import { isUnsupportedDevelopmentUpdateError, shouldSkipOtaUpdateCheck } from './otaUpdatePolicy';

describe('OTA update policy', () => {
  it('skips checks in development runtimes and development builds', () => {
    expect(shouldSkipOtaUpdateCheck({ isDevelopmentRuntime: true, updatesEnabled: true, appVariant: 'production' })).toBe(true);
    expect(shouldSkipOtaUpdateCheck({ isDevelopmentRuntime: false, updatesEnabled: true, appVariant: 'development' })).toBe(true);
    expect(shouldSkipOtaUpdateCheck({ isDevelopmentRuntime: false, updatesEnabled: false, appVariant: 'production' })).toBe(true);
  });

  it('keeps checks enabled for update-capable production builds', () => {
    expect(shouldSkipOtaUpdateCheck({ isDevelopmentRuntime: false, updatesEnabled: true, appVariant: 'production' })).toBe(false);
  });

  it('recognizes only the development-build rejection', () => {
    expect(isUnsupportedDevelopmentUpdateError(new Error("Call to function 'ExpoUpdates.checkForUpdateAsync' has been rejected: not supported in development builds"))).toBe(true);
    expect(isUnsupportedDevelopmentUpdateError(new Error('Network unavailable'))).toBe(false);
  });
});
