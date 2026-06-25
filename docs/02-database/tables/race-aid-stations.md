---
title: race_aid_stations Table
scope: database
last_verified: 2026-06-25
ai_priority: high
related_files:
  - supabase/migrations/20251220120000_add_race_catalog.sql
  - supabase/migrations/20260324000000_refactor_race_catalog_to_races.sql
  - supabase/migrations/20260528120000_add_organizer_portal.sql
  - supabase/migrations/20260618120000_add_race_aid_station_service_flags.sql
  - supabase/migrations/20260618160000_add_organizer_dashboard_details.sql
  - apps/web/app/api/race-catalog/route.ts
  - apps/web/app/api/races/route.ts
  - apps/web/app/api/organizer/races/[id]/gpx/route.ts
  - apps/web/app/api/organizer/races/[id]/gpx/route.test.ts
  - apps/web/app/api/organizer/races/[id]/aid-stations/route.ts
  - apps/web/app/api/organizer/races/[id]/aid-stations/route.test.ts
  - apps/web/app/api/organizer/races/[id]/aid-station-products/route.ts
  - apps/web/lib/organizer-dashboard-details.ts
  - apps/web/components/GpxAidStationImporter.tsx
related_tables:
  - race_aid_stations
  - race_aid_station_products
  - races
  - plan_aid_stations
---

# `race_aid_stations`

## Purpose

`race_aid_stations` stores source aid stations for rows in `races`. These rows feed catalog imports and private race setup before a plan-specific snapshot is created.

## Key Concepts

- Source aid station: aid station owned by a race.
- Catalog import: copying race stations into a saved plan.
- Service availability: water refill, official solid food, and crew assistance availability.
- GPX waypoint import: route/admin logic can derive stations from GPX waypoints.
- Organizer products: optional station-product links live in `race_aid_station_products`.
- Organizer station details: optional JSONB for station type, cumulative D+/D-, altitude, cutoff time, drop bag, and organizer note. The shared dashboard-detail parser also contains event/race schemas, but the station JSON shape remains scoped to station metadata. Format-level start and finish times are not stored as fake aid stations; they stay in `races.organizer_details.schedule` and are only rendered alongside ravitos in the organizer UI.

## Columns

| Column | Type | Constraints/default | Purpose |
| --- | --- | --- | --- |
| `id` | `uuid` | primary key, default `gen_random_uuid()` | Stable race aid station id. |
| `race_id` | `uuid` | not null, references race table on delete cascade | Parent race. |
| `name` | `text` | not null | Station display name. |
| `km` | `numeric` | not null | Station distance in kilometers. |
| `water_available` | `boolean` | not null, default `true` | Whether water refill is available. |
| `solid_available` | `boolean` | not null, default `true` | Whether official solid food is available. |
| `assistance_allowed` | `boolean` | not null, default `true` | Whether personal crew assistance is allowed. |
| `notes` | `text` | nullable | Station notes. |
| `order_index` | `int` | not null, default `0` | Sort order within the race. |
| `organizer_details` | `jsonb` | nullable, added by `20260618160000_add_organizer_dashboard_details.sql` | Organizer-managed progressive station details. |

<!-- CONFLICT: apps/web/components/GpxAidStationImporter.tsx references race_aid_stations.needs_review and race_aid_stations.last_gpx_import_at, but visible migrations in this repo do not create those columns. -->

## Foreign Keys

- `race_id -> public.races(id)` after the `race_catalog` to `races` rename.
- Referenced by `race_aid_station_products.race_aid_station_id` with cascade delete.

## Indexes

- `race_aid_stations_race_order_idx` on `(race_id, order_index)`

## RLS Policies

See [../rls-policies.md](../rls-policies.md).

Summary:

- Public/live race aid stations are readable through parent race visibility.
- Private race aid stations are readable/manageable by the race owner.
- Admins can manage catalog aid stations.
- Approved event organizers can manage source aid stations through service routes after an active event-membership check.
- `organizer_details` inherits the same row policies as the station row; no separate JSONB grants or policies were added.

## Business Invariants

- Race aid stations are source data, not per-plan state.
- When a plan is created from catalog, water availability is copied into `plan_aid_stations`, while water, solid, and assistance flags are copied into `race_plans.planner_values.aidStations`.
- If a race has no aid stations, import code may derive stations from GPX waypoints.
- Existing code attempts to avoid destructive deletion when linked plan stations exist, but the link column is not visible in migrations.
- Organizer station-product links are source metadata and should be updated alongside station edits when preserving station identity matters.
- The organizer product picker requires a saved source station id; new ravitos must be saved before products can be attached.
- Organizer station details are saved together with station edits through `/api/organizer/races/[id]/aid-stations`; preserving row ids also preserves those details.
- The organizer ravito tile now also surfaces the fixed `Départ` and `Arrivée` timing cards, but those values are not part of `race_aid_stations` and must not be persisted as synthetic rows.
- Organizer GPX upload creates stations from waypoints only when a format has no existing source stations; existing station ids are preserved and must be edited through the ravito route.

## Common Queries

Fetch source aid stations for a race:

```sql
select id, name, km, water_available, solid_available, assistance_allowed, notes, order_index, organizer_details
from public.race_aid_stations
where race_id = '<race-id>'
order by order_index asc, km asc;
```

Insert stations after GPX/manual catalog creation:

```sql
insert into public.race_aid_stations (
  race_id,
  name,
  km,
  water_available,
  solid_available,
  assistance_allowed,
  organizer_details,
  order_index
)
values ('<race-id>', 'Aid station 1', 12.5, true, true, true, '{"stationType":"water"}'::jsonb, 0);
```

## Gotchas

- Old docs and migrations call the parent table `race_catalog`; current code uses `races`.
- Code uses `distanceKm`; the database column is `km`.
- Review-related columns need live-schema verification before new importer work.
- Deleting and recreating a station changes its id and removes `race_aid_station_products` links through cascade; update existing rows when preserving product suggestions matters.
- Do not use organizer GPX upload to replace existing stations; safe-mode waypoint import avoids breaking station-product links.
- Missing service flags from legacy reads should be treated as enabled to preserve old catalog behavior.
- Missing `organizer_details` from legacy reads should be parsed as empty/default dashboard details, not treated as invalid station data.

## Related Docs

- [race_events](race-events.md)
- [plan_aid_stations](plan-aid-stations.md)
- [race_aid_station_products](race-aid-station-products.md)
- [GPX Import](../../03-business-rules/gpx-import.md)
- [Relationships](../relationships.md)
