---
title: race_course_terrain Table
scope: database
last_verified: 2026-11-26
ai_priority: medium
related_files:
  - supabase/migrations/20261126090000_course_terrain.sql
  - apps/web/lib/course-terrain/store.ts
  - apps/web/lib/course-terrain/job.ts
  - apps/web/lib/course-terrain/response.ts
  - apps/web/app/api/cron/course-terrain/route.ts
  - apps/web/app/api/race-terrain/route.ts
  - apps/web/app/api/organizer/races/[id]/terrain/route.ts
related_tables:
  - race_course_terrain
  - races
---

# `race_course_terrain`

## Purpose

One row per race with a GPX: the OpenStreetMap terrain classes along the course (display-only), the organizer corrections and the state of the resumable computation job. Rules and endpoints: [Course Terrain](../../03-business-rules/course-terrain.md).

## Key Concepts

- Filled by the trigger `queue_race_course_terrain` on `races` and the backfill of `20261126090000_course_terrain.sql`, computed by `POST /api/cron/course-terrain`.
- Read by `GET /api/race-terrain` (public, overrides applied) and `GET|PUT /api/organizer/races/[id]/terrain`, always with the service key.
- `osm_segments` are never modified by organizers; `organizer_overrides` are applied on top at read time (`applyCourseTerrainOverrides`).

## Columns

| Column | Type | Notes |
|---|---|---|
| `race_id` | `uuid` PK | → `races.id`, `on delete cascade` |
| `gpx_storage_path` | `text` | GPX the row targets (copied from `races` by the trigger); job writes are conditional on it |
| `gpx_sha256` | `text` | same, from `races.gpx_sha256` |
| `status` | `text not null default 'pending'` | `pending` \| `processing` \| `ready` \| `failed` \| `no_route` |
| `attempts` | `integer not null default 0` | failed ticks since the last success / GPX change (≥ 0); `failed` at 5 |
| `next_attempt_at` | `timestamptz not null default now()` | when the cron may pick the row; also the 6 min lease while a tick works on it |
| `last_error` | `text` | ≤ 1000 chars |
| `rules_version` | `integer` | `COURSE_TERRAIN_RULES_VERSION` of `osm_segments` (> 0) |
| `distance_km` | `double precision` | cumulative GPX distance the segments use (≥ 0) |
| `osm_segments` | `jsonb` (array) | `CourseTerrainSegment[]`, `source: 'osm'`, contiguous 0 → `distance_km` |
| `coverage` | `jsonb` (object) | `CourseTerrainCoverage` (`matchedPct`, `surfaceTagPct`, `sacScaleTagPct`) |
| `computed_at` | `timestamptz` | last successful computation |
| `progress` | `jsonb` (object) | resumable work: `{ v, path, sha, rulesVersion, sampleCount, chunkCount, nextChunk, lastWayId, requests, runs: [[count, class, surface, flags]] }`; null when idle |
| `organizer_overrides` | `jsonb not null default '[]'` (array) | `CourseTerrainOverride[]`, later entries win |
| `overrides_gpx_sha256` | `text` | `gpx_sha256` when the overrides were saved |
| `overrides_updated_at` | `timestamptz` | |
| `overrides_updated_by` | `uuid` | → `auth.users.id`, `on delete set null` |
| `created_at`, `updated_at` | `timestamptz not null` | `updated_at` maintained by `set_race_course_terrain_updated_at` |

## Foreign Keys

- `race_id` → `public.races(id)` on delete cascade.
- `overrides_updated_by` → `auth.users(id)` on delete set null.

## Indexes

- Primary key `race_id`.
- `race_course_terrain_due_idx` on `(next_attempt_at)` where `status in ('pending','processing','ready')` (cron pick).
- `race_course_terrain_overrides_updated_by_idx` (foreign key).

## RLS Policies

RLS enabled, no policy. `public`, `anon` and `authenticated` have every privilege revoked; `service_role` has select / insert / update / delete. Clients never read the table: the routes enforce runner visibility and organizer rights.

## Business Invariants

- A GPX change on `races` (path or hash) resets the row to `pending` (or `no_route` without GPX), clears attempts, progress and computed results, and keeps the overrides.
- `ready` implies `osm_segments`, `coverage`, `distance_km`, `computed_at` and `rules_version` are set.
- `overridesNeedReview` (organizer API) = overrides exist and `overrides_gpx_sha256` is distinct from `gpx_sha256`.
- Terrain is display-only: no pacing or nutrition code reads this table.

## Common Queries

```sql
-- Backlog and failures
select status, count(*) from public.race_course_terrain group by status;
select race_id, attempts, last_error from public.race_course_terrain where status = 'failed';

-- Force a recomputation of one race (the next tick picks it)
update public.race_course_terrain
set status = 'pending', attempts = 0, progress = null, next_attempt_at = now()
where race_id = '<race uuid>';
```

## Gotchas

- `progress` can reach tens of kB on an ultra; the read routes select every column except it.
- The trigger is `SECURITY DEFINER` (an authenticated admin editing `races` directly must still queue the row); its execute privilege is revoked from client roles.
- A `ready` row with an older `rules_version` stays `ready` (and visible) while it is recomputed.

## Related Docs

- [Course Terrain](../../03-business-rules/course-terrain.md)
- [races](races.md)
- [Migrations](../migrations.md)
