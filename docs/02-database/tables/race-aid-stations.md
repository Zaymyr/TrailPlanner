---
title: race_aid_stations Table
scope: database
last_verified: 2026-05-28
ai_priority: high
related_files:
  - supabase/migrations/20251220120000_add_race_catalog.sql
  - supabase/migrations/20260324000000_refactor_race_catalog_to_races.sql
  - supabase/migrations/20260528120000_add_organizer_portal.sql
  - apps/web/app/api/race-catalog/route.ts
  - apps/web/app/api/races/route.ts
  - apps/web/app/api/organizer/races/[id]/aid-stations/route.ts
  - apps/web/app/api/organizer/races/[id]/aid-station-products/route.ts
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
- Water availability: station refill availability.
- GPX waypoint import: route/admin logic can derive stations from GPX waypoints.
- Organizer products: optional station-product links live in `race_aid_station_products`.

## Columns

| Column | Type | Constraints/default | Purpose |
| --- | --- | --- | --- |
| `id` | `uuid` | primary key, default `gen_random_uuid()` | Stable race aid station id. |
| `race_id` | `uuid` | not null, references race table on delete cascade | Parent race. |
| `name` | `text` | not null | Station display name. |
| `km` | `numeric` | not null | Station distance in kilometers. |
| `water_available` | `boolean` | not null, default `true` | Whether water refill is available. |
| `notes` | `text` | nullable | Station notes. |
| `order_index` | `int` | not null, default `0` | Sort order within the race. |

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

## Business Invariants

- Race aid stations are source data, not per-plan state.
- When a plan is created from catalog, these rows are copied into `plan_aid_stations`.
- If a race has no aid stations, import code may derive stations from GPX waypoints.
- Existing code attempts to avoid destructive deletion when linked plan stations exist, but the link column is not visible in migrations.
- Organizer station-product links are source metadata and should be updated alongside station edits when preserving station identity matters.

## Common Queries

Fetch source aid stations for a race:

```sql
select id, name, km, water_available, notes, order_index
from public.race_aid_stations
where race_id = '<race-id>'
order by order_index asc, km asc;
```

Insert stations after GPX/manual catalog creation:

```sql
insert into public.race_aid_stations (race_id, name, km, water_available, order_index)
values ('<race-id>', 'Aid station 1', 12.5, true, 0);
```

## Gotchas

- Old docs and migrations call the parent table `race_catalog`; current code uses `races`.
- Code uses `distanceKm`; the database column is `km`.
- Review-related columns need live-schema verification before new importer work.
- Deleting and recreating a station changes its id and removes `race_aid_station_products` links through cascade; update existing rows when preserving product suggestions matters.

## Related Docs

- [race_events](race-events.md)
- [plan_aid_stations](plan-aid-stations.md)
- [race_aid_station_products](race-aid-station-products.md)
- [GPX Import](../../03-business-rules/gpx-import.md)
- [Relationships](../relationships.md)
