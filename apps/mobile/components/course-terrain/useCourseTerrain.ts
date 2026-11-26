import { useEffect, useState } from 'react';

import {
  fetchCourseTerrain,
  isCourseTerrainEntryFresh,
  resolveCourseTerrainRefresh,
  selectCourseTerrainDisplay,
  type CourseTerrainDisplayState,
  type CourseTerrainEntry,
} from '../../lib/courseTerrain';
import type { CourseTerrainResponse } from '../../lib/courseTerrainShared';
import { readOfflineCache, removeOfflineCache, writeOfflineCache } from '../../lib/offlineCache';

/** Entries already loaded in this app session, shared by every screen showing the same race. */
const memoryCache = new Map<string, CourseTerrainEntry>();
/** One request per race at a time, even when the Livret and the plan mount together. */
const inFlight = new Map<string, Promise<CourseTerrainEntry | null>>();

async function loadCourseTerrain(raceId: string): Promise<CourseTerrainEntry | null> {
  let previous = memoryCache.get(raceId) ?? null;
  if (!previous) {
    const stored = await readOfflineCache<CourseTerrainResponse>('course-terrain', raceId);
    previous = stored ? { response: stored.data, savedAt: stored.savedAt } : null;
  }
  // A computed terrain is long-lived: at most one request a day.
  if (previous && isCourseTerrainEntryFresh(previous)) {
    memoryCache.set(raceId, previous);
    return previous;
  }
  const resolution = resolveCourseTerrainRefresh(previous, await fetchCourseTerrain(raceId));
  if (resolution.persist === 'write' && resolution.entry) {
    void writeOfflineCache<CourseTerrainResponse>('course-terrain', raceId, resolution.entry.response);
  } else if (resolution.persist === 'remove') {
    void removeOfflineCache('course-terrain', raceId);
  }
  if (resolution.entry) memoryCache.set(raceId, resolution.entry);
  else memoryCache.delete(raceId);
  return resolution.entry;
}

/**
 * Course terrain of one catalog race: memory → device copy → `GET /api/race-terrain`. The last
 * computed terrain stays readable offline. Returns the display state (`hidden` / `pending` / `ready`).
 */
export function useCourseTerrain(raceId: string | null | undefined): CourseTerrainDisplayState {
  const [state, setState] = useState<{ raceId: string | null; entry: CourseTerrainEntry | null }>(() => ({
    raceId: raceId ?? null,
    entry: raceId ? memoryCache.get(raceId) ?? null : null,
  }));

  useEffect(() => {
    if (!raceId) {
      setState({ raceId: null, entry: null });
      return;
    }
    let cancelled = false;
    let request = inFlight.get(raceId);
    if (!request) {
      request = loadCourseTerrain(raceId).finally(() => inFlight.delete(raceId));
      inFlight.set(raceId, request);
    }
    request
      .then((entry) => {
        if (!cancelled) setState({ raceId, entry });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [raceId]);

  return selectCourseTerrainDisplay(state.raceId === (raceId ?? null) ? state.entry : null);
}
