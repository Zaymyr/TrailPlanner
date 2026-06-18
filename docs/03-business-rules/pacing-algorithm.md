---
title: Pacing Algorithm
scope: business-rule
last_verified: 2026-06-18
ai_priority: high
related_files:
  - apps/web/app/(planner)/race-planner/utils/segments.ts
  - apps/web/app/(planner)/race-planner/utils/pacing.ts
  - packages/fuel-planner/computeFuelPlan.ts
  - packages/shared/src/index.ts
  - apps/web/lib/nutrition.ts
related_tables:
  - race_plans
---

# Pacing Algorithm

## Purpose

This document records how Pace Yourself estimates segment timing and converts pacing into nutrition planning inputs. The main implementation is in the race-planner utilities under `apps/web/app/(planner)/race-planner/utils`.

## Key Concepts

- Pace: minutes per kilometer.
- Speed: kilometers per hour.
- Segment: course interval between start, aid stations, and finish.
- ETA: estimated elapsed time at a checkpoint.
- Target intake: carbs, water, and sodium scaled by segment duration.

## Web Segment Computation

`apps/web/app/(planner)/race-planner/utils/segments.ts` builds a checkpoint list:

1. Start.
2. Aid stations before the race distance.
3. Finish.

For each segment it computes:

- distance delta;
- elevation influence from the elevation profile;
- estimated duration;
- ETA;
- target carbs;
- target water;
- target sodium;
- carried water shortfall when capacity is insufficient.

Water capacity is based on `waterBagLiters * 1000`. Available water is reduced by segment demand and refilled at stations unless water refill is disabled. Segment objects also carry station service metadata such as `solidRefill`, `assistanceAllowed`, and optional `sourceAidStationId`; these fields support nutrition inventory, recap, and official ravito product matching rather than ETA computation. When assistance is disabled, `segments.ts` keeps only supplies marked `source: "organizer"` because they represent official ravito products rather than crew handoffs.

## Fuel Planner Module

`packages/fuel-planner/computeFuelPlan.ts` is a smaller computation module. It:

- validates distance, pace, and speed as positive;
- sorts aid stations within the race distance;
- computes segment duration as distance times minutes per kilometer;
- scales carb/water/sodium targets by segment duration;
- aggregates totals.

Use it as a simple domain reference, but verify app behavior in `segments.ts` before changing planner UI.

## Shared Alert Schedule

`packages/shared/src/index.ts` builds race alerts from plan inputs. It:

- creates waypoints from start, sorted aid stations, and finish;
- computes cumulative minutes from pace;
- supports time, GPS, or auto trigger modes;
- avoids firing alerts that are confirmed or skipped;
- can re-fire snoozed alerts after their snooze time expires.

## Onboarding Estimate Logic

`apps/web/lib/nutrition.ts` contains simpler onboarding estimates:

- base carbs: 60 g/hour;
- extra carbs for elevation above 1000 m or performance goal;
- base water: 500 ml/hour;
- extra water for elevation above 800 m;
- sodium: 400 mg/hour;
- pace adjusted from a base value by elevation and goal.

This is onboarding guidance, not the full planner segment model.

## Business Invariants

- Segment nutrition targets are time-proportional.
- Aid stations are sorted by distance before segment computation.
- Finish is always a checkpoint.
- Water refill behavior affects carried water availability, not product schema.
- Shared alert logic should stay app-runtime agnostic.

## Gotchas

- Guard against zero or negative speed before dividing.
- Old plans may have aid station or segment data in older shapes inside `planner_values`.
- Segment timing and alert scheduling are related but not identical systems.
- Do not move UI-dependent planner code into `packages/shared`.

## Related Docs

- [Nutrition Algorithm](nutrition-algorithm.md)
- [Plan Storage](plan-storage.md)
- [race_plans](../02-database/tables/race-plans.md)
- [Packages](../01-architecture/packages.md)
