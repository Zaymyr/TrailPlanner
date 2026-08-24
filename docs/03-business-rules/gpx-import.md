---
title: GPX Import
scope: business-rule
last_verified: 2026-08-24
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
  - apps/web/app/api/admin/race-catalog/tracedetrail/route.test.ts
  - apps/web/app/api/admin/race-catalog/tracedetrail/importer.test.ts
  - apps/web/lib/tracedetrail-race-import.ts
  - apps/web/app/api/plans/route.ts
  - apps/web/app/api/plans/from-catalog/route.ts
  - apps/web/app/api/plans/from-catalog/route.test.ts
  - apps/web/app/api/organizer/races/[id]/gpx/route.ts
  - apps/web/app/api/organizer/races/[id]/gpx/route.test.ts
  - apps/web/app/organizer/_components/OrganizerDashboard.tsx
  - apps/web/lib/organizer-website-import.ts
  - apps/web/lib/organizer-import-engine.ts
  - apps/web/lib/organizer-import-proposals.ts
  - apps/web/app/organizer/_components/dashboard/helpers.ts
  - apps/web/app/organizer/_components/dashboard/helpers.test.ts
  - apps/web/app/organizer/_components/dashboard/event-format-editors.tsx
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

The Trace de Trail admin adapter first tries the official download with the credentials supplied for the current dialog, then retries the public download endpoint. When both downloads remain protected but the public trace page already exposes its route geometry, it rebuilds an importable GPX from that embedded geometry. The admin preview identifies this result as `embedded`. From the same reviewed preview, the admin can either create the catalog race or download the recovered GPX directly; the download action does not create a `race_events`/`races` row and does not upload anything to Supabase Storage.

New Trace de Trail catalog races initialize `edition_group_id` with their own race id and `series_name` with the imported course name. These values are required by the edition-group schema even for the first edition of a format.

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
7. The organizer elevation profile payload now also carries cumulative D+ and D- totals at each sampled profile point so the ravito editor can auto-fill per-station cumulative values from the GPX trace without manual re-entry.
7. Creates source `race_aid_stations` from normalized waypoints only when the format has no existing stations; service flags default to enabled.

`GET` on the same route requires the same organizer access, reads the existing private source GPX, reparses it, and returns the same preview payload without adding a `races.elevation_profile` column.

Existing saved plans are not rewritten after organizer GPX replacement. They keep their copied `plan-gpx` object, `elevation_profile`, `planner_values`, and `plan_aid_stations`.

For a brand-new organizer format, the add-format dashboard also uses the shared parser client-side as soon as a GPX file is selected. That preview step pre-fills distance, elevation gain, and elevation loss before the race row exists, while the format date inherits the selected canonical edition and the location inherits the event unless their explicit overrides are enabled. After the format is created with its `edition_id`, the pending file is uploaded through the existing GPX route so the same stats are persisted and eligible waypoint ravitos can be created.

Creating an empty yearly edition from the organizer dialog does not create or copy a GPX. GPX cloning occurs only when the organizer keeps edition duplication enabled; a later format added to an empty edition follows the normal pending-file upload flow above.

For an existing format, a successful replacement also copies the exact returned parser values back into the active distance, D+, and D- form fields before and after the event refresh. The refresh keeps the format's edition year selected, so a stable race id does not leave the client form showing stale pre-import metrics while the `races` row already contains the new values.

The organizer information-import review distinguishes a genuinely importable GPX from provider-backed metrics that have no recoverable file. Distance/D+/D- and GPX availability become separate source claims. A GPX can corroborate or supply metrics only after its format identity is unambiguous; distance proximity by itself must not attach an anonymous trace to a named candidate across pages. When explicit format URLs are supplied, a route embedded on the general page cannot filter their candidate set or masquerade as their shared identity. An embedded route on one explicit page may serve as a page-local anchor to consolidate compatible metrics and reject unrelated relay legs or incidental distances from that same page. A confirmed format may remain an incomplete draft without any GPX.

Uploading a GPX later through Organizer clears the imported draft's `distance_km` and `elevation_gain_m` missing markers because those metrics come from the parsed geometry. If no required marker remains, the course becomes complete and catalog-live; its Racebook remains hidden until the independent publication approval flow.

The preview hash includes the SHA-256 digest of each recoverable GPX payload, not only its URL or parsed metrics. Apply can therefore accept a GPX only through its selected claim/proposal in the reviewed snapshot. Existing GPX files remain untouched unless that exact field is selected.

The organizer-side runner preview has been removed, but the GPX map and elevation profile remain inside the always-expanded `Course` editor because they validate the uploaded source file and drive ravito interpolation.

## Review Flow Conflict

`apps/web/components/GpxAidStationImporter.tsx` contains logic for updating existing race aid stations from GPX:

- match by normalized name;
- match by distance tolerance around 1.5 km;
- delete unmatched stations when no linked plans exist;
- mark stations as `needs_review` when linked plans exist.

<!-- CONFLICT: this component references race_aid_stations.needs_review, race_aid_stations.last_gpx_import_at, and plan_aid_stations.race_aid_station_id, but visible migrations in this repo do not create those columns. -->

## Gotchas

- GPX parse errors have specific codes. Preserve them when adding UI messaging.
- Keep `GPX récupéré` tied to importable GPX content, not only to reliable provider metrics; some adapters can know distance/elevation without returning a file.
- Never merge a distance-only GPX detection into a named format automatically. Preserve it as a separate candidate until identity is confirmed.
- Do not let a general-page embedded GPX suppress explicitly supplied format pages; explicit pages own format discovery in that mode. If the general URL is itself repeated as an explicit format URL, reuse its single fetch and let its visible format identity own that route.
- The organizer roadbook workflow is not a GPX upload. Its PDF/image selection permits up to 25 MB per file through temporary private Storage; apply, cancel, or expiry cleanup deletes each object. Larger route files continue to use the dedicated GPX route.
- The roadbook preview and its LLM reconciliation are admin-only and do not change GPX ownership or bypass the dedicated organizer GPX route.
- The mobile parser now exposes preview points for UI route sketches. Keep those points aligned with the same parsed distance accumulation used for distance, D+, and D- so the preview does not disagree with the imported stats.
- Organizer GPX preview sampling now drives ravito cumulative D+ / D- autofill. If the sampling contract changes, keep the client interpolation logic aligned so organizer km edits still recompute stable cumulative values.
- The organizer Ravitos module mixes GPX-derived station rows with race-level start/finish schedule fields. Its save routing must persist the race details before the aid-station rows; the aid-station route cannot store `races.organizer_details.schedule`.
- Organizer tab navigation is immediate, so late GPX preview responses must verify that their requested race is still active before replacing the current preview or station interpolation context.
- Route points can be used when track points are absent.
- Waypoint-only files produce a `waypoint` point source and limited route geometry.
- Do not delete source race aid stations without checking plan linkage once the linkage schema is verified.
- Catalog GPX and plan GPX live in different buckets.
- A Trace de Trail GPX rebuilt from page geometry is not guaranteed to preserve every metadata field from the provider's original file.
- Organizer GPX replacement updates source race data only; saved plans remain snapshots.
- Keep the active organizer form synchronized from the successful GPX response; reloading the event alone does not rerun race-form initialization when the active race id is unchanged.
- Organizer GPX waypoint import is safe-mode only: detected waypoints do not replace existing source stations, because replacing rows would break station ids and product links.
- Source station service flags affect new catalog imports only; existing saved plans keep their previous `planner_values`. Organizer station-product links are the exception at response time: plans with `race_id` can receive current product suggestions from `/api/plans` without rewriting the saved plan row.
- Imported or manually added source aid stations do not count as published organizer mobile content by themselves; the mobile Racebook gate still needs explicit organizer details.
- The organizer notification selector may target a live format after its GPX or metadata work is complete, but notification scope does not parse, copy, or mutate GPX data.
- An incomplete GPX or unsaved GPX-related draft on one format must not block the publication switch of another complete format; foreground persistence is required only for the switched format.
- Removing a sent organizer announcement from public history also leaves GPX files, parsed metrics, and ravito interpolation state unchanged.

## Related Docs

- [race_aid_stations](../02-database/tables/race-aid-stations.md)
- [plan_aid_stations](../02-database/tables/plan-aid-stations.md)
- [Plan Storage](plan-storage.md)
- [Organizer Race Management](organizer-race-management.md)
- [Infrastructure](../01-architecture/infrastructure.md)
