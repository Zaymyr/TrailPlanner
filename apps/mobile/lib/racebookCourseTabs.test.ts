import { describe, expect, it } from 'vitest';

import { resolveRacebookCourseTabKeys } from './racebookCourseTabs';

describe('runner RaceBook course tabs', () => {
  it('keeps the historical order', () => {
    expect(resolveRacebookCourseTabKeys({ aidStations: true, relay: true, startWaves: true, awards: true }))
      .toEqual(['route', 'start-waves', 'aid-stations', 'relay', 'awards']);
  });

  it('never exposes supporter points, which belong to the Supporter Guide', () => {
    const keys: string[] = resolveRacebookCourseTabKeys({ aidStations: true, relay: true, startWaves: true, awards: true });
    expect(keys).not.toContain('supporters');
  });
});
