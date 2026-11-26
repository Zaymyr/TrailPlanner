---
title: Course Terrain from OpenStreetMap
scope: business-rule
last_verified: 2026-11-26
ai_priority: medium
related_files:
  - packages/shared/src/course-terrain/index.ts
  - packages/shared/src/course-terrain/types.ts
  - packages/shared/src/course-terrain/presentation.ts
  - apps/web/lib/course-terrain-presentation.test.ts
  - apps/web/lib/course-terrain/classify.ts
  - apps/web/lib/course-terrain/geometry.ts
  - apps/web/lib/course-terrain/matching.ts
  - apps/web/lib/course-terrain/segments.ts
  - apps/web/lib/course-terrain/overpass.ts
  - apps/web/lib/course-terrain/store.ts
  - apps/web/lib/course-terrain/job.ts
  - apps/web/lib/course-terrain/response.ts
  - apps/web/lib/course-terrain/cache.ts
  - apps/web/lib/course-terrain/service.ts
  - apps/web/lib/course-terrain/course-terrain.test.ts
  - apps/web/lib/race-runner-visibility.ts
  - apps/web/app/api/race-terrain/route.ts
  - apps/web/app/api/race-terrain/route.test.ts
  - apps/web/app/api/organizer/races/[id]/terrain/route.ts
  - apps/web/app/api/organizer/races/[id]/terrain/route.test.ts
  - apps/web/app/api/cron/course-terrain/route.ts
  - apps/web/app/api/cron/course-terrain/route.test.ts
  - supabase/migrations/20261126090000_course_terrain.sql
  - scripts/course-terrain/compute-terrain.mjs
  - scripts/course-terrain/osm-route-to-gpx.mjs
related_tables:
  - race_course_terrain
  - races
---

# Course Terrain from OpenStreetMap

Status: production server side (lot 2, 2026-11-26). Web, mobile and organizer UIs consume the contract below.

## Purpose

Show the terrain type along a race GPX (road, wide unpaved track, trail, technical, off path) under the elevation profile, derived from OpenStreetMap, with organizer corrections.

**Display-only.** Terrain never changes pacing, ETA or nutrition until it has been calibrated on several real races (founder decision, see `docs/context/DECISIONS.md` 2026-11-26). `pacing-algorithm.md` does not read it.

## Key Concepts

- **Contract**: `packages/shared/src/course-terrain/types.ts` (`CourseTerrainResponse` = `ready` | `pending` | `unavailable`, `OrganizerCourseTerrain`, `CourseTerrainOverridesInput`, `COURSE_TERRAIN_MAX_OVERRIDES` = 200, class colors) and pure helpers in `presentation.ts` (normalize, `applyCourseTerrainOverrides`, `summarizeCourseTerrain`, at-km, scale, between), tested by `apps/web/lib/course-terrain-presentation.test.ts`. Re-exported by `packages/shared/src/index.ts`.
- **Axis**: segments are expressed in cumulative GPX km (`parseGpx` haversine distance), `0 → distanceKm`, contiguous. UIs that draw on the official distance use `scaleCourseTerrainSegments`.
- **Storage**: one row per race in `race_course_terrain` (service role only, see [race_course_terrain](../02-database/tables/race-course-terrain.md)): OSM segments, coverage, organizer overrides, job state.
- **Attribution**: every surface showing terrain renders `© OpenStreetMap contributors` linked to `https://www.openstreetmap.org/copyright` (`COURSE_TERRAIN_ATTRIBUTION`, `COURSE_TERRAIN_ATTRIBUTION_URL`, also in every `ready` response). OSM data is ODbL; stored segments are derived data: review the share-alike obligations before sharing the dataset externally.

## Classes and rules (`COURSE_TERRAIN_RULES_VERSION = 1`)

`apps/web/lib/course-terrain/classify.ts`, first matching rule wins, `trail` is the fallback. GPX slope is deliberately not used.

| Class | Rule |
| --- | --- |
| `technical` | not paved AND (`sac_scale` demanding_mountain_hiking / alpine_hiking / demanding_alpine_hiking / difficult_alpine_hiking, i.e. T3 and above, OR `surface` rock / rocks / scree / stone / shingle / boulders, OR `trail_visibility` bad / horrible / no) |
| `road` | paved `surface` (asphalt, concrete, paving_stones, sett, cobblestone, metal, wood, bricks, chipseal, ...) OR no `surface` and a road-class `highway` (motorway..residential, links, service, living_street, unclassified, pedestrian, road) |
| `trail` | `highway=track` with `tracktype` grade4 / grade5 |
| `track` | `highway=track` (grade1-3 or no tracktype); a road-class `highway` with an explicit unpaved surface |
| `trail` | everything else (path, footway, bridleway, steps, cycleway, sac_scale T1-T2 or none) |
| `off_path` | not a tag rule: no mapped way within 30 m of the sample (beach, fields, cross-country). Honest "unknown", never guessed |
| organizer | an organizer override wins over OSM on its km range (`source: 'organizer'`) |

Compared with the prototype, `smoothness` no longer makes a way `technical` (founder rule list) and `off_path` replaces `unknown`. Bump `COURSE_TERRAIN_RULES_VERSION` on any rule change: `ready` rows with an older version are recomputed by the cron while the old terrain stays on display.

## Computation (`apps/web/lib/course-terrain/`)

1. **GPX**: read from the private `race-gpx` bucket with the service key (`loadRaceGpxText` in `service.ts`), parsed with `apps/web/lib/gpx/parseGpx.ts`, resampled every 25 m (`resampleTrack`, `geometry.ts`).
2. **Chunks**: consecutive samples whose bbox side stays ≤ 3.5 km (`buildTrackChunks`, deterministic), padded by 100 m (> match distance) so every candidate way intersects the bbox.
3. **Overpass** (`overpass.ts`): one `way["highway"]["highway"!~"^(proposed|construction|abandoned|razed|platform|bus_stop|elevator)$"](bbox); out tags geom;` per chunk, `[timeout:25]` server side and a 35 s client abort (the client always waits longer than the server), User-Agent `PaceYourself/1.0 (+https://pace-yourself.com)`, up to 4 tries alternating `overpass-api.de` / `overpass.kumi.systems` with 2 / 5 / 10 s backoff, 1 s gap between chunks. Non-2xx, non-JSON and HTTP 200 with a runtime `remark` (timeout, out of memory) are failures. A request is never started if a full client timeout would outlive the tick budget.
4. **Matching** (`matching.ts`): nearest way segment within 30 m (spatial hash, local metric projection per chunk); the previous way keeps the sample while it is within best + 12 m (continuity, avoids jumping to crossings and parallel roads); continuity is carried across chunks. No way within 30 m → `off_path`.
5. **Segments** (`segments.ts`): runs of one class; runs shorter than 200 m are absorbed into the longer neighbour (left on ties), equal neighbours merge, until stable; most frequent OSM `surface` per segment; contiguous `0 → distanceKm`, rounded to the metre.
6. **Coverage**: % of samples matched, with a `surface` tag, with a `sac_scale` tag.

### Job, resume and retries (`job.ts`)

- `POST /api/cron/course-terrain` (pg_cron every 10 min at minute 3, 13, ...; `CRON_SECRET` bearer like the other `/api/cron/*` routes; `maxDuration = 300`). Row access goes through `store.ts` (PostgREST, service key).
- A tick has a 240 s budget. It takes the oldest due row (`pending` / `processing`, or `ready` with an older rules version, `next_attempt_at ≤ now`), leases it by moving `next_attempt_at` 6 min ahead with an optimistic `eq` on the previous value, and works on one race at a time; with budget left (≥ 45 s) it takes the next due race.
- **Resumable**: after every chunk the matches so far are saved in `progress` as run-length tuples `[sampleCount, class, surface, flags]` plus `nextChunk` and the last way id (continuity). When the next chunk would not fit the budget, the row is left due at once and the next tick resumes at `nextChunk`. Progress is reused only for the same GPX path, hash, rules version, sample and chunk counts. The final segments are always rebuilt from the encoded runs, so a resumed run equals a single pass.
- **How an ultra fits**: a 170 km course is about 6,800 samples and 30-50 chunks of 3.5 km. At 2-5 s per Overpass answer plus the 1 s gap, most ultras finish in one or two ticks (10-20 min); a slow Overpass day spreads the same work over more ticks without ever exceeding `maxDuration`, since no request starts unless 40 s of budget remain.
- **Writes are conditional** on `gpx_storage_path` still being the one read: a GPX replaced mid-run (the trigger resets the row) makes the job stop (`superseded`) instead of storing stale terrain.
- **Failures**: an Overpass or storage error increments `attempts`, stores `last_error` and retries after 15 min × 2^(attempts−1) (15, 30, 60, 120 min) keeping the progress; at 5 attempts the row is `failed`. An invalid GPX is `failed` at once. A row without GPX becomes `no_route`. A failed recomputation of a `ready` row keeps the terrain on display and retries (after 7 days once 5 attempts are spent).
- After a row becomes `ready` the job purges the CDN tag of the public route (`cache.ts`).

### Queueing (migration `20261126090000_course_terrain.sql`)

- Trigger `queue_race_course_terrain` after insert / update of `races.gpx_storage_path` or `gpx_sha256` (only when a value changes): upserts the row to `pending` (or `no_route` when the GPX is removed), resets attempts, progress and computed results, keeps the organizer overrides.
- Backfill: every race with a GPX gets a `pending` row (backlog processed oldest first, several small races per tick).

## Endpoints

### `GET /api/race-terrain?raceId=<uuid>` (public)

Same runner visibility as `/api/race-weather` (`isRaceRunnerVisible`, `apps/web/lib/race-runner-visibility.ts`, mirror of the anon `races_select` branches); same 30 / min / IP in-memory rate limit. Built by `buildPublicCourseTerrain` (`service.ts`) and `toCourseTerrainResponse` (`response.ts`).

| Case | HTTP | Body | `Cache-Control` |
|---|---|---|---|
| Invalid id | 400 | `{ message }` | `no-store` |
| Unknown or runner-hidden race | 404 | `{ message }` | `no-store` |
| Rate limited | 429 | `{ message }` | `no-store` |
| Read failure | 502 | `{ message }` | `no-store` |
| Row `ready` | 200 | `CourseTerrain` (overrides applied with `applyCourseTerrainOverrides`, `summarizeCourseTerrain`) | `public, s-maxage=3600, stale-while-revalidate=86400` |
| No row but a GPX, or `pending` / `processing` | 200 | `{ status: 'pending' }` | `public, s-maxage=60` |
| No GPX, `no_route` | 200 | `unavailable / no_route` | `public, s-maxage=300` |
| `failed` | 200 | `unavailable / failed` | `public, s-maxage=300` |

Every 200 carries `Vercel-Cache-Tag: course-terrain:race:<raceId>`.

### `GET | PUT /api/organizer/races/[id]/terrain` (organizer)

- Auth like the other organizer race routes: bearer session (`requireOrganizerAuth`, 401), `loadRaceForOrganizer` (404 unknown race, 409 race without event, 403 when the user is not an active organizer of the event; admins pass).
- `GET` → `OrganizerCourseTerrain`: the runner-facing `terrain`, `osmSegments` (empty unless ready), `overrides`, `overridesNeedReview` (overrides exist and their `overrides_gpx_sha256` differs from the current `gpx_sha256`).
- `PUT` body `CourseTerrainOverridesInput`. Same entitlement as the aid-stations editor of the course: the race needs an edition and its `aid_stations` module selected (403 otherwise). Validation (zod, 400): class enum, finite km ≥ 0, `fromKm < toKm`, `toKm ≤` GPX distance + 0.05 km, at most 200 overrides; km rounded to the metre, order kept (later overrides win). 409 without GPX. Works while terrain is pending (the GPX distance is measured from the file; a missing row is created as `pending`). Stores `organizer_overrides`, `overrides_gpx_sha256` = current GPX hash, `overrides_updated_at` / `_by`, then purges the public CDN tag so runners see the change within seconds.

## Real-course results (production GPX, 2026-11-25)

11 organizer GPX of production races, run with the prototype `scripts/course-terrain/compute-terrain.mjs` (prototype rules: `unknown` = later `off_path`, `smoothness` still counted as technical). Percentages of distance (classes) and of samples (coverage).

| Course | matched | `surface` tag | `sac_scale` tag | road | track | trail | technical | unknown |
|---|---|---|---|---|---|---|---|---|
| UTC 100M Corse 108 km | 96.6 | 52 | 64 | 8 | 5 | 64 | 21 | 2.6 |
| Nice 100M 165 km | 97.7 | 15 | 39 | 20 | 11 | 64 | 3 | 2 |
| Marcaires 65 Vosges | 99 | 52 | 54 | 4 | 20 | 74 | 1.4 | 0.5 |
| Mafate 54 Réunion | 98.4 | 55 | 35 | 28 | 4 | 68 | 0 | 0.4 |
| Petit Train 28 Isère | 94 | 47 | 30 | 24 | 24 | 39 | 9 | 5 |
| Drailles Galinette 50 | 99.9 | 10 | 23 | 9 | 31 | 58 | 1.5 | 0 |
| Monistrail 50 | 96.8 | 24 | 0 | 21 | 38 | 37 | 0 | 3 |
| Uzès→Nîmes 87 | 98.9 | 33 | 0 | 22 | 28 | 48 | 1 | 0.3 |
| SaintéVia 36 | 99.9 | 58 | 0 | 64 | 16 | 20 | 1 | 0 |
| L'Estran 32 Bretagne | 57 | 25 | 1 | 12 | 1 | 38 | 1 | 47 |
| Trail 33 Pons | 46 | 11 | 0 | 24 | 13 | 5 | 0 | 59 |

Conclusions:

- Real organizer GPX match well (≥ 94% on 9 of 11 courses), including two 100-mile ultras.
- `surface` is tagged on 10-58% of samples and `sac_scale` is absent outside mountain courses: the road / track / trail split leans on the `highway` defaults, and `technical` is only reliable where `sac_scale` exists (Corse 21%).
- Gap analysis on L'Estran and Pons: about 35-40% of samples are more than 60 m from any mapped way (beach and tidal zone, unmapped field paths). This is real off-path terrain, not a threshold issue, hence the honest `off_path` class and organizer overrides rather than a wider match distance.
- Overpass lessons: public instances time out on ultra-sized bboxes; the prototype aborted the client at 75 s while asking the server for 90 s (the client must wait longer than the server timeout); HTTP 200 + empty list + `remark` is a failure; one dense-city bbox returned 11k ways. Hence small chunks, `[timeout:25]` / 35 s client abort, remark detection and the resumable job.

### Earlier fixture runs (2026-11-23/24)

OSM route relations rebuilt as pseudo-recorded GPX (`scripts/course-terrain/osm-route-to-gpx.mjs`, 4 m noise): TMB main route (82 km of geometry) road 18.1% / track 23.8% / trail 54.1% / technical 4.0%, TMB Fenêtre d'Arpette variant technical 10.7%, Voie Verte Lyon road 67.9%; matching is ~100% by construction. The synthetic demo tracks (`supabase/demo-assets/trail-tst-*.gpx`, interpolated) match 26-36% only and say nothing about OSM quality.

## Prototype scripts

`node scripts/course-terrain/compute-terrain.mjs <file.gpx> [--out result.json] [--save-cache f] [--from-cache f]` remains the offline study tool (sequential, 9 km bboxes, prototype rules). Production code is the TypeScript port above; do not reuse the script's Overpass settings.

## Gotchas

- Coverage is % of 25 m samples; class percentages are % of segment length.
- `off_path` short stretches (< 200 m) are absorbed like any other run: a few metres of beach between two paths do not show.
- A `highway=service` or `unclassified` without `surface` is `road` although it may be gravel; a scree field mapped as a plain `path` without tags is `trail`. Organizer overrides are the correction path.
- Parallel ways within 30 m can still win over a long stretch despite continuity; switchbacks cut by the GPS can match the wrong leg.
- The public route is CDN-cached 1 h when ready. The organizer PUT and the cron purge the `course-terrain:race:<id>` tag (`invalidateByTag`, only on Vercel); if the purge fails, staleness is bounded by the 1 h TTL. Pending answers are cached 60 s, so the first `ready` appears at most a minute after the computation.
- A GPX replacement keeps the overrides but their km may no longer match: `overridesNeedReview` tells the organizer. Overrides are still applied.
- The public Overpass instances are meant for moderate use: keep one race at a time, the 1 s gap and the small chunks; a large backfill takes several hours by design.
- The cron job has no manual run in `/admin/system/maintenance` yet; the console lists it as « Terrain des parcours ».

## Related Docs

- [race_course_terrain](../02-database/tables/race-course-terrain.md)
- [GPX Import](gpx-import.md)
- [Pacing Algorithm](pacing-algorithm.md)
- [MET Norway Course Weather](../05-integrations/met-norway-weather.md) (sister display-only feature)
- [Packages Architecture](../01-architecture/packages.md)
