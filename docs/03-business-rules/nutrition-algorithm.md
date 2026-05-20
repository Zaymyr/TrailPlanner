---
title: Nutrition Algorithm
scope: business-rule
last_verified: 2026-05-20
ai_priority: high
related_files:
  - apps/web/lib/nutrition-planner.ts
  - apps/web/lib/product-types.ts
  - apps/web/lib/fuel-types.ts
  - apps/web/lib/default-products.ts
  - apps/web/app/api/plans/route.ts
  - apps/web/app/(coach)/race-planner/RacePlannerPageContent.tsx
  - apps/web/app/(coach)/race-planner/types.ts
  - apps/web/app/(coach)/race-planner/components/PlanPrimaryContent.tsx
  - apps/web/app/(coach)/race-planner/utils/plan-sanitizers.ts
  - apps/web/app/(coach)/race-planner/utils/__tests__/carryover-nutrition.test.ts
  - apps/web/app/(coach)/race-planner/utils/__tests__/plan-sanitizers.test.ts
  - apps/web/app/(coach)/race-planner/utils/segments.ts
  - apps/web/components/race-planner/ActionPlan.tsx
  - apps/web/components/race-planner/carryoverNutrition.ts
  - apps/web/components/race-planner/useActionPlanDerivedData.ts
  - apps/web/locales/types.ts
  - apps/web/locales/fr.ts
  - apps/web/locales/en.ts
  - apps/mobile/app/(app)/plan/[id]/edit.tsx
  - apps/mobile/app/(app)/plan/new.tsx
  - apps/mobile/components/PlanForm.tsx
  - apps/mobile/components/plan-form/AidStationsSectionV3.tsx
  - apps/mobile/components/plan-form/carryover.ts
  - apps/mobile/components/plan-form/contracts.ts
  - apps/mobile/components/plan-form/EditStationModal.tsx
  - apps/mobile/components/plan-form/helpers.ts
  - apps/mobile/components/plan-form/metrics.ts
  - apps/mobile/components/plan-form/styles.ts
  - apps/mobile/components/plan-form/usePlanSupplies.ts
  - apps/mobile/lib/continuousNutrition.ts
  - apps/mobile/lib/freeTrainingLive.ts
  - apps/mobile/lib/raceLiveSession.ts
  - apps/mobile/app/(app)/training-live.tsx
  - apps/mobile/lib/onboardingDemoPlan.ts
related_tables:
  - products
  - race_plans
---

# Nutrition Algorithm

## Purpose

This document describes how Pace Yourself allocates products to segment nutrition needs. The legacy API allocation source is `apps/web/lib/nutrition-planner.ts`; current planner UIs also use carryover inventory simulation in web and mobile planner components.

## Key Concepts

- Segment need: carbs, sodium, and water required for one race segment.
- Fuel type: product category stored on `products.fuel_type`.
- Electrolyte: product type allocated first based on water demand.
- Carb source: non-electrolyte, non-capsule product with carbs.
- Salt capsule: capsule product used last for sodium top-up.
- Carryover inventory: whole product units physically available after previous sections.
- Nutrition balance: surplus carbs or sodium from consumed whole units that can cover later section demand.
- Aid station services: `waterRefill` controls water refill availability, while `solidRefill` controls product pickup for carbs and sodium.

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

## Planner Carryover Rule

The current planner rule is cumulative across the race, not reset per aid station.

For each outgoing section, the simulator uses the checkpoint at the start of that section:

1. Add products picked up at that checkpoint to the runner's physical inventory only when `solidRefill !== false`.
2. Subtract the next section's carb and sodium needs from the nutrition balance.
3. Consume whole product units from inventory until the cumulative carb/sodium deficit is covered, or until inventory cannot cover it.
4. Carry forward both remaining product units and any nutrient surplus created by whole-unit consumption.

Product units are indivisible. A gel, capsule, bar, drink mix serving, or food item is either unconsumed or fully consumed. If a 25 g gel is consumed to cover a 20 g carb gap just before an aid station, the extra 5 g remains as positive nutrition balance for the next section. The runner may still pick up more inventory at the aid station, but the planner should not require another immediate gel if the nutrition balance already covers the outgoing section.

When a remaining deficit is smaller than one product unit, the simulator still consumes the best available product that contributes to that deficit. The resulting overshoot is intentional whole-unit surplus and must be reflected in coverage gauges.

Mobile ravito gauges display available carbs and sodium at the start of the outgoing segment, not only the units the simulator expects to consume on that segment. Extra products added manually stay in physical inventory for later sections, but the gauge value still increases because the runner is carrying them when leaving that checkpoint.

Gauge targets are resource-specific refill windows. At a checkpoint, carbs and sodium targets sum every outgoing section until the next checkpoint where `solidRefill !== false`. Water targets sum every outgoing section until the next checkpoint where `waterRefill !== false`. These windows can differ: a station with water but no solid resets only the water window, while carbs and sodium continue to accumulate until the next solid pickup point.

If an aid station has `solidRefill === false`, the runner cannot pick up carb/sodium products there. Auto-fill assigns any top-up needed for the outgoing section to the most recent previous checkpoint where solid pickup is enabled, so the runner carries that inventory through the skipped aid station.

Web implementation:

- `apps/web/components/race-planner/carryoverNutrition.ts` simulates whole-unit inventory and nutrition balance for timeline coverage.
- `apps/web/app/(coach)/race-planner/RacePlannerPageContent.tsx` uses the same carryover rule when auto-filling supplies.

Mobile implementation:

- `apps/mobile/components/plan-form/carryover.ts` simulates whole-unit inventory and nutrition balance for gauges.
- `apps/mobile/components/plan-form/usePlanSupplies.ts` uses the same carryover rule when auto-filling supplies.

Water remains separate from product inventory. The planner carries forward remaining water capacity between sections; a station with `waterRefill === false` does not refill the bag, so the outgoing section starts with whatever water remains from the previous section.

## Free Training Live Rule

The mobile free training flow starts a temporary live session without creating or saving a `race_plans` row.

The runner chooses:

- hourly targets for carbs, water, and sodium;
- carried liquid capacity;
- carried products and quantities.

The setup UI may present hourly targets and liquid capacity in a collapsed summary by default, but the calculation must always use the current editable values.

Targets set to `0` are ignored. They do not reduce autonomy, do not generate reminders, and are not shown as active live levels. For active targets, the flow computes resource autonomy independently:

- water autonomy = one default hour before drinking is required, plus carried liquid capacity divided by water target; carried capacity may be `0`;
- carb autonomy = one default hour before eating is required, plus carried product carbs divided by carb target;
- sodium autonomy = one default hour before sodium intake is required, plus carried product sodium divided by sodium target.

If no water, carb, or sodium supply is carried and the matching target is active, mobile still creates a one-hour initial buffer and can remind the runner when intake becomes due. This buffer is an autonomy baseline, not a delay before consuming carried supplies: when water or products are carried, reminders are scheduled from the start of the live session using the normal live rhythm. The UI shows both the first shortage and the last active resource end. During live tracking, reminders continue only for resources with remaining inventory or the initial buffer. If water, carbs, or sodium run out before another resource, those reminders stop silently while the remaining active resources continue.

Liquid products (`drink_mix` and `electrolyte`) occupy carried water capacity. Mobile uses `DEFAULT_FLUID_PRODUCT_VOLUME_ML` (`500 ml`) per liquid product serving. A runner cannot start free training if the selected liquid products require more volume than the carried liquid capacity. Liquid product nutrients are consumed with the water reminders; they do not add extra water beyond the carried capacity.

The free training session uses the same in-memory live session store as race live mode, but passes prebuilt alert specs instead of section-derived plan alerts.

## Legacy API Allocation Order

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

- Planner UI product coverage is cumulative. Do not compute carbs/sodium coverage from only the products assigned to the current aid station.
- Product quantities are whole units for consumption. Fractional product inventory must not be consumed as a fractional gel/bar/capsule.
- A product that covers a small remaining carb or sodium deficit must still count even if it overshoots; do not discard it because of an overshoot penalty.
- Mobile gauge values must use available carried inventory, not only consumed inventory, so manual oversupply remains visible.
- Mobile gauge targets must follow resource refill windows, not only the immediate next section; water and solid windows are independent.
- Nutrient surplus from a consumed whole unit carries forward; it is not discarded at aid stations.
- Free training ignores targets set to `0`; do not treat them as zero-minute blockers.
- Free training gives active water, carb, and sodium targets a default one-hour buffer even when no matching supply is carried.
- The free training one-hour buffer must not postpone reminders for water or products that are actually carried.
- Free training liquid products consume carried liquid capacity; do not count electrolytes or drink mix as volume in addition to water.
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
