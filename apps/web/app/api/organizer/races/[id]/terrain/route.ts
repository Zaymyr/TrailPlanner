import { COURSE_TERRAIN_CLASSES, COURSE_TERRAIN_MAX_OVERRIDES, type CourseTerrainClass } from "@trailplanner/shared";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { invalidateCourseTerrainCache } from "../../../../../../lib/course-terrain/cache";
import { toOrganizerCourseTerrain } from "../../../../../../lib/course-terrain/response";
import { loadRaceGpxText } from "../../../../../../lib/course-terrain/service";
import { createCourseTerrainStore } from "../../../../../../lib/course-terrain/store";
import { parseGpx } from "../../../../../../lib/gpx/parseGpx";
import { withSecurityHeaders } from "../../../../../../lib/http";
import {
  jsonError,
  loadRaceForOrganizer,
  requireOrganizerAuth,
  serviceHeaders,
  uuidParamSchema,
} from "../../../../../../lib/organizer";
import type { SupabaseServiceConfig } from "../../../../../../lib/supabase";

/** Tolerance on the GPX distance (rounding of the editor's km inputs). */
const DISTANCE_TOLERANCE_KM = 0.05;

const raceGpxSchema = z.object({ gpx_storage_path: z.string().nullable().optional(), gpx_sha256: z.string().nullable().optional() });

const overrideSchema = z
  .object({
    fromKm: z.number().finite().nonnegative(),
    toKm: z.number().finite().nonnegative(),
    class: z.enum(COURSE_TERRAIN_CLASSES as [CourseTerrainClass, ...CourseTerrainClass[]]),
  })
  .refine((override) => override.fromKm < override.toKm, { message: "fromKm must be lower than toKm." });

const overridesInputSchema = z.object({ overrides: z.array(overrideSchema).max(COURSE_TERRAIN_MAX_OVERRIDES) });

const roundKm = (value: number) => Math.round(value * 1000) / 1000;

async function loadRaceGpx(config: SupabaseServiceConfig, raceId: string) {
  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/races?id=eq.${raceId}&select=gpx_storage_path,gpx_sha256&limit=1`,
    { headers: serviceHeaders(config, ""), cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Unable to load race GPX (${response.status})`);
  const [race] = z.array(raceGpxSchema).parse(await response.json());
  return { path: race?.gpx_storage_path ?? null, sha: race?.gpx_sha256 ?? null };
}

async function authorize(request: NextRequest, params: { id?: string }) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth;
  const parsedParams = uuidParamSchema.safeParse(params);
  if (!parsedParams.success) return { error: jsonError("Invalid race id.", 400) };
  const race = await loadRaceForOrganizer(auth.serviceConfig, auth.user, parsedParams.data.id);
  if ("error" in race) return race;
  return { auth, race };
}

/** Terrain as the organizer edits it: OSM segments, overrides, and the runner-facing result. */
export async function GET(request: NextRequest, context: { params: { id?: string } }) {
  const authorized = await authorize(request, context.params);
  if ("error" in authorized) return authorized.error;
  const { auth, race } = authorized;
  try {
    const gpx = await loadRaceGpx(auth.serviceConfig, race.id);
    const row = await createCourseTerrainStore(auth.serviceConfig).getRow(race.id);
    return withSecurityHeaders(NextResponse.json(toOrganizerCourseTerrain(race.id, row, Boolean(gpx.path))));
  } catch (cause) {
    console.error("Unable to load organizer course terrain", cause);
    return jsonError("Unable to load course terrain.", 502);
  }
}

/** Replaces the organizer overrides (they win over OSM). Allowed while the terrain is pending. */
export async function PUT(request: NextRequest, context: { params: { id?: string } }) {
  const authorized = await authorize(request, context.params);
  if ("error" in authorized) return authorized.error;
  const { auth, race } = authorized;
  // Same rule as the GPX upload of the course (organizer of the event, no section toggle):
  // switching off Ravitos must not block terrain corrections.

  const parsedBody = overridesInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) return jsonError("Invalid terrain overrides.", 400);

  try {
    const store = createCourseTerrainStore(auth.serviceConfig);
    const [gpx, existing] = await Promise.all([loadRaceGpx(auth.serviceConfig, race.id), store.getRow(race.id)]);
    if (!gpx.path) return jsonError("This race has no GPX available.", 409);

    let distanceKm = existing?.status === "ready" && existing.gpx_storage_path === gpx.path ? existing.distance_km : null;
    if (distanceKm === null) {
      const text = await loadRaceGpxText(auth.serviceConfig, gpx.path);
      if (text === null) return jsonError("Unable to read race GPX.", 502);
      const points = parseGpx(text).points;
      distanceKm = points.at(-1)?.distKmCum ?? 0;
    }
    const maxKm = distanceKm + DISTANCE_TOLERANCE_KM;
    const overrides = parsedBody.data.overrides.map((override) => ({
      fromKm: roundKm(override.fromKm),
      toKm: roundKm(Math.min(override.toKm, distanceKm!)),
      class: override.class,
    }));
    if (parsedBody.data.overrides.some((override) => override.toKm > maxKm) || overrides.some((o) => !(o.toKm > o.fromKm))) {
      return jsonError("Terrain overrides must stay within the GPX distance.", 400);
    }

    const patch = {
      organizer_overrides: overrides,
      overrides_gpx_sha256: gpx.sha,
      overrides_updated_at: new Date().toISOString(),
      overrides_updated_by: auth.user.id,
    };
    let row = await store.updateOverrides(race.id, patch);
    if (!row) {
      await store.insertRow({ race_id: race.id, gpx_storage_path: gpx.path, gpx_sha256: gpx.sha, status: "pending", ...patch });
      row = await store.updateOverrides(race.id, patch);
    }
    await invalidateCourseTerrainCache(race.id);
    return withSecurityHeaders(NextResponse.json(toOrganizerCourseTerrain(race.id, row, true)));
  } catch (cause) {
    console.error("Unable to save organizer course terrain", cause);
    return jsonError("Unable to save course terrain.", 502);
  }
}
