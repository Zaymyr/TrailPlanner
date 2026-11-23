"use client";

import { useEffect, useState } from "react";
import type { CourseWeatherResponse } from "@trailplanner/shared";

// Typed client of `GET /api/race-weather?raceId=<uuid>`. Display-only data: it never feeds the
// pacing or nutrition calculations. The planner does not mount a QueryClientProvider, so this hook
// uses a small module cache (honouring the provider `expiresAt`) instead of TanStack Query.

const NON_FORECAST_TTL_MS = 5 * 60_000;
const MIN_FORECAST_TTL_MS = 60_000;

export const COURSE_WEATHER_ENDPOINT = "/api/race-weather";

export async function fetchCourseWeather(raceId: string, signal?: AbortSignal): Promise<CourseWeatherResponse> {
  const response = await fetch(`${COURSE_WEATHER_ENDPOINT}?raceId=${encodeURIComponent(raceId)}`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`race-weather responded ${response.status}`);
  const body = (await response.json()) as Partial<CourseWeatherResponse> | null;
  if (!body || (body.status !== "forecast" && body.status !== "too_early" && body.status !== "unavailable")) {
    throw new Error("race-weather returned an unexpected payload");
  }
  return body as CourseWeatherResponse;
}

type CacheEntry = { response: CourseWeatherResponse; validUntil: number };
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<CourseWeatherResponse>>();

function ttlFor(response: CourseWeatherResponse, now: number): number {
  if (response.status !== "forecast") return NON_FORECAST_TTL_MS;
  const expires = Date.parse(response.expiresAt);
  return Number.isFinite(expires) ? Math.max(MIN_FORECAST_TTL_MS, expires - now) : NON_FORECAST_TTL_MS;
}

function loadCourseWeather(raceId: string): Promise<CourseWeatherResponse> {
  const existing = inFlight.get(raceId);
  if (existing) return existing;
  const request = fetchCourseWeather(raceId)
    .then((response) => {
      const now = Date.now();
      cache.set(raceId, { response, validUntil: now + ttlFor(response, now) });
      return response;
    })
    .finally(() => inFlight.delete(raceId));
  inFlight.set(raceId, request);
  return request;
}

export type CourseWeatherQuery =
  | { status: "idle" | "loading" | "error"; data: null }
  | { status: "ready"; data: CourseWeatherResponse };

/** Loads the race weather for a catalog race; `raceId` null/undefined keeps the hook idle. */
export function useCourseWeather(raceId: string | null | undefined): CourseWeatherQuery {
  const [state, setState] = useState<{ raceId: string | null; query: CourseWeatherQuery }>({
    raceId: null,
    query: { status: "idle", data: null },
  });

  useEffect(() => {
    if (!raceId) return;
    let cancelled = false;
    const cached = cache.get(raceId);
    if (cached && cached.validUntil > Date.now()) {
      setState({ raceId, query: { status: "ready", data: cached.response } });
      return;
    }
    setState({ raceId, query: { status: "loading", data: null } });
    loadCourseWeather(raceId)
      .then((response) => {
        if (!cancelled) setState({ raceId, query: { status: "ready", data: response } });
      })
      .catch(() => {
        if (!cancelled) setState({ raceId, query: { status: "error", data: null } });
      });
    return () => {
      cancelled = true;
    };
  }, [raceId]);

  if (!raceId) return { status: "idle", data: null };
  return state.raceId === raceId ? state.query : { status: "loading", data: null };
}
