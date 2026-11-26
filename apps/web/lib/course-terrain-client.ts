"use client";

import { useEffect, useState } from "react";
import type { CourseTerrainResponse } from "@trailplanner/shared";

// Typed client of `GET /api/race-terrain?raceId=<uuid>`. Display-only data: it never feeds the
// pacing or nutrition calculations. Same style as course-weather-client (no QueryClientProvider in
// the planner): a module cache. Terrain changes rarely, so `ready` is kept longer than `pending`.

const READY_TTL_MS = 30 * 60_000;
const PENDING_TTL_MS = 30_000;
const UNAVAILABLE_TTL_MS = 5 * 60_000;

export const COURSE_TERRAIN_ENDPOINT = "/api/race-terrain";

export async function fetchCourseTerrain(raceId: string, signal?: AbortSignal): Promise<CourseTerrainResponse> {
  const response = await fetch(`${COURSE_TERRAIN_ENDPOINT}?raceId=${encodeURIComponent(raceId)}`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`race-terrain responded ${response.status}`);
  const body = (await response.json()) as Partial<CourseTerrainResponse> | null;
  if (!body || (body.status !== "ready" && body.status !== "pending" && body.status !== "unavailable")) {
    throw new Error("race-terrain returned an unexpected payload");
  }
  return body as CourseTerrainResponse;
}

type CacheEntry = { response: CourseTerrainResponse; validUntil: number };
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<CourseTerrainResponse>>();

export function courseTerrainTtlMs(response: CourseTerrainResponse): number {
  if (response.status === "ready") return READY_TTL_MS;
  return response.status === "pending" ? PENDING_TTL_MS : UNAVAILABLE_TTL_MS;
}

function loadCourseTerrain(raceId: string): Promise<CourseTerrainResponse> {
  const existing = inFlight.get(raceId);
  if (existing) return existing;
  const request = fetchCourseTerrain(raceId)
    .then((response) => {
      cache.set(raceId, { response, validUntil: Date.now() + courseTerrainTtlMs(response) });
      return response;
    })
    .finally(() => inFlight.delete(raceId));
  inFlight.set(raceId, request);
  return request;
}

export type CourseTerrainQuery =
  | { status: "idle" | "loading" | "error"; data: null }
  | { status: "ready"; data: CourseTerrainResponse };

/** Loads the terrain of a catalog race; `raceId` null/undefined keeps the hook idle. */
export function useCourseTerrain(raceId: string | null | undefined): CourseTerrainQuery {
  const [state, setState] = useState<{ raceId: string | null; query: CourseTerrainQuery }>({
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
    loadCourseTerrain(raceId)
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
