// Resumable course terrain computation, driven by POST /api/cron/course-terrain (pg_cron, every
// 10 minutes). One race at a time; each Overpass chunk is persisted in `progress`, so a 170 km
// ultra that does not fit one invocation continues on the next tick.
// Rules: docs/03-business-rules/course-terrain.md. Display-only.

import { GpxParseError, parseGpx } from "../gpx/parseGpx";
import { COURSE_TERRAIN_RULES_VERSION } from "./classify";
import { buildTrackChunks, padBbox, resampleTrack, type Bbox, type TrackChunk, type TrackSample } from "./geometry";
import { matchSamples, type OsmWay } from "./matching";
import { OVERPASS_CLIENT_TIMEOUT_MS } from "./overpass";
import {
  buildTerrainSegments,
  computeTerrainCoverage,
  decodeMatches,
  encodeMatches,
  isEncodedMatchRun,
  type EncodedMatchRun,
} from "./segments";
import type { CourseTerrainRow, CourseTerrainRowPatch, CourseTerrainStore } from "./store";

/** Work budget of one invocation (route maxDuration is 300 s). */
export const COURSE_TERRAIN_TICK_BUDGET_MS = 240_000;
/** A new row is only started with at least this much budget left. */
export const COURSE_TERRAIN_MIN_ROW_BUDGET_MS = 45_000;
/** A chunk request is only started if a full client timeout still fits the budget. */
export const COURSE_TERRAIN_CHUNK_RESERVE_MS = OVERPASS_CLIENT_TIMEOUT_MS + 5_000;
/** Lease held on a row while a tick works on it (longer than one invocation). */
export const COURSE_TERRAIN_LEASE_MS = 6 * 60_000;
export const COURSE_TERRAIN_MAX_ATTEMPTS = 5;
const RETRY_BASE_MS = 15 * 60_000;
const READY_RETRY_MS = 7 * 24 * 3_600_000;
/** Politeness gap between two Overpass requests. */
const OVERPASS_GAP_MS = 1_000;
const MAX_CLAIMS_PER_TICK = 25;

export type CourseTerrainJobDeps = {
  store: CourseTerrainStore;
  /** GPX text from the `race-gpx` bucket, or null when unreadable. */
  loadGpx(storagePath: string): Promise<string | null>;
  fetchWays(bbox: Bbox, deadline: number): Promise<OsmWay[]>;
  now(): number;
  sleep(ms: number): Promise<void>;
  /** Called after a row became ready (CDN cache purge). */
  onReady?(raceId: string): Promise<void>;
};

export type CourseTerrainRowOutcome = "ready" | "in_progress" | "retry" | "failed" | "no_route" | "superseded";

type Progress = {
  v: 1;
  path: string;
  sha: string | null;
  rulesVersion: number;
  sampleCount: number;
  chunkCount: number;
  nextChunk: number;
  lastWayId: number | null;
  requests: number;
  runs: EncodedMatchRun[];
};

const iso = (ms: number) => new Date(ms).toISOString();

export function retryDelayMs(attempts: number) {
  return RETRY_BASE_MS * 2 ** Math.max(0, attempts - 1);
}

/** Stored progress is reused only for the same GPX, rules and chunking. */
export function readProgress(value: unknown, row: CourseTerrainRow, sampleCount: number, chunks: TrackChunk[]): Progress | null {
  if (!value || typeof value !== "object") return null;
  const progress = value as Partial<Progress>;
  if (
    progress.v !== 1 ||
    progress.path !== row.gpx_storage_path ||
    (progress.sha ?? null) !== row.gpx_sha256 ||
    progress.rulesVersion !== COURSE_TERRAIN_RULES_VERSION ||
    progress.sampleCount !== sampleCount ||
    progress.chunkCount !== chunks.length ||
    !Number.isInteger(progress.nextChunk) ||
    progress.nextChunk! < 0 ||
    progress.nextChunk! > chunks.length ||
    !Array.isArray(progress.runs) ||
    !progress.runs.every(isEncodedMatchRun)
  ) {
    return null;
  }
  const matchedSamples = progress.runs.reduce((total, run) => total + run[0], 0);
  const expected = progress.nextChunk === 0 ? 0 : chunks[progress.nextChunk! - 1]!.end;
  if (matchedSamples !== expected) return null;
  return {
    ...(progress as Progress),
    lastWayId: typeof progress.lastWayId === "number" ? progress.lastWayId : null,
    requests: typeof progress.requests === "number" ? progress.requests : 0,
  };
}

const errorMessage = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause)).slice(0, 1000);

async function recordFailure(
  deps: CourseTerrainJobDeps,
  row: CourseTerrainRow,
  cause: unknown,
  permanent: boolean,
): Promise<CourseTerrainRowOutcome> {
  const now = deps.now();
  const attempts = row.attempts + 1;
  const lastError = errorMessage(cause);
  let patch: CourseTerrainRowPatch;
  let outcome: CourseTerrainRowOutcome;
  if (row.status === "ready") {
    // A recomputation (new rules version) failed: keep the terrain on display, try again later.
    const exhausted = permanent || attempts >= COURSE_TERRAIN_MAX_ATTEMPTS;
    patch = {
      attempts: exhausted ? 0 : attempts,
      last_error: lastError,
      next_attempt_at: iso(now + (exhausted ? READY_RETRY_MS : retryDelayMs(attempts))),
    };
    outcome = "retry";
  } else if (permanent || attempts >= COURSE_TERRAIN_MAX_ATTEMPTS) {
    patch = { status: "failed", attempts, last_error: lastError, progress: null, next_attempt_at: iso(now) };
    outcome = "failed";
  } else {
    patch = { attempts, last_error: lastError, next_attempt_at: iso(now + retryDelayMs(attempts)) };
    outcome = "retry";
  }
  const written = await deps.store.updateRow(row.race_id, row.gpx_storage_path, patch);
  return written ? outcome : "superseded";
}

/** Advances one claimed row as far as the deadline allows. */
export async function processCourseTerrainRow(
  row: CourseTerrainRow,
  deps: CourseTerrainJobDeps,
  deadline: number,
): Promise<CourseTerrainRowOutcome> {
  const path = row.gpx_storage_path;
  if (!path) {
    const written = await deps.store.updateRow(row.race_id, null, {
      status: "no_route", progress: null, attempts: 0, last_error: null, next_attempt_at: iso(deps.now()),
    });
    return written ? "no_route" : "superseded";
  }

  let samples: TrackSample[];
  let totalKm: number;
  try {
    const xml = await deps.loadGpx(path);
    if (xml === null) throw new Error("GPX unavailable in storage");
    const parsed = parseGpx(xml);
    samples = resampleTrack(parsed.points);
    totalKm = parsed.points.at(-1)?.distKmCum ?? 0;
    if (samples.length < 2) throw new GpxParseError("no_coordinates");
  } catch (cause) {
    return recordFailure(deps, row, cause, cause instanceof GpxParseError);
  }

  const distanceKm = Math.round(totalKm * 1000) / 1000;
  const chunks = buildTrackChunks(samples);
  const progress: Progress = readProgress(row.progress, row, samples.length, chunks) ?? {
    v: 1,
    path,
    sha: row.gpx_sha256,
    rulesVersion: COURSE_TERRAIN_RULES_VERSION,
    sampleCount: samples.length,
    chunkCount: chunks.length,
    nextChunk: 0,
    lastWayId: null,
    requests: 0,
    runs: [],
  };
  const workingStatus = row.status === "ready" ? "ready" : "processing";

  try {
    while (progress.nextChunk < chunks.length) {
      if (deps.now() + COURSE_TERRAIN_CHUNK_RESERVE_MS > deadline) {
        // Out of budget: due again immediately, the next tick resumes at `nextChunk`.
        const written = await deps.store.updateRow(row.race_id, path, {
          status: workingStatus, progress, next_attempt_at: iso(deps.now()),
        });
        return written ? "in_progress" : "superseded";
      }
      if (progress.requests > 0) await deps.sleep(OVERPASS_GAP_MS);
      const chunk = chunks[progress.nextChunk]!;
      const ways = await deps.fetchWays(padBbox(chunk.bbox), deadline);
      const { matches, lastWayId } = matchSamples(samples.slice(chunk.start, chunk.end), ways, progress.lastWayId);
      encodeMatches(matches, progress.runs);
      progress.lastWayId = lastWayId;
      progress.nextChunk += 1;
      progress.requests += 1;
      const written = await deps.store.updateRow(row.race_id, path, {
        status: workingStatus, progress, next_attempt_at: iso(deps.now() + COURSE_TERRAIN_LEASE_MS),
      });
      if (!written) return "superseded";
    }
  } catch (cause) {
    return recordFailure(deps, row, cause, false);
  }

  // Always recomputed from the encoded runs, so a finish after a resume equals a single pass.
  const matches = decodeMatches(progress.runs);
  const now = deps.now();
  const written = await deps.store.updateRow(row.race_id, path, {
    status: "ready",
    attempts: 0,
    last_error: null,
    rules_version: COURSE_TERRAIN_RULES_VERSION,
    distance_km: distanceKm,
    osm_segments: buildTerrainSegments(matches, distanceKm),
    coverage: computeTerrainCoverage(matches),
    computed_at: iso(now),
    progress: null,
    next_attempt_at: iso(now),
  });
  if (!written) return "superseded";
  await deps.onReady?.(row.race_id).catch((cause) => console.warn("Course terrain: cache purge failed", cause));
  return "ready";
}

export type CourseTerrainTickResult = { processed: Array<{ raceId: string; outcome: CourseTerrainRowOutcome }> };

/** Processes due rows one at a time until none is due or the budget is spent. */
export async function runCourseTerrainTick(
  deps: CourseTerrainJobDeps,
  budgetMs = COURSE_TERRAIN_TICK_BUDGET_MS,
): Promise<CourseTerrainTickResult> {
  const deadline = deps.now() + budgetMs;
  const processed: CourseTerrainTickResult["processed"] = [];
  for (let claims = 0; claims < MAX_CLAIMS_PER_TICK; claims++) {
    if (deps.now() + COURSE_TERRAIN_MIN_ROW_BUDGET_MS > deadline) break;
    const due = await deps.store.findDueRow(iso(deps.now()));
    if (!due) break;
    const row = await deps.store.claimRow(due, iso(deps.now() + COURSE_TERRAIN_LEASE_MS));
    if (!row) continue; // another tick took it
    const outcome = await processCourseTerrainRow(row, deps, deadline);
    processed.push({ raceId: row.race_id, outcome });
    if (outcome === "in_progress") break;
  }
  return { processed };
}
