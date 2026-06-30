---
title: GPX Import
scope: business-rule
last_verified: 2026-06-30
ai_priority: high
related_files:
  - apps/web/lib/gpx/parseGpx.ts
  - apps/mobile/lib/gpx.ts
  - apps/web/lib/gpx/normalizeImportedWaypoints.ts
  - apps/web/lib/organizer-aid-station-products.ts
  - apps/web/components/gpx/GpxRouteMap.tsx
  - apps/web/components/gpx/GpxRouteMapClient.tsx
  - apps/web/app/admin/components/AdminRaceCatalogSection.tsx
  - apps/web/app/api/admin/race-catalog/utmb/route.ts
  - apps/web/app/api/admin/race-catalog/tracedetrail/route.ts
  - apps/web/app/api/plans/route.ts
  - apps/web/app/api/plans/from-catalog/route.ts
  - apps/web/app/api/plans/from-catalog/route.test.ts
  - apps/web/app/api/organizer/races/[id]/gpx/route.ts
  - apps/web/app/api/organizer/races/[id]/gpx/route.test.ts
  - apps/web/app/api/races/route.ts
  - apps/web/app/api/race-catalog/route.ts
  - apps/web/components/GpxAidStationImporter.tsx
  - apps/mobile/components/race/GpxImportPreviewModal.tsx
  - apps/mobile/components/race/GpxRoutePreviewCard.tsx
  - apps/mobile/lib/race-import.ts
related_tables:
  - races
  - race_aid_stations
  - race_plans
  - plan_aid_stations
  - race_aid_station_products
---

# GPX Import

## Purpose

This document describes how GPX files are parsed, stored, and converted into races, plans, elevation profiles, and aid stations. The parser source of truth is `apps/web/lib/gpx/parseGpx.ts`.

## Key Concepts

- GPX point: track, route, or waypoint coordinate.
- Point source: parser mode `track`, `route`, or `waypoint`.
- Waypoint normalization: mapping GPX waypoints to start, finish, and aid stations.
- Race GPX: source object stored in `race-gpx`.
- Plan GPX: copied object stored in `plan-gpx`.

## Parser Behavior

`parseGpx`:

- removes BOM and null bytes;
- rejects empty files;
- rejects KML and TCX with dedicated error codes;
- rejects HTML/non-GPX content;
- parses `trkpt` first, then `rtept`, then `wpt` as a fallback;
- validates latitude and longitude ranges;
- computes cumulative distance with haversine distance;
- computes elevation gain/loss with a 1 m threshold;
- returns bounds, min/max altitude, start coordinate, waypoints, and point source.

The parser does not use a DOM/XML parser; it uses regex-based extraction tuned to GPX envelope and point tags.

## Waypoint Normalization

`normalizeImportedWaypoints`:

- maps GPX waypoints to nearest track distances;
- recognizes start names such as `start`, `depart`, `departure`;
- recognizes finish names such as `finish`, `arrivee`, `arrival`, `arrive`, `end`;
- excludes waypoints near start/finish from aid stations;
- removes duplicate aid stations by normalized name and close distance;
- returns start name, finish name, and sorted aid stations.

## Admin Catalog Import

`apps/web/app/api/race-catalog/route.ts`:

1. Requires bearer token and admin user.
2. Accepts multipart form data with GPX.
3. Optionally creates a draft `race_events` row unless the admin explicitly marks it live.
4. Uploads GPX into private `race-gpx`.
5. Optionally uploads image into public `race-images`.
6. Inserts a public `races` row that stays draft (`is_live = false`) by default unless the admin explicitly marks it live.
7. Inserts `race_aid_stations` from manual stations or normalized GPX waypoints.

## User Private Race Import

`apps/web/app/api/races/route.ts`:

1. Requires bearer token.
2. Accepts JSON or multipart form input.
3. Parses optional GPX content.
4. Uploads GPX into `race-gpx` when provided.
5. Inserts a private race with `is_public: false`, `created_by: user.id`, and `is_live: true`.
6. Inserts `race_aid_stations` when supplied or derived.

`apps/mobile/lib/race-import.ts` calls this web route from mobile and then updates the race as private/non-live through Supabase.

The mobile import preview also keeps the parsed route geometry client-side through `apps/mobile/lib/gpx.ts`. `apps/mobile/components/race/GpxImportPreviewModal.tsx` renders that geometry with `GpxRoutePreviewCard.tsx`, giving the runner a native route sketch before confirming the import without waiting for any server round-trip.

## Catalog Plan Import

`apps/web/app/api/plans/from-catalog/route.ts`:

1. Requires bearer token.
2. Checks entitlements and plan limits.
3. Applies a 90-second idempotency guard for recent imports of the same race.
4. Loads a live `races` row and its `race_aid_stations`.
5. Downloads source GPX from `race-gpx`.
6. Parses GPX and builds elevation profile.
7. Copies GPX to `plan-gpx`, falling back to upload when Supabase copy fails.
8. Creates `race_plans` with `race_id`, `catalog_race_updated_at_at_import`, `plan_gpx_path`, and `plan_course_stats`.
9. Inserts plan-specific `plan_aid_stations`.
10. Copies source station service flags into `planner_values.aidStations` as `waterRefill`, `solidRefill`, and `assistanceAllowed`.
11. Stores source station ids as `sourceAidStationId` when available so planner product suggestions can match by id before falling back to `name|km`.
12. Stores organizer ravito product suggestions in `planner_values.organizerAidStationProducts` as a fallback snapshot when source station-product links exist. Saved plans linked to `race_id` later receive current source suggestions through `/api/plans` GET.

## Organizer GPX Replacement

`apps/web/app/api/organizer/races/[id]/gpx/route.ts` `PUT`:

1. Requires bearer token and an active organizer membership for the parent event.
2. Accepts multipart GPX upload.
3. Parses and validates GPX with the shared parser.
4. Uploads/replaces the source object in `race-gpx`.
5. Updates the source `races` row with GPX path/hash and parsed course stats.
6. Returns parsed stats, detected waypoint ravitos, and a dashboard-only elevation profile.
7. Creates source `race_aid_stations` from normalized waypoints only when the format has no existing stations; service flags default to enabled.

`GET` on the same route requires the same organizer access, reads the existing private source GPX, reparses it, and returns the same preview payload without adding a `races.elevation_profile` column.

Existing saved plans are not rewritten after organizer GPX replacement. They keep their copied `plan-gpx` object, `elevation_profile`, `planner_values`, and `plan_aid_stations`.

For a brand-new organizer format, the add-format dashboard also uses the shared parser client-side as soon as a GPX file is selected. That preview step pre-fills distance, elevation gain, and elevation loss before the race row exists, and hydrates the organizer GPX panel with the same parsed points used by the interactive route map and elevation preview. After the format is created, the pending file is still uploaded through `/api/organizer/races/[id]/gpx` so the same stats are persisted on `races` and eligible waypoint ravitos can be created.

## Review Flow Conflict

`apps/web/components/GpxAidStationImporter.tsx` contains logic for updating existing race aid stations from GPX:

- match by normalized name;
- match by distance tolerance around 1.5 km;
- delete unmatched stations when no linked plans exist;
- mark stations as `needs_review` when linked plans exist.

<!-- CONFLICT: this component references race_aid_stations.needs_review, race_aid_stations.last_gpx_import_at, and plan_aid_stations.race_aid_station_id, but visible migrations in this repo do not create those columns. -->

## Gotchas

- GPX parse errors have specific codes. Preserve them when adding UI messaging.
- The mobile parser now exposes preview points for UI route sketches. Keep those points aligned with the same parsed distance accumulation used for distance, D+, and D- so the preview does not disagree with the imported stats.
- Route points can be used when track points are absent.
- Waypoint-only files produce a `waypoint` point source and limited route geometry.
- Do not delete source race aid stations without checking plan linkage once the linkage schema is verified.
- Catalog GPX and plan GPX live in different buckets.
- Organizer GPX replacement updates source race data only; saved plans remain snapshots.
- Organizer GPX waypoint import is safe-mode only: detected waypoints do not replace existing source stations, because replacing rows would break station ids and product links.
- Source station service flags affect new catalog imports only; existing saved plans keep their previous `planner_values`. Organizer station-product links are the exception at response time: plans with `race_id` can receive current product suggestions from `/api/plans` without rewriting the saved plan row.
- Imported or manually added source aid stations do not count as published organizer mobile content by themselves; the mobile Racebook gate still needs explicit organizer details.

## Related Docs

- [race_aid_stations](../02-database/tables/race-aid-stations.md)
- [plan_aid_stations](../02-database/tables/plan-aid-stations.md)
- [Plan Storage](plan-storage.md)
- [Organizer Race Management](organizer-race-management.md)
- [Infrastructure](../01-architecture/infrastructure.md)
