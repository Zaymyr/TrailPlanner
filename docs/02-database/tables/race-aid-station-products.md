---
title: race_aid_station_products Table
scope: database
last_verified: 2026-06-18
ai_priority: high
related_files:
  - supabase/migrations/20260528120000_add_organizer_portal.sql
  - apps/web/app/api/organizer/races/[id]/aid-station-products/route.ts
  - apps/web/app/api/plans/route.ts
  - apps/web/app/api/plans/from-catalog/route.ts
  - apps/web/app/api/plans/from-catalog/route.test.ts
  - apps/web/lib/organizer-aid-station-products.ts
  - apps/web/app/(planner)/race-planner/RacePlannerPageContent.tsx
  - apps/web/app/(planner)/race-planner/types.ts
  - apps/web/components/race-planner/ActionPlan.tsx
related_tables:
  - race_aid_station_products
  - race_aid_stations
  - race_event_organizers
  - products
---

# `race_aid_station_products`

## Purpose

`race_aid_station_products` links products to source race aid stations so organizers can publish what will be available at each ravito.

## Key Concepts

- Presence link: the row says a product is offered at one station.
- Organizer-scoped product: a non-live `products` row created by an organizer for this context.
- Catalog product link: a live catalog product selected by the organizer.
- Organizer product picker: the dashboard picker lists live catalog products with visible nutrition characteristics before creating these links.
- Planner suggestion: imported plans copy these links into planner JSON as a fallback snapshot, and saved plans with `race_id` receive current ravito-scoped suggestions from this table on `/api/plans` GET. Suggestions are not default auto-fill inventory. If a runner selects one, the plan stores it as a station supply with `source: "organizer"`.
- Station service flags: water, solid, and assistance availability are stored on `race_aid_stations`, not on product link rows.

## Columns

| Column | Type | Constraints/default | Purpose |
| --- | --- | --- | --- |
| `id` | `uuid` | primary key, default `gen_random_uuid()` | Link id. |
| `created_at` | `timestamptz` | not null, default UTC `now()` | Creation time. |
| `updated_at` | `timestamptz` | not null, trigger-maintained | Last update time. |
| `race_aid_station_id` | `uuid` | not null, references `race_aid_stations(id)` on delete cascade | Source aid station. |
| `product_id` | `uuid` | not null, references `products(id)` on delete cascade | Offered product. |
| `notes` | `text` | nullable | Organizer note for the station/product. |
| `order_index` | `integer` | not null, default `0` | Display order within the station. |

## Foreign Keys

- `race_aid_station_id -> public.race_aid_stations(id) on delete cascade`
- `product_id -> public.products(id) on delete cascade`

## Indexes

- `race_aid_station_products_station_product_key` unique on `(race_aid_station_id, product_id)`
- `race_aid_station_products_station_idx` on `(race_aid_station_id, order_index)`
- `race_aid_station_products_product_idx` on `product_id`

## RLS Policies

See [../rls-policies.md](../rls-policies.md).

Summary:

- Rows are selectable when the parent race is public/live, user-owned, managed by an active event organizer, or admin-visible.
- Organizers and admins can insert, update, and delete rows for stations under events they manage.
- Insert/update checks only allow live non-archived products, products created by the acting user, or admin access.

## Business Invariants

- The row stores product presence, order, and optional notes only. It does not store stock or quantities.
- Organizer-created products stay `is_live = false`, `is_archived = false`, `is_official = false`, and `created_by = organizer user`.
- Organizer-created products are not global catalog products and should not appear in `/api/products`.
- Imported runner plans store organizer suggestions in `planner_values.organizerAidStationProducts` as fallback data; `/api/plans` refreshes the current links from `race_aid_station_products` into responses for plans with `race_id` without mutating the saved plan row. Web auto-fill can use ravito-scoped suggestions only when the runner enables the ravito-products option, favorites a product, or explicitly selects it. Selected suggestions become `supplies` with `source: "organizer"` so they remain distinct from personal crew handoffs.
- Organizer suggestions are not the same thing as planner `assistanceAllowed`. A station can offer official ravito products while still being unavailable to the runner's crew.
- `race_aid_stations.solid_available` can describe official solid service even when no product links have been entered yet.
- Organizer station-product replacement payloads may omit `notes` or send `notes = null`; the API normalizes empty notes to `null` and replaces the full ordered set for that station.

## Common Queries

Fetch products for one race aid station:

```sql
select id, product_id, notes, order_index
from public.race_aid_station_products
where race_aid_station_id = '<station-id>'
order by order_index asc;
```

Fetch linked products for a set of stations:

```sql
select race_aid_station_id, product_id, notes, order_index
from public.race_aid_station_products
where race_aid_station_id in ('<station-id-1>', '<station-id-2>')
order by order_index asc;
```

## Gotchas

- Do not treat these rows as plan supplies by default. They are organization suggestions attached to source station rows and become plan supplies with `source: "organizer"` only after explicit runner selection or the web ravito-products auto-fill opt-in.
- Do not assume an imported plan's stored `organizerAidStationProducts` is fresh. For plans with `race_id`, `/api/plans` should overlay the current source links and use the stored snapshot only as a fallback.
- Do not infer crew access from these rows; crew access is stored per runner plan station as `assistanceAllowed`.
- Do not infer official solid availability only from linked products; use `race_aid_stations.solid_available` for the source service flag.
- Deleting a source `race_aid_stations` row deletes its product links.
- Product deletion cascades to these links, so organizer-scoped product cleanup removes station presence rows.
- Do not attach products to unsaved organizer ravitos; the link requires a stable `race_aid_station_id`.

## Related Docs

- [race_aid_stations](race-aid-stations.md)
- [products](products.md)
- [Nutrition Algorithm](../../03-business-rules/nutrition-algorithm.md)
- [Organizer Race Management](../../03-business-rules/organizer-race-management.md)
