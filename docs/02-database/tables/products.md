---
title: products Table
scope: database
last_verified: 2026-05-20
ai_priority: high
related_files:
  - supabase/migrations/20241215030000_create_products_and_affiliate_offers.sql
  - supabase/migrations/20250214120000_add_product_url_to_products.sql
  - supabase/migrations/20260113170000_add_fuel_type_to_products.sql
  - supabase/migrations/20260322100000_add_created_by_to_products.sql
  - supabase/migrations/20260417103000_add_product_images.sql
  - supabase/migrations/20260417190000_add_product_brand_cleanup.sql
  - apps/web/app/api/products/route.ts
  - apps/web/app/api/products/[productId]/route.ts
  - apps/web/lib/nutrition-planner.ts
related_tables:
  - products
  - affiliate_offers
  - user_favorite_products
---

# `products`

## Purpose

`products` stores fuel products used by nutrition planning and product selection. It stores intrinsic product nutrition, not plan-specific carried water.

## Key Concepts

- Fuel type: enum used by allocation logic.
- Live product: product visible to users.
- Archived product: hidden from normal reads.
- User product: product with `created_by` set.
- Verified/shared catalog product: product with `created_by` null, shown as validated official catalog data in clients.
- Intrinsic nutrition: carbs, sodium, calories, protein, fat per product unit.

## Columns

| Column | Type | Constraints/default | Purpose |
| --- | --- | --- | --- |
| `id` | `uuid` | primary key, default `gen_random_uuid()` | Product id. |
| `created_at` | `timestamptz` | not null, default UTC `now()` | Creation time. |
| `updated_at` | `timestamptz` | not null, trigger-maintained | Last update time. |
| `slug` | `text` | not null, unique | Stable product slug. |
| `sku` | `text` | not null, unique | Product SKU or local identifier. |
| `name` | `text` | not null | Product display name. |
| `fuel_type` | `public.fuel_type` | not null, default `other` | Product category for nutrition allocation. |
| `product_url` | `text` | nullable | Product URL. |
| `image_url` | `text` | nullable | Public product image URL. |
| `brand` | `text` | nullable, normalized by trigger | Product brand. |
| `calories_kcal` | `numeric` | not null, default `0` | Calories per unit. |
| `carbs_g` | `numeric` | not null, default `0` | Carbohydrates per unit. |
| `sodium_mg` | `numeric` | not null, default `0` | Sodium per unit. |
| `protein_g` | `numeric` | not null, default `0` | Protein per unit. |
| `fat_g` | `numeric` | not null, default `0` | Fat per unit. |
| `is_live` | `boolean` | not null, default `false` | Visibility flag. |
| `is_archived` | `boolean` | not null, default `false` | Archive flag. |
| `created_by` | `uuid` | nullable, references `auth.users(id)` on delete set null | User who created the product. |

There is no `water_ml` database column.

## Foreign Keys

- `created_by -> auth.users(id) on delete set null`
- Referenced by `affiliate_offers.product_id`
- Referenced by `user_favorite_products.product_id`

## Indexes

- `products_slug_idx` on `slug`
- `products_is_live_idx` on `is_live`
- `products_fuel_type_idx` on `fuel_type`
- `products_created_by_idx` on `created_by`
- `products_brand_idx` on `lower(brand)`

## RLS Policies

See [../rls-policies.md](../rls-policies.md).

Summary:

- Service role can manage products.
- Authenticated users can read live, non-archived products.
- Anon can read live, non-archived products.
- Users can read their own products.

Mobile product edits and deletes go through `apps/web/app/api/products/[productId]/route.ts`, which verifies the Supabase bearer token, authorizes either the product owner (`created_by`) or an admin from `app_metadata`, then performs the mutation with the server-side service role.

The public product API preserves `createdBy: null` for shared catalog rows so clients can show a verified/validated badge. User-created products return their owner id in `createdBy`.

## Business Invariants

- `fuel_type` drives nutrition allocation order:
  - `electrolyte` first;
  - carb sources such as gels/drink mixes next;
  - `capsule` last for sodium top-up.
- Product rows store nutrition per unit only. Water is a plan/carry context handled by planner logic.
- Web API product mappings set client `waterMl` to `0` because water is not stored on products.
- The 500 ml electrolyte serving assumption lives in `apps/web/lib/nutrition-planner.ts`, not in the product schema.

## Common Queries

Fetch visible products:

```sql
select id, slug, name, fuel_type, carbs_g, sodium_mg, brand, image_url, created_by
from public.products
where is_live = true
  and is_archived = false
order by name asc;
```

Fetch products by fuel type:

```sql
select id, name, carbs_g, sodium_mg
from public.products
where fuel_type = 'electrolyte'
  and is_live = true
  and is_archived = false;
```

## Gotchas

- Do not add `water_ml` to `products` just to support hydration planning. The current algorithm treats water as segment/carry demand.
- `fuel_type` is a Postgres enum. Adding a type requires a migration and app type update.
- `brand` is normalized by a database trigger. Do not duplicate brand inference in multiple clients unless needed for preview UX.
- User-facing product deletion archives the row (`is_live = false`, `is_archived = true`) and removes favorite links instead of physically deleting the product row.

## Related Docs

- [Nutrition Algorithm](../../03-business-rules/nutrition-algorithm.md)
- [Premium Entitlement](../../03-business-rules/premium-entitlement.md)
- [RLS Policies](../rls-policies.md)
- [Schema Overview](../schema-overview.md)
