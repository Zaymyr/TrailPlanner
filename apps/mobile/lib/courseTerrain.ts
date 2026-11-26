/**
 * Mobile side of "course terrain" (lot 2): fetch of `GET /api/race-terrain`, cache freshness, the
 * display state and the pure band / summary building used by the Livret coureur profile and the
 * plan section cards. Display-only: nothing here feeds pacing or nutrition
 * (docs/03-business-rules/course-terrain.md). The file-system device copy lives in
 * `components/course-terrain/useCourseTerrain.ts`; this file stays runtime-agnostic so it can be tested.
 */
import {
  COURSE_TERRAIN_CLASSES,
  COURSE_TERRAIN_CLASS_COLORS,
  courseTerrainBetween,
  scaleCourseTerrainSegments,
  type CourseTerrain,
  type CourseTerrainClass,
  type CourseTerrainResponse,
  type CourseTerrainSegment,
  type CourseTerrainSummary,
} from './courseTerrainShared';
import { WEB_API_BASE_URL } from './webApi';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
/** A computed terrain is long-lived: refreshed at most once a day. */
const READY_TTL_MS = 24 * HOUR_MS;
/** A pending computation is re-asked after 15 min. */
const PENDING_TTL_MS = 15 * MINUTE_MS;
/** An "unavailable" answer is re-asked after 6 h. */
const UNAVAILABLE_TTL_MS = 6 * HOUR_MS;

export type CourseTerrainEntry = {
  response: CourseTerrainResponse;
  /** ISO time of the network load that produced the entry (device copy `savedAt`). */
  savedAt: string;
};

export type CourseTerrainFetchOutcome =
  | { kind: 'ok'; response: CourseTerrainResponse }
  /** Authoritative refusal (HTTP 4xx): the race has no terrain, drop any copy. */
  | { kind: 'gone' }
  /** Network failure, timeout or 5xx: keep the last good copy. */
  | { kind: 'unreachable' };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Minimal shape check of an API answer; anything else is treated as unreachable. */
export function isCourseTerrainResponse(value: unknown): value is CourseTerrainResponse {
  if (!isRecord(value) || typeof value.raceId !== 'string') return false;
  if (value.status === 'ready') {
    return typeof value.distanceKm === 'number' && Array.isArray(value.segments) && isRecord(value.summary)
      && typeof value.computedAt === 'string';
  }
  if (value.status === 'pending') return true;
  return value.status === 'unavailable';
}

export function buildCourseTerrainUrl(raceId: string, baseUrl: string = WEB_API_BASE_URL): string {
  return `${baseUrl}/api/race-terrain?raceId=${encodeURIComponent(raceId)}`;
}

export async function fetchCourseTerrain(
  raceId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CourseTerrainFetchOutcome> {
  try {
    const response = await fetchImpl(buildCourseTerrainUrl(raceId), { headers: { Accept: 'application/json' } });
    if (response.status >= 500) return { kind: 'unreachable' };
    if (!response.ok) return { kind: 'gone' };
    const payload: unknown = await response.json();
    return isCourseTerrainResponse(payload) ? { kind: 'ok', response: payload } : { kind: 'unreachable' };
  } catch {
    return { kind: 'unreachable' };
  }
}

/** Instant (ms) before which the entry must not be refetched. */
export function courseTerrainRefreshAt(entry: CourseTerrainEntry): number {
  const savedAt = Date.parse(entry.savedAt);
  const base = Number.isFinite(savedAt) ? savedAt : 0;
  const status = entry.response.status;
  if (status === 'ready') return base + READY_TTL_MS;
  if (status === 'pending') return base + PENDING_TTL_MS;
  return base + UNAVAILABLE_TTL_MS;
}

export function isCourseTerrainEntryFresh(entry: CourseTerrainEntry, now: Date = new Date()): boolean {
  return now.getTime() < courseTerrainRefreshAt(entry);
}

export type CourseTerrainResolution = {
  entry: CourseTerrainEntry | null;
  /** Device copy action: only a `ready` answer is written; the last good copy is never overwritten by a transient state. */
  persist: 'write' | 'remove' | 'keep';
};

/**
 * Merges a refresh outcome with the entry already shown. A `ready` answer replaces the copy; a
 * `pending` answer is shown but leaves the device copy alone; a failed computation keeps the last
 * good terrain; an authoritative refusal (4xx, `no_route`) drops it; a network failure keeps
 * whatever was shown.
 */
export function resolveCourseTerrainRefresh(
  previous: CourseTerrainEntry | null,
  outcome: CourseTerrainFetchOutcome,
  now: Date = new Date(),
): CourseTerrainResolution {
  if (outcome.kind === 'unreachable') return { entry: previous, persist: 'keep' };
  if (outcome.kind === 'gone') return { entry: null, persist: 'remove' };
  const entry: CourseTerrainEntry = { response: outcome.response, savedAt: now.toISOString() };
  const { response } = outcome;
  if (response.status === 'ready') return { entry, persist: 'write' };
  if (response.status === 'pending') return { entry, persist: 'keep' };
  if (response.reason === 'failed' && previous?.response.status === 'ready') return { entry: previous, persist: 'keep' };
  return { entry, persist: response.reason === 'no_route' ? 'remove' : 'keep' };
}

export type CourseTerrainDisplayState =
  | { kind: 'hidden' }
  | { kind: 'pending' }
  | { kind: 'ready'; terrain: CourseTerrain };

/** What the profile shows: nothing for `unavailable` or an empty terrain, a discreet note while pending. */
export function selectCourseTerrainDisplay(entry: CourseTerrainEntry | null): CourseTerrainDisplayState {
  const response = entry?.response;
  if (!response) return { kind: 'hidden' };
  if (response.status === 'pending') return { kind: 'pending' };
  if (response.status !== 'ready' || response.segments.length === 0 || !(response.distanceKm > 0)) return { kind: 'hidden' };
  return { kind: 'ready', terrain: response };
}

/**
 * Terrain segments on another distance axis (the profile chart or the plan stations): the GPX
 * distance of the terrain is stretched to `axisKm`. Unchanged when `axisKm` is unknown.
 */
export function courseTerrainSegmentsOnAxis(
  terrain: Pick<CourseTerrain, 'segments' | 'distanceKm'>,
  axisKm: number | null | undefined,
): CourseTerrainSegment[] {
  if (typeof axisKm !== 'number' || !(axisKm > 0)) return terrain.segments;
  return scaleCourseTerrainSegments(terrain.segments, terrain.distanceKm, axisKm);
}

export type CourseTerrainBandRect = {
  key: string;
  class: CourseTerrainClass;
  x: number;
  width: number;
  color: string;
  /** `off_path` is drawn hatched: no mapped path there, not a real surface. */
  hatched: boolean;
};

/**
 * Rectangles of a terrain band drawn over `[fromKm, toKm]` between `x` and `x + width` (px), the
 * same mapping as the profile curve above it. Segments are clipped to the range.
 */
export function buildCourseTerrainBandRects(
  segments: CourseTerrainSegment[],
  range: { fromKm: number; toKm: number; x: number; width: number },
): CourseTerrainBandRect[] {
  const span = range.toKm - range.fromKm;
  if (!(span > 0) || !(range.width > 0)) return [];
  const xFor = (km: number) => range.x + ((km - range.fromKm) / span) * range.width;
  return segments.flatMap((segment, index) => {
    const from = Math.max(range.fromKm, segment.fromKm);
    const to = Math.min(range.toKm, segment.toKm);
    if (!(to > from)) return [];
    const x = xFor(from);
    return [{
      key: `${index}-${segment.class}`,
      class: segment.class,
      x,
      width: Math.max(0.5, xFor(to) - x),
      color: COURSE_TERRAIN_CLASS_COLORS[segment.class],
      hatched: segment.class === 'off_path',
    }];
  });
}

export type CourseTerrainShare = { class: CourseTerrainClass; pct: number };

const classOrder = (terrainClass: CourseTerrainClass) => COURSE_TERRAIN_CLASSES.indexOf(terrainClass);

/** Whole percents, largest first; shares rounding to 0 % are dropped. */
function toShares(entries: Array<{ class: CourseTerrainClass; pct: number }>): CourseTerrainShare[] {
  return entries
    .map((entry) => ({ class: entry.class, pct: Math.round(entry.pct) }))
    .filter((entry) => entry.pct > 0)
    .sort((a, b) => b.pct - a.pct || classOrder(a.class) - classOrder(b.class));
}

/** Course-wide shares from the API summary. */
export function courseTerrainSummaryShares(summary: CourseTerrainSummary): CourseTerrainShare[] {
  return toShares(COURSE_TERRAIN_CLASSES.map((terrainClass) => ({ class: terrainClass, pct: summary[terrainClass]?.pct ?? 0 })));
}

/** Shares of one km range (a plan section) on the segments' axis. */
export function courseTerrainSectionShares(
  segments: CourseTerrainSegment[],
  fromKm: number,
  toKm: number,
): CourseTerrainShare[] {
  const span = toKm - fromKm;
  if (!(span > 0)) return [];
  return toShares(courseTerrainBetween(segments, fromKm, toKm).map((entry) => ({ class: entry.class, pct: (entry.km / span) * 100 })));
}

/**
 * `48 % sentier · 28 % piste · 24 % route`. `template` holds `{pct}` and `{label}` (French puts a
 * space before %, English does not).
 */
export function formatCourseTerrainShares(
  shares: CourseTerrainShare[],
  labels: Record<CourseTerrainClass, string>,
  template: string,
): string {
  return shares
    .map((share) => template.replace('{pct}', String(share.pct)).replace('{label}', labels[share.class]))
    .join(' · ');
}
