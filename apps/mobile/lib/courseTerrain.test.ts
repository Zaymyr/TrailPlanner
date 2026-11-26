import { describe, expect, it, vi } from 'vitest';

import {
  buildCourseTerrainBandRects,
  buildCourseTerrainUrl,
  courseTerrainRefreshAt,
  courseTerrainSectionShares,
  courseTerrainSegmentsOnAxis,
  courseTerrainSummaryShares,
  fetchCourseTerrain,
  formatCourseTerrainShares,
  isCourseTerrainEntryFresh,
  isCourseTerrainResponse,
  resolveCourseTerrainRefresh,
  selectCourseTerrainDisplay,
  type CourseTerrainEntry,
} from './courseTerrain';
import {
  COURSE_TERRAIN_ATTRIBUTION,
  COURSE_TERRAIN_ATTRIBUTION_URL,
  COURSE_TERRAIN_CLASS_COLORS,
  summarizeCourseTerrain,
  type CourseTerrain,
  type CourseTerrainSegment,
} from './courseTerrainShared';

const segments: CourseTerrainSegment[] = [
  { fromKm: 0, toKm: 2, class: 'road', surface: 'asphalt', source: 'osm' },
  { fromKm: 2, toKm: 5, class: 'track', surface: 'gravel', source: 'osm' },
  { fromKm: 5, toKm: 9, class: 'trail', surface: null, source: 'osm' },
  { fromKm: 9, toKm: 10, class: 'off_path', surface: null, source: 'osm' },
];

const terrain: CourseTerrain = {
  status: 'ready',
  raceId: 'race-1',
  distanceKm: 10,
  segments,
  summary: summarizeCourseTerrain(segments, 10),
  coverage: { matchedPct: 90, surfaceTagPct: 60, sacScaleTagPct: 20 },
  hasOrganizerOverrides: false,
  computedAt: '2026-11-25T10:00:00Z',
  rulesVersion: 1,
  attribution: COURSE_TERRAIN_ATTRIBUTION,
  attributionUrl: COURSE_TERRAIN_ATTRIBUTION_URL,
};

const entry = (response: CourseTerrainEntry['response'], savedAt = '2026-11-26T08:00:00Z'): CourseTerrainEntry => ({ response, savedAt });

const labels = { road: 'route', track: 'piste', trail: 'sentier', technical: 'technique', off_path: 'hors chemin' };

describe('course terrain fetch', () => {
  it('builds the race-terrain URL', () => {
    expect(buildCourseTerrainUrl('a b', 'https://x.test')).toBe('https://x.test/api/race-terrain?raceId=a%20b');
  });

  it('validates the answer shape', () => {
    expect(isCourseTerrainResponse(terrain)).toBe(true);
    expect(isCourseTerrainResponse({ status: 'pending', raceId: 'r' })).toBe(true);
    expect(isCourseTerrainResponse({ status: 'unavailable', raceId: 'r', reason: 'no_route' })).toBe(true);
    expect(isCourseTerrainResponse({ status: 'ready', raceId: 'r' })).toBe(false);
    expect(isCourseTerrainResponse(null)).toBe(false);
  });

  it('classifies HTTP outcomes', async () => {
    const json = (status: number, body: unknown) => vi.fn().mockResolvedValue({ status, ok: status < 400, json: async () => body });
    expect(await fetchCourseTerrain('r', json(200, terrain) as unknown as typeof fetch)).toEqual({ kind: 'ok', response: terrain });
    expect(await fetchCourseTerrain('r', json(404, {}) as unknown as typeof fetch)).toEqual({ kind: 'gone' });
    expect(await fetchCourseTerrain('r', json(503, {}) as unknown as typeof fetch)).toEqual({ kind: 'unreachable' });
    expect(await fetchCourseTerrain('r', json(200, { nope: true }) as unknown as typeof fetch)).toEqual({ kind: 'unreachable' });
    expect(await fetchCourseTerrain('r', vi.fn().mockRejectedValue(new Error('Network request failed')) as unknown as typeof fetch))
      .toEqual({ kind: 'unreachable' });
  });
});

describe('course terrain cache freshness', () => {
  it('refreshes a ready terrain at most daily', () => {
    const ready = entry(terrain);
    expect(courseTerrainRefreshAt(ready)).toBe(Date.parse('2026-11-27T08:00:00Z'));
    expect(isCourseTerrainEntryFresh(ready, new Date('2026-11-27T07:59:00Z'))).toBe(true);
    expect(isCourseTerrainEntryFresh(ready, new Date('2026-11-27T08:00:00Z'))).toBe(false);
  });

  it('re-asks pending after 15 min and unavailable after 6 h', () => {
    expect(courseTerrainRefreshAt(entry({ status: 'pending', raceId: 'r' }))).toBe(Date.parse('2026-11-26T08:15:00Z'));
    expect(courseTerrainRefreshAt(entry({ status: 'unavailable', raceId: 'r', reason: 'failed' }))).toBe(Date.parse('2026-11-26T14:00:00Z'));
  });

  it('writes ready answers and keeps the last good copy otherwise', () => {
    const now = new Date('2026-11-27T09:00:00Z');
    const previous = entry(terrain);
    expect(resolveCourseTerrainRefresh(previous, { kind: 'unreachable' }, now)).toEqual({ entry: previous, persist: 'keep' });
    expect(resolveCourseTerrainRefresh(previous, { kind: 'gone' }, now)).toEqual({ entry: null, persist: 'remove' });
    expect(resolveCourseTerrainRefresh(null, { kind: 'ok', response: terrain }, now))
      .toEqual({ entry: { response: terrain, savedAt: now.toISOString() }, persist: 'write' });
    const pending = resolveCourseTerrainRefresh(previous, { kind: 'ok', response: { status: 'pending', raceId: 'r' } }, now);
    expect(pending.persist).toBe('keep');
    expect(pending.entry?.response.status).toBe('pending');
    const failed = resolveCourseTerrainRefresh(previous, { kind: 'ok', response: { status: 'unavailable', raceId: 'r', reason: 'failed' } }, now);
    expect(failed).toEqual({ entry: previous, persist: 'keep' });
    const noRoute = resolveCourseTerrainRefresh(previous, { kind: 'ok', response: { status: 'unavailable', raceId: 'r', reason: 'no_route' } }, now);
    expect(noRoute.persist).toBe('remove');
    expect(selectCourseTerrainDisplay(noRoute.entry)).toEqual({ kind: 'hidden' });
  });
});

describe('course terrain display state', () => {
  it('maps responses to hidden / pending / ready', () => {
    expect(selectCourseTerrainDisplay(null)).toEqual({ kind: 'hidden' });
    expect(selectCourseTerrainDisplay(entry({ status: 'pending', raceId: 'r' }))).toEqual({ kind: 'pending' });
    expect(selectCourseTerrainDisplay(entry({ status: 'unavailable', raceId: 'r', reason: 'failed' }))).toEqual({ kind: 'hidden' });
    expect(selectCourseTerrainDisplay(entry({ ...terrain, segments: [] }))).toEqual({ kind: 'hidden' });
    expect(selectCourseTerrainDisplay(entry(terrain))).toEqual({ kind: 'ready', terrain });
  });
});

describe('course terrain band geometry', () => {
  it('scales the GPX axis to the profile axis', () => {
    const scaled = courseTerrainSegmentsOnAxis(terrain, 20);
    expect(scaled.map((segment) => [segment.fromKm, segment.toKm])).toEqual([[0, 4], [4, 10], [10, 18], [18, 20]]);
    expect(courseTerrainSegmentsOnAxis(terrain, null)).toBe(segments);
  });

  it('maps segments to pixels with the curve mapping and flags off_path as hatched', () => {
    const rects = buildCourseTerrainBandRects(segments, { fromKm: 0, toKm: 10, x: 12, width: 100 });
    expect(rects.map((rect) => [rect.class, rect.x, rect.width, rect.hatched])).toEqual([
      ['road', 12, 20, false],
      ['track', 32, 30, false],
      ['trail', 62, 40, false],
      ['off_path', 102, 10, true],
    ]);
    expect(rects[0].color).toBe(COURSE_TERRAIN_CLASS_COLORS.road);
  });

  it('clips to a section range', () => {
    const rects = buildCourseTerrainBandRects(segments, { fromKm: 4, toKm: 6, x: 0, width: 100 });
    expect(rects.map((rect) => [rect.class, rect.x, rect.width])).toEqual([['track', 0, 50], ['trail', 50, 50]]);
    expect(buildCourseTerrainBandRects(segments, { fromKm: 6, toKm: 6, x: 0, width: 100 })).toEqual([]);
  });
});

describe('course terrain summary text', () => {
  it('lists course shares largest first in whole percents', () => {
    const shares = courseTerrainSummaryShares(terrain.summary);
    expect(shares).toEqual([
      { class: 'trail', pct: 40 },
      { class: 'track', pct: 30 },
      { class: 'road', pct: 20 },
      { class: 'off_path', pct: 10 },
    ]);
    expect(formatCourseTerrainShares(shares, labels, '{pct} % {label}')).toBe('40 % sentier · 30 % piste · 20 % route · 10 % hors chemin');
    expect(formatCourseTerrainShares(shares.slice(0, 1), { ...labels, trail: 'trail' }, '{pct}% {label}')).toBe('40% trail');
  });

  it('drops shares rounding to 0 %', () => {
    const summary = summarizeCourseTerrain([
      { fromKm: 0, toKm: 99.7, class: 'trail', surface: null, source: 'osm' },
      { fromKm: 99.7, toKm: 100, class: 'road', surface: null, source: 'osm' },
    ], 100);
    expect(courseTerrainSummaryShares(summary)).toEqual([{ class: 'trail', pct: 100 }]);
  });

  it('splits one plan section by class', () => {
    expect(courseTerrainSectionShares(segments, 4, 6)).toEqual([{ class: 'track', pct: 50 }, { class: 'trail', pct: 50 }]);
    expect(courseTerrainSectionShares(segments, 6, 6)).toEqual([]);
  });
});
