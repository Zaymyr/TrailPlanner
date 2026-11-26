// Wiring of the course terrain feature: public read, GPX loading and cron dependencies.
// Display-only (docs/03-business-rules/course-terrain.md).

import type { CourseTerrainResponse } from "@trailplanner/shared";
import { z } from "zod";

import { isRaceRunnerVisible, RUNNER_VISIBILITY_RACE_COLUMNS } from "../race-runner-visibility";
import type { SupabaseServiceConfig } from "../supabase";
import { invalidateCourseTerrainCache } from "./cache";
import type { CourseTerrainJobDeps } from "./job";
import { fetchOverpassWays } from "./overpass";
import { toCourseTerrainResponse } from "./response";
import { createCourseTerrainStore } from "./store";

const eventSchema = z.object({ is_live: z.boolean().nullable().optional() });

const raceSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid().nullable(),
  edition_id: z.string().uuid().nullable().optional(),
  gpx_storage_path: z.string().nullable().optional(),
  is_public: z.boolean().nullable().optional(),
  is_live: z.boolean().nullable().optional(),
  racebook_preview_is_visible: z.boolean().nullable().optional(),
  race_events: z.union([eventSchema, z.array(eventSchema)]).nullable().optional(),
});

const RACE_COLUMNS = [...RUNNER_VISIBILITY_RACE_COLUMNS, "gpx_storage_path", "race_events(is_live)"].join(",");

const serviceHeaders = (config: SupabaseServiceConfig) => ({
  apikey: config.supabaseServiceRoleKey,
  Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
});

export type PublicCourseTerrainResult = { kind: "not_found" } | { kind: "response"; body: CourseTerrainResponse };

/** `GET /api/race-terrain`: same runner visibility as `/api/race-weather`. */
export async function buildPublicCourseTerrain(config: SupabaseServiceConfig, raceId: string): Promise<PublicCourseTerrainResult> {
  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/races?id=eq.${encodeURIComponent(raceId)}&select=${RACE_COLUMNS}&limit=1`,
    { headers: serviceHeaders(config), cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Supabase read failed (${response.status})`);
  const [race] = z.array(raceSchema).parse(await response.json());
  if (!race) return { kind: "not_found" };
  const event = Array.isArray(race.race_events) ? race.race_events[0] ?? null : race.race_events ?? null;
  if (!(await isRaceRunnerVisible(config, race, event))) return { kind: "not_found" };
  const row = await createCourseTerrainStore(config).getRow(raceId);
  return { kind: "response", body: toCourseTerrainResponse(raceId, row, Boolean(race.gpx_storage_path)) };
}

/** GPX text from the private `race-gpx` bucket (versioned paths: bytes behind a path never change). */
export async function loadRaceGpxText(config: SupabaseServiceConfig, storagePath: string): Promise<string | null> {
  try {
    const response = await fetch(`${config.supabaseUrl}/storage/v1/object/race-gpx/${encodeURI(storagePath)}`, {
      headers: serviceHeaders(config),
      cache: "no-store",
    });
    return response.ok ? await response.text() : null;
  } catch (cause) {
    console.warn("Course terrain: GPX unavailable", cause);
    return null;
  }
}

export function createCourseTerrainJobDeps(config: SupabaseServiceConfig): CourseTerrainJobDeps {
  return {
    store: createCourseTerrainStore(config),
    loadGpx: (storagePath) => loadRaceGpxText(config, storagePath),
    fetchWays: (bbox, deadline) => fetchOverpassWays(bbox, { deadline }),
    now: Date.now,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    onReady: invalidateCourseTerrainCache,
  };
}
