---
title: plan_aid_stations Table
scope: database
last_verified: 2026-05-28
ai_priority: high
related_files:
  - supabase/migrations/20251220120000_add_race_catalog.sql
  - apps/web/app/api/plans/from-catalog/route.ts
  - apps/web/components/GpxAidStationImporter.tsx
related_tables:
  - plan_aid_stations
  - race_plans
  - race_aid_stations
  - race_aid_station_products
---

# `plan_aid_stations`

## Purpose

`plan_aid_stations` stores the aid station snapshot attached to a saved plan. These rows let a plan preserve or edit aid station data independently from the source race catalog.

## Key Concepts

- Plan snapshot: aid station data copied or derived for one plan.
- Source station: the race catalog aid station, when a link exists.
- Water availability: whether the station can refill water.
- Order index: deterministic display order.

## Columns

| Column | Type | Constraints/default | Purpose |
| --- | --- | --- | --- |
| `id` | `uuid` | primary key, default `gen_random_uuid()` | Stable station id. |
| `plan_id` | `uuid` | not null, references `race_plans(id)` on delete cascade | Parent saved plan. |
| `name` | `text` | not null | Station display name. |
| `km` | `numeric` | not null | Station distance in kilometers. |
| `water_available` | `boolean` | not null, default `true` | Whether water refill is available. |
| `notes` | `text` | nullable | Free-form station notes. |
| `order_index` | `int` | not null, default `0` | Sort order within the plan. |

<!-- CONFLICT: apps/web/components/GpxAidStationImporter.tsx references plan_aid_stations.race_aid_station_id, but no visible migration in this repo adds that column. Verify live schema before relying on it. -->

## Foreign Keys

- `plan_id -> public.race_plans(id) on delete cascade`

## Indexes

- `plan_aid_stations_plan_order_idx` on `(plan_id, order_index)`

## RLS Policies

See [../rls-policies.md](../rls-policies.md).

Summary:

- Users can select stations whose parent plan belongs to them.
- Users can insert/update/delete stations only for their own parent plans.

## Business Invariants

- `plan_id` must point to a saved plan owned by the acting user under RLS.
- `race_aid_station_id` should be treated as uncertain until the schema conflict is resolved.
- Plan stations can diverge from `race_aid_stations`; they are plan-specific.
- Catalog imports write plan stations after creating the parent plan and roll back best-effort on failure.
- Organizer station-product suggestions are not stored in `plan_aid_stations`; imported plans keep them in `race_plans.planner_values.organizerAidStationProducts`.

## Common Queries

Fetch plan aid stations in display order:

```sql
select id, name, km, water_available, notes, order_index
from public.plan_aid_stations
where plan_id = '<plan-id>'
order by order_index asc, km asc;
```

Delete stations when replacing a plan station snapshot:

```sql
delete from public.plan_aid_stations
where plan_id = '<plan-id>';
```

## Gotchas

- Do not assume these rows stay in sync with `race_aid_stations`.
- If adding `race_aid_station_id`, update RLS, importer docs, and migration docs together.
- Do not add product availability or stock columns here for organizer ravito products. Use `race_aid_station_products` on the source race and planner JSON suggestions on import.
- The UI uses `distanceKm`; the database column is `km`.

## Related Docs

- [race_plans](race-plans.md)
- [race_aid_stations](race-aid-stations.md)
- [GPX Import](../../03-business-rules/gpx-import.md)
- [Organizer Race Management](../../03-business-rules/organizer-race-management.md)
- [Relationships](../relationships.md)
