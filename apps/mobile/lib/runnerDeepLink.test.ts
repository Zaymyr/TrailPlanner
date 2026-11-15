import { describe, expect, it } from 'vitest';

import { resolveRunnerDeepLinkRoute } from './runnerDeepLink';

describe('resolveRunnerDeepLinkRoute', () => {
  it('routes a public course to the mobile catalog', () => {
    expect(resolveRunnerDeepLinkRoute('https://pace-yourself.com/courses/trail-du-mont-blanc'))
      .toBe('/(app)/catalog?raceSlug=trail-du-mont-blanc');
  });

  it('routes a valid planner race id', () => {
    const raceId = '4f635f3d-cc4d-4bf8-a095-714401fd9f2d';
    expect(resolveRunnerDeepLinkRoute(`https://pace-yourself.com/race-planner?catalogRaceId=${raceId}`))
      .toBe(`/(app)/plan/new?catalogRaceId=${raceId}`);
    expect(resolveRunnerDeepLinkRoute('https://pace-yourself.com/race-planner'))
      .toBe('/(app)/plan/new');
  });

  it('supports the existing custom scheme and rejects foreign or malformed links', () => {
    expect(resolveRunnerDeepLinkRoute('paceyourself://courses/my-race'))
      .toBe('/(app)/catalog?raceSlug=my-race');
    expect(resolveRunnerDeepLinkRoute('https://example.com/courses/my-race')).toBeNull();
    expect(resolveRunnerDeepLinkRoute('https://pace-yourself.com/race-planner?catalogRaceId=nope')).toBeNull();
  });
});
