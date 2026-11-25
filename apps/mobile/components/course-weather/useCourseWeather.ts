import { useEffect, useState } from 'react';

import {
  fetchCourseWeather,
  isCourseWeatherEntryFresh,
  resolveCourseWeatherRefresh,
  type CourseWeatherEntry,
} from '../../lib/courseWeather';
import type { CourseWeatherResponse } from '../../lib/courseWeatherShared';
import { readOfflineCache, removeOfflineCache, writeOfflineCache } from '../../lib/offlineCache';

/** Entries already loaded in this app session, shared by every screen showing the same race. */
const memoryCache = new Map<string, CourseWeatherEntry>();
/** One request per race at a time, even when the Livret and the plan mount together. */
const inFlight = new Map<string, Promise<{ entry: CourseWeatherEntry | null; stale: boolean }>>();

async function loadCourseWeather(raceId: string): Promise<{ entry: CourseWeatherEntry | null; stale: boolean }> {
  let previous = memoryCache.get(raceId) ?? null;
  if (!previous) {
    const stored = await readOfflineCache<CourseWeatherResponse>('course-weather', raceId);
    previous = stored ? { response: stored.data, savedAt: stored.savedAt } : null;
  }
  // `expiresAt` (MET Norway Expires) is honoured: no request before it.
  if (previous && isCourseWeatherEntryFresh(previous)) {
    memoryCache.set(raceId, previous);
    return { entry: previous, stale: false };
  }
  const resolution = resolveCourseWeatherRefresh(previous, await fetchCourseWeather(raceId));
  if (resolution.persist === 'write' && resolution.entry) {
    void writeOfflineCache<CourseWeatherResponse>('course-weather', raceId, resolution.entry.response);
  } else if (resolution.persist === 'remove') {
    void removeOfflineCache('course-weather', raceId);
  }
  if (resolution.entry && !resolution.stale) memoryCache.set(raceId, resolution.entry);
  else if (!resolution.entry) memoryCache.delete(raceId);
  return { entry: resolution.entry, stale: resolution.stale };
}

/**
 * Race weather for one catalog race: memory → device copy → `GET /api/race-weather`. The last
 * good forecast stays readable offline; `stale` says it could not be refreshed.
 */
export function useCourseWeather(raceId: string | null | undefined) {
  const [state, setState] = useState<{ raceId: string | null; entry: CourseWeatherEntry | null; stale: boolean }>(() => ({
    raceId: raceId ?? null,
    entry: raceId ? memoryCache.get(raceId) ?? null : null,
    stale: false,
  }));

  useEffect(() => {
    if (!raceId) {
      setState({ raceId: null, entry: null, stale: false });
      return;
    }
    let cancelled = false;
    let request = inFlight.get(raceId);
    if (!request) {
      request = loadCourseWeather(raceId).finally(() => inFlight.delete(raceId));
      inFlight.set(raceId, request);
    }
    request
      .then((result) => {
        if (!cancelled) setState({ raceId, ...result });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [raceId]);

  const current = state.raceId === (raceId ?? null) ? state : { entry: null, stale: false };
  return { entry: current.entry, stale: current.stale };
}
