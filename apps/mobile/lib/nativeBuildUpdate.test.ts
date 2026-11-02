import { describe, expect, it } from 'vitest';

import { resolveIosNativeBuildUpdate } from './nativeBuildUpdate';

const releaseExtra = {
  nativeBuildUpdates: {
    ios: {
      latestBuild: '18',
      updateUrl: 'https://apps.apple.com/app/testflight/id899247664',
    },
  },
};

describe('native build update policy', () => {
  it('offers the configured release to an older installed build', () => {
    expect(resolveIosNativeBuildUpdate({ currentBuild: '17', extra: releaseExtra })).toEqual({
      latestBuild: 18,
      updateUrl: 'https://apps.apple.com/app/testflight/id899247664',
    });
  });

  it('does not offer an update to the current or a newer build', () => {
    expect(resolveIosNativeBuildUpdate({ currentBuild: '18', extra: releaseExtra })).toBeNull();
    expect(resolveIosNativeBuildUpdate({ currentBuild: '19', extra: releaseExtra })).toBeNull();
  });

  it('fails closed when the installed build or release metadata is invalid', () => {
    expect(resolveIosNativeBuildUpdate({ currentBuild: null, extra: releaseExtra })).toBeNull();
    expect(resolveIosNativeBuildUpdate({
      currentBuild: '17',
      extra: {
        nativeBuildUpdates: {
          ios: { latestBuild: '18', updateUrl: 'itms-beta://invalid' },
        },
      },
    })).toBeNull();
  });
});
