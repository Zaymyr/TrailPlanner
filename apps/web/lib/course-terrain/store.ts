// Service-role access to public.race_course_terrain (RLS on, no client policy).

import {
  isCourseTerrainClass,
  type CourseTerrainClass,
  type CourseTerrainCoverage,
  type CourseTerrainOverride,
  type CourseTerrainSegment,
} from "@trailplanner/shared";
import { z } from "zod";

import type { SupabaseServiceConfig } from "../supabase";
import { COURSE_TERRAIN_RULES_VERSION } from "./classify";

export const COURSE_TERRAIN_STATUSES = ["pending", "processing", "ready", "failed", "no_route"] as const;
export type CourseTerrainRowStatus = (typeof COURSE_TERRAIN_STATUSES)[number];

const terrainClassSchema = z.custom<CourseTerrainClass>(isCourseTerrainClass);

const segmentSchema = z.object({
  fromKm: z.number(),
  toKm: z.number(),
  class: terrainClassSchema,
  surface: z.string().nullable().optional().transform((value) => value ?? null),
  source: z.enum(["osm", "organizer"]).optional().transform((value) => value ?? "osm"),
});

const overrideSchema = z.object({ fromKm: z.number(), toKm: z.number(), class: terrainClassSchema });

const coverageSchema = z.object({ matchedPct: z.number(), surfaceTagPct: z.number(), sacScaleTagPct: z.number() });

/** Invalid stored JSON degrades to the fallback instead of breaking the routes. */
function lenient<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, fallback: T) {
  return z.unknown().transform((value): T => {
    const parsed = schema.safeParse(value);
    return parsed.success ? parsed.data : fallback;
  });
}

export const courseTerrainRowSchema = z.object({
  race_id: z.string().uuid(),
  gpx_storage_path: z.string().nullable(),
  gpx_sha256: z.string().nullable(),
  status: z.enum(COURSE_TERRAIN_STATUSES),
  attempts: z.number().int(),
  next_attempt_at: z.string(),
  last_error: z.string().nullable().optional().transform((value) => value ?? null),
  rules_version: z.number().int().nullable().optional().transform((value) => value ?? null),
  distance_km: z.number().nullable().optional().transform((value) => value ?? null),
  osm_segments: lenient<CourseTerrainSegment[] | null>(z.array(segmentSchema).nullable(), null),
  coverage: lenient<CourseTerrainCoverage | null>(coverageSchema.nullable(), null),
  computed_at: z.string().nullable().optional().transform((value) => value ?? null),
  progress: z.unknown().optional().transform((value) => value ?? null),
  organizer_overrides: lenient<CourseTerrainOverride[]>(z.array(overrideSchema), []),
  overrides_gpx_sha256: z.string().nullable().optional().transform((value) => value ?? null),
  overrides_updated_at: z.string().nullable().optional().transform((value) => value ?? null),
});

export type CourseTerrainRow = z.output<typeof courseTerrainRowSchema>;

export const COURSE_TERRAIN_ROW_COLUMNS = [
  "race_id", "gpx_storage_path", "gpx_sha256", "status", "attempts", "next_attempt_at", "last_error", "rules_version",
  "distance_km", "osm_segments", "coverage", "computed_at", "progress", "organizer_overrides", "overrides_gpx_sha256",
  "overrides_updated_at",
].join(",");

/** Same row without the (possibly large) resumable progress, for the read routes. */
export const COURSE_TERRAIN_READ_COLUMNS = COURSE_TERRAIN_ROW_COLUMNS.replace(",progress", "");

export type CourseTerrainRowPatch = Partial<{
  status: CourseTerrainRowStatus;
  attempts: number;
  next_attempt_at: string;
  last_error: string | null;
  rules_version: number | null;
  distance_km: number | null;
  osm_segments: CourseTerrainSegment[] | null;
  coverage: CourseTerrainCoverage | null;
  computed_at: string | null;
  progress: unknown;
  organizer_overrides: CourseTerrainOverride[];
  overrides_gpx_sha256: string | null;
  overrides_updated_at: string | null;
  overrides_updated_by: string | null;
}>;

export type CourseTerrainInsert = {
  race_id: string;
  gpx_storage_path: string | null;
  gpx_sha256: string | null;
  status: CourseTerrainRowStatus;
} & CourseTerrainRowPatch;

export type CourseTerrainStore = {
  getRow(raceId: string): Promise<CourseTerrainRow | null>;
  /** Oldest due row: pending/processing, or ready with an older rules version. */
  findDueRow(nowIso: string): Promise<CourseTerrainRow | null>;
  /** Optimistic lease: moves next_attempt_at only if nobody else did. Returns the claimed row or null. */
  claimRow(row: CourseTerrainRow, leaseUntilIso: string): Promise<CourseTerrainRow | null>;
  /** Writes `patch` only while the row still targets `gpxStoragePath`; false when the GPX changed. */
  updateRow(raceId: string, gpxStoragePath: string | null, patch: CourseTerrainRowPatch): Promise<boolean>;
  /** Inserts a fresh row; false when one already exists. */
  insertRow(row: CourseTerrainInsert): Promise<boolean>;
  /** Writes only the given (organizer override) columns; null when no row exists. */
  updateOverrides(raceId: string, patch: CourseTerrainRowPatch): Promise<CourseTerrainRow | null>;
};

const headers = (config: SupabaseServiceConfig, extra: Record<string, string> = {}) => ({
  apikey: config.supabaseServiceRoleKey,
  Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
  "Content-Type": "application/json",
  ...extra,
});

const eq = (value: string) => `eq.${encodeURIComponent(value)}`;
const pathFilter = (path: string | null) => (path === null ? "is.null" : eq(path));
const firstRow = (rows: unknown[]) => (rows[0] === undefined ? null : courseTerrainRowSchema.parse(rows[0]));

export function createCourseTerrainStore(config: SupabaseServiceConfig): CourseTerrainStore {
  const base = `${config.supabaseUrl}/rest/v1/race_course_terrain`;
  const readRows = async (query: string): Promise<unknown[]> => {
    const response = await fetch(`${base}?${query}`, { headers: headers(config), cache: "no-store" });
    if (!response.ok) throw new Error(`race_course_terrain read failed (${response.status})`);
    return z.array(z.unknown()).parse(await response.json());
  };
  const patchRows = async (query: string, patch: CourseTerrainRowPatch): Promise<unknown[]> => {
    const response = await fetch(`${base}?${query}`, {
      method: "PATCH",
      headers: headers(config, { Prefer: "return=representation" }),
      body: JSON.stringify(patch),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`race_course_terrain update failed (${response.status})`);
    return z.array(z.unknown()).parse(await response.json());
  };

  return {
    async getRow(raceId) {
      return firstRow(await readRows(`race_id=${eq(raceId)}&select=${COURSE_TERRAIN_READ_COLUMNS}&limit=1`));
    },
    async findDueRow(nowIso) {
      return firstRow(
        await readRows(
          `select=${COURSE_TERRAIN_ROW_COLUMNS}&next_attempt_at=lte.${encodeURIComponent(nowIso)}` +
            `&or=(status.in.(pending,processing),and(status.eq.ready,rules_version.lt.${COURSE_TERRAIN_RULES_VERSION}))` +
            `&order=next_attempt_at.asc&limit=1`,
        ),
      );
    },
    async claimRow(row, leaseUntilIso) {
      return firstRow(
        await patchRows(
          `race_id=${eq(row.race_id)}&next_attempt_at=${eq(row.next_attempt_at)}&select=${COURSE_TERRAIN_ROW_COLUMNS}`,
          { next_attempt_at: leaseUntilIso },
        ),
      );
    },
    async updateRow(raceId, gpxStoragePath, patch) {
      const rows = await patchRows(`race_id=${eq(raceId)}&gpx_storage_path=${pathFilter(gpxStoragePath)}&select=race_id`, patch);
      return rows.length > 0;
    },
    async insertRow(row) {
      const response = await fetch(`${base}?on_conflict=race_id&select=race_id`, {
        method: "POST",
        headers: headers(config, { Prefer: "resolution=ignore-duplicates,return=representation" }),
        body: JSON.stringify(row),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`race_course_terrain insert failed (${response.status})`);
      const rows = z.array(z.unknown()).parse(await response.json());
      return rows.length > 0;
    },
    async updateOverrides(raceId, patch) {
      return firstRow(await patchRows(`race_id=${eq(raceId)}&select=${COURSE_TERRAIN_READ_COLUMNS}`, patch));
    },
  };
}
