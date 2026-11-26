import { describe, expect, it } from 'vitest';

import {
  applyCourseTerrainOverrides,
  courseTerrainAtKm,
  courseTerrainBetween,
  normalizeCourseTerrainSegments,
  scaleCourseTerrainSegments,
  summarizeCourseTerrain,
  type CourseTerrainSegment,
} from '@trailplanner/shared';

const seg = (fromKm: number, toKm: number, terrainClass: CourseTerrainSegment['class'], surface: string | null = null): CourseTerrainSegment => ({
  fromKm,
  toKm,
  class: terrainClass,
  surface,
  source: 'osm',
});

describe('course terrain presentation', () => {
  it('merges touching segments of the same class and drops empty ones', () => {
    expect(normalizeCourseTerrainSegments([seg(2, 5, 'trail'), seg(0, 2, 'trail', 'ground'), seg(5, 5, 'road'), seg(5, 6, 'road')])).toEqual([
      { fromKm: 0, toKm: 5, class: 'trail', surface: 'ground', source: 'osm' },
      { fromKm: 5, toKm: 6, class: 'road', surface: null, source: 'osm' },
    ]);
  });

  it('applies organizer overrides over OSM segments, later overrides winning', () => {
    const result = applyCourseTerrainOverrides(
      [seg(0, 4, 'road'), seg(4, 10, 'trail')],
      [{ fromKm: 3, toKm: 6, class: 'technical' }, { fromKm: 5, toKm: 12, class: 'off_path' }],
      10,
    );
    expect(result.map((s) => [s.fromKm, s.toKm, s.class, s.source])).toEqual([
      [0, 3, 'road', 'osm'],
      [3, 5, 'technical', 'organizer'],
      [5, 10, 'off_path', 'organizer'],
    ]);
  });

  it('summarizes km and % per class', () => {
    const summary = summarizeCourseTerrain([seg(0, 1, 'road'), seg(1, 4, 'trail')], 4);
    expect(summary.road).toEqual({ km: 1, pct: 25 });
    expect(summary.trail).toEqual({ km: 3, pct: 75 });
    expect(summary.off_path).toEqual({ km: 0, pct: 0 });
  });

  it('finds the segment at a km, scales and slices ranges', () => {
    const segments = [seg(0, 2, 'road'), seg(2, 10, 'trail')];
    expect(courseTerrainAtKm(segments, 2)?.class).toBe('trail');
    expect(courseTerrainAtKm(segments, 10)?.class).toBe('trail');
    expect(courseTerrainAtKm(segments, 11)).toBeNull();
    expect(scaleCourseTerrainSegments(segments, 10, 20)[1]).toMatchObject({ fromKm: 4, toKm: 20 });
    expect(courseTerrainBetween(segments, 1, 5)).toEqual([{ class: 'trail', km: 3 }, { class: 'road', km: 1 }]);
  });
});
