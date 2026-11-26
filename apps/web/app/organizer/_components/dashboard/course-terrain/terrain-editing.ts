import {
  COURSE_TERRAIN_MAX_OVERRIDES,
  applyCourseTerrainOverrides,
  isCourseTerrainClass,
  summarizeCourseTerrain,
  type CourseTerrainClass,
  type CourseTerrainOverride,
  type CourseTerrainSegment,
  type CourseTerrainSummary,
  type OrganizerCourseTerrain,
} from "@trailplanner/shared";

export const COURSE_TERRAIN_CLASS_LABELS: Record<CourseTerrainClass, string> = {
  road: "Route",
  track: "Piste",
  trail: "Sentier",
  technical: "Sentier technique",
  off_path: "Hors chemin",
};

export const COURSE_TERRAIN_CLASS_OPTIONS = (Object.keys(COURSE_TERRAIN_CLASS_LABELS) as CourseTerrainClass[]).map((value) => ({
  value,
  label: COURSE_TERRAIN_CLASS_LABELS[value],
}));

const KM_TOLERANCE = 0.0005;
const MIN_RANGE_KM = 0.001;
const roundKm = (value: number) => Math.round(value * 1000) / 1000;

export class TerrainEditError extends Error {}

/** Organizer-owned ranges of a set of final segments, as a flat, non-overlapping override list. */
function flattenOrganizerSegments(segments: CourseTerrainSegment[]): CourseTerrainOverride[] {
  return segments
    .filter((segment) => segment.source === "organizer")
    .map((segment) => ({ fromKm: roundKm(segment.fromKm), toKm: roundKm(segment.toKm), class: segment.class }));
}

/** Class of the OSM segments when uniform over [fromKm, toKm], else null. */
function uniformOsmClass(osmSegments: CourseTerrainSegment[], fromKm: number, toKm: number): CourseTerrainClass | null {
  let found: CourseTerrainClass | null = null;
  let covered = 0;
  for (const segment of osmSegments) {
    const overlap = Math.min(toKm, segment.toKm) - Math.max(fromKm, segment.fromKm);
    if (overlap <= KM_TOLERANCE) continue;
    if (found && found !== segment.class) return null;
    found = segment.class;
    covered += overlap;
  }
  return covered >= toKm - fromKm - KM_TOLERANCE ? found : null;
}

/**
 * Canonical override list: flattened (no overlap, later wins), merged, and without ranges that merely
 * restate what OpenStreetMap already says.
 */
export function canonicalizeOverrides(
  osmSegments: CourseTerrainSegment[],
  overrides: CourseTerrainOverride[],
  distanceKm: number,
): CourseTerrainOverride[] {
  const flat = flattenOrganizerSegments(applyCourseTerrainOverrides(osmSegments, overrides, distanceKm));
  return flat.filter((override) => uniformOsmClass(osmSegments, override.fromKm, override.toKm) !== override.class);
}

export function validateOverrides(overrides: CourseTerrainOverride[], distanceKm: number): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (overrides.length > COURSE_TERRAIN_MAX_OVERRIDES) {
    errors.push(`Au plus ${COURSE_TERRAIN_MAX_OVERRIDES} corrections sont possibles.`);
  }
  overrides.forEach((override, index) => {
    const label = `Correction ${index + 1}`;
    if (!Number.isFinite(override.fromKm) || !Number.isFinite(override.toKm)) {
      errors.push(`${label} : les kilomètres doivent être des nombres.`);
      return;
    }
    if (!isCourseTerrainClass(override.class)) errors.push(`${label} : type de terrain inconnu.`);
    if (override.fromKm < -KM_TOLERANCE || override.toKm > distanceKm + KM_TOLERANCE) {
      errors.push(`${label} : les kilomètres doivent rester entre 0 et ${formatKm(distanceKm)} km.`);
    }
    if (!(override.toKm - override.fromKm >= MIN_RANGE_KM)) errors.push(`${label} : le km de départ doit précéder le km d’arrivée.`);
  });
  return { ok: errors.length === 0, errors };
}

function commit(osmSegments: CourseTerrainSegment[], candidate: CourseTerrainOverride[], distanceKm: number) {
  const next = canonicalizeOverrides(osmSegments, candidate, distanceKm);
  const validation = validateOverrides(next, distanceKm);
  if (!validation.ok) throw new TerrainEditError(validation.errors[0]);
  return next;
}

export type TerrainEditContext = { osmSegments: CourseTerrainSegment[]; overrides: CourseTerrainOverride[]; distanceKm: number };

/** Forces `terrainClass` on the km range [fromKm, toKm] (wins over OSM and earlier corrections). */
export function addRangeOverride(ctx: TerrainEditContext, fromKm: number, toKm: number, terrainClass: CourseTerrainClass) {
  const from = roundKm(fromKm);
  const to = roundKm(toKm);
  const range = validateOverrides([{ fromKm: from, toKm: to, class: terrainClass }], ctx.distanceKm);
  if (!range.ok) throw new TerrainEditError(range.errors[0].replace(/^Correction 1 : /, ""));
  return commit(ctx.osmSegments, [...ctx.overrides, { fromKm: from, toKm: to, class: terrainClass }], ctx.distanceKm);
}

/** Forces `terrainClass` on a whole displayed segment. */
export function changeSegmentClass(
  ctx: TerrainEditContext,
  segment: Pick<CourseTerrainSegment, "fromKm" | "toKm">,
  terrainClass: CourseTerrainClass,
) {
  return addRangeOverride(ctx, segment.fromKm, segment.toKm, terrainClass);
}

/** Splits a displayed segment at `km`; the part after the split takes `terrainClass`. */
export function splitSegment(
  ctx: TerrainEditContext,
  segment: Pick<CourseTerrainSegment, "fromKm" | "toKm">,
  km: number,
  terrainClass: CourseTerrainClass,
) {
  const at = roundKm(km);
  if (!Number.isFinite(at) || at <= segment.fromKm + MIN_RANGE_KM || at >= segment.toKm - MIN_RANGE_KM) {
    throw new TerrainEditError(`Choisis un kilomètre entre ${formatKm(segment.fromKm)} et ${formatKm(segment.toKm)} km.`);
  }
  return addRangeOverride(ctx, at, segment.toKm, terrainClass);
}

/** Restores OpenStreetMap on [fromKm, toKm]: organizer corrections are cut out of that range. */
export function revertOverrideRange(ctx: TerrainEditContext, fromKm: number, toKm: number) {
  const kept: CourseTerrainOverride[] = [];
  for (const override of flattenOrganizerSegments(applyCourseTerrainOverrides(ctx.osmSegments, ctx.overrides, ctx.distanceKm))) {
    if (override.toKm <= fromKm + KM_TOLERANCE || override.fromKm >= toKm - KM_TOLERANCE) {
      kept.push(override);
      continue;
    }
    if (override.fromKm < fromKm) kept.push({ ...override, toKm: roundKm(fromKm) });
    if (override.toKm > toKm) kept.push({ ...override, fromKm: roundKm(toKm) });
  }
  return commit(ctx.osmSegments, kept, ctx.distanceKm);
}

export function overridesEqual(a: CourseTerrainOverride[], b: CourseTerrainOverride[]) {
  return a.length === b.length && a.every((item, index) => item.fromKm === b[index].fromKm && item.toKm === b[index].toKm && item.class === b[index].class);
}

export function previewTerrain(
  osmSegments: CourseTerrainSegment[],
  overrides: CourseTerrainOverride[],
  distanceKm: number,
): { segments: CourseTerrainSegment[]; summary: CourseTerrainSummary } {
  const segments = applyCourseTerrainOverrides(osmSegments, overrides, distanceKm);
  return { segments, summary: summarizeCourseTerrain(segments, distanceKm) };
}

export type TerrainViewState = "loading" | "error" | "pending" | "no_route" | "failed" | "ready";

export function selectTerrainViewState(data: OrganizerCourseTerrain | null, load: "loading" | "error" | "idle"): TerrainViewState {
  if (!data) return load === "error" ? "error" : "loading";
  const { terrain } = data;
  if (terrain.status === "pending") return "pending";
  if (terrain.status === "unavailable") return terrain.reason === "no_route" ? "no_route" : "failed";
  return "ready";
}

export function formatKm(value: number) {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(value);
}

export function formatPct(value: number) {
  return `${formatKm(value)} %`;
}
