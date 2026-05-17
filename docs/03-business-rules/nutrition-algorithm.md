---
title: Nutrition Algorithm
scope: business-rule
last_verified: 2026-05-17
ai_priority: high
related_files:
  - apps/web/lib/nutrition-planner.ts
  - apps/web/lib/product-types.ts
  - apps/web/lib/fuel-types.ts
  - apps/web/lib/default-products.ts
  - apps/web/app/api/plans/route.ts
  - apps/web/app/(coach)/race-planner/utils/segments.ts
related_tables:
  - products
  - race_plans
---

# Nutrition Algorithm

## Purpose

This document describes how Pace Yourself allocates products to segment nutrition needs. The implementation source of truth is `apps/web/lib/nutrition-planner.ts`.

## Key Concepts

- Segment need: carbs, sodium, and water required for one race segment.
- Fuel type: product category stored on `products.fuel_type`.
- Electrolyte: product type allocated first based on water demand.
- Carb source: non-electrolyte, non-capsule product with carbs.
- Salt capsule: capsule product used last for sodium top-up.

## Inputs

The allocation function works from:

- segment duration in hours;
- target carbs per hour;
- target sodium per hour;
- target water per hour;
- selected products;
- product nutrition values from `products` or client product objects.

Planner segment code in `apps/web/app/(coach)/race-planner/utils/segments.ts` computes per-segment targets from:

- race distance and aid stations;
- speed/pace;
- elevation profile;
- water carrying capacity;
- per-hour carb/water/sodium targets.

## Allocation Order

`allocateSegmentNutrition` uses this order:

1. Electrolytes first.
2. Carb sources proportionally.
3. Salt capsules last.

### Step 1: Electrolytes First

The algorithm filters products where `fuelType === "electrolyte"`.

It assumes one electrolyte serving covers 500 ml of water demand:

```ts
const quantity = Math.round(waterNeeded / 500);
```

It then subtracts the selected electrolyte product's carbs and sodium from the remaining needs.

This 500 ml value is hardcoded in `apps/web/lib/nutrition-planner.ts`.

### Step 2: Carb Sources Proportionally

The algorithm selects non-electrolyte, non-capsule products with more than 5 g carbs:

```ts
product.fuelType !== "electrolyte"
product.fuelType !== "capsule"
product.carbsGrams > 5
```

It weights the carb split by product carb density, then rounds quantities. This gives higher-carb products a larger share of the remaining carb target.

### Step 3: Salt Capsules Last

The algorithm selects capsule products where `fuelType === "capsule"` and `sodiumMg > 0`.

Capsules fill residual sodium, but are capped at roughly 40% of total sodium need:

```ts
const capsuleCap = Math.ceil((sodiumNeeded * 0.4) / saltProduct.sodiumMg);
```

This prevents salt capsules from becoming the dominant sodium source when electrolyte products should cover most sodium.

## Legacy Path

`computeAidStationNutrition` has a legacy branch when sodium and water targets are not supplied. That branch:

- sorts aid stations by distance;
- splits carbs across selected products using simple weights;
- rounds quantities upward with `Math.ceil`.

Prefer the target-aware path for new work.

## Why `products` Has No `water_ml` Column

The database stores intrinsic product nutrition only:

- calories;
- carbs;
- sodium;
- protein;
- fat;
- fuel type.

Water is plan context, not product nutrition. A runner's water need depends on segment duration, target intake, carried capacity, refill availability, and electrolyte serving assumptions. Current API mappings set the client-side `waterMl` field to `0`, and the electrolyte water assumption is hardcoded in the algorithm.

Do not add `water_ml` to `products` unless the business rule changes from "water demand is segment context" to "a product intrinsically supplies water."

## Product Types

Fuel types are defined by the `public.fuel_type` enum and app types:

- `gel`
- `drink_mix`
- `electrolyte`
- `capsule`
- `bar`
- `real_food`
- `other`

## Gotchas

- `Math.round(waterNeeded / 500)` can produce `0` electrolyte servings for low water demand.
- Carb allocation uses product carbs as weights; products with `carbs_g <= 5` are excluded from carb-source allocation.
- Sodium from electrolytes and carb products is subtracted before capsule allocation.
- If product routes omit sodium in a select, sodium allocation can undercount. Check route selects when changing nutrition behavior.
- Do not document `water_ml` as a product schema field.

## Related Docs

- [Products Table](../02-database/tables/products.md)
- [Pacing Algorithm](pacing-algorithm.md)
- [Plan Storage](plan-storage.md)
- [Add New Table](../06-workflows/add-new-table.md)
