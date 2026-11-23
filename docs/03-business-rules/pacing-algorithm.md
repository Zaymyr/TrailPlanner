---
title: Pacing Algorithm
scope: business-rule
last_verified: 2026-11-23
# Structured station phase (2026-11-15): optional amenities, supporter access and maximum-stop metadata remain in organizer JSON; runner surfaces prefer them while preserving legacy notes, and planner pauses only warn when they exceed the organizer limit.
ai_priority: high
related_files:
  - apps/web/app/(planner)/race-planner/utils/segments.ts
  - apps/web/app/(planner)/race-planner/utils/pacing.ts
  - apps/web/app/(planner)/race-planner/utils/section-recompute.ts
  - apps/web/app/(planner)/race-planner/utils/segmentation.ts
  - apps/web/app/(planner)/race-planner/utils/quick-estimate.ts
  - apps/web/app/(planner)/race-planner/utils/__tests__/quick-estimate.test.ts
  - apps/web/app/(planner)/race-planner/utils/__tests__/planner-utils.test.ts
  - apps/web/app/(planner)/race-planner/utils/__tests__/section-recompute.test.ts
  - packages/fuel-planner/computeFuelPlan.ts
  - packages/shared/src/index.ts
  - packages/shared/src/plan-timeline/profile-utils.ts
  - packages/shared/src/plan-timeline/section-summary.ts
  - apps/mobile/components/plan-form/profile-utils.ts
  - apps/mobile/components/plan-form/section-summary.ts
  - apps/web/lib/nutrition.ts
related_tables:
  - race_plans
---

# Pacing Algorithm

`packages/shared/src/index.ts` also re-exports `racebook-cutoffs` (official cutoff resolution for the Supporter Guide); pacing exports are unchanged.

The additional `@trailplanner/shared` Supporter Guide export is a transport DTO only. It does not calculate, persist or modify pacing, ETA interpolation or nutrition inputs.

## Assistant timeline interpolation

Supporter points between saved checkpoints use linear kilometer interpolation over plan arrival minutes. After a confirmed passage, points at or beyond the latest preceding confirmation receive that checkpoint's signed actual-versus-planned delta. This presentation calculation does not rewrite pacing sections or the snapshot. Completion uses the greatest plan duration or published cutoff/day offset, followed by a six-hour margin.

The new `@trailplanner/shared` export does not change pace calculation. It only recalculates crew-facing absolute ETAs from immutable checkpoint `arrivalMinute` values after a confirmed passage; it never rewrites section pace or the stored plan.

## Quick estimate and UTMB Index (2026-11-16)

`utils/quick-estimate.ts` computes an account-free finishing time with the same `estimateEffortDurationSeconds` model and default fatigue (0.5) as the planner, start → each public ravito → finish, without pauses or per-section adjustments. The downsampled public route preview supplies the D+/D− shape and is scaled to the official distance, D+ and D− totals; without a profile, elevation is spread linearly. Stations outside `(0, distance)` are ignored.

The UTMB Index is converted to a comfortable flat pace as `3.2 × 1000 / index` min/km (index clamped to 150–1000, pace to 3–15 min/km): 800 → 4:00, 520 → 6:09, 400 → 8:00. The 3.2 reference is a calibration assumption (an index around 950 lands near elite times on long mountain ultras with this model), not a published UTMB formula. <!-- TODO: verify with maintainer — UTMB Index → flat pace calibration --> When both inputs are given, the flat pace drives the main estimate and the UTMB figure is shown as a comparison. Public course pages reuse the module for three reference levels (5:00, 6:30, 8:00 /km).

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

Moving duration uses an equivalent-distance model: each `100 m` of D+ adds one flat-equivalent kilometer and each `300 m` of D- adds one. A smooth fatigue slowdown starts only after a threshold derived from `fatigueLevel` and uses elapsed race time. Per-segment pace adjustments are added after that effort estimate.

Sub-section recomputation accepts either an elevation-aware `estimateSeconds` callback or a simpler flat `secondsPerKm` / `speedKph` fallback. The fallback deliberately multiplies physical distance only; callers that need D+, D- and fatigue must supply the estimator, as the planner and social-template builder do.

Water capacity is based on `waterBagLiters * 1000`. Available water is reduced by segment demand and refilled at stations unless water refill is disabled. Segment objects also carry station service metadata such as `solidRefill`, `assistanceAllowed`, and optional `sourceAidStationId`; these fields support nutrition inventory, recap, and official ravito product matching rather than ETA computation. When assistance is disabled, `segments.ts` keeps only supplies marked `source: "organizer"` because they represent official ravito products rather than crew handoffs.

## Shared mobile pacing model (plan-timeline, 2026-11-23)

The mobile plan editor's section pacing now lives in `packages/shared/src/plan-timeline/` so the web « Chronologie » tab runs the same timing as the mobile Chronologie:

- `profile-utils.ts` (moved from `apps/mobile/components/plan-form/profile-utils.ts`): elevation slices, section sub-segments, `estimateEffortDurationSeconds` (same equivalent-distance + fatigue formula as the web `utils/pacing.ts`) and `recomputeSectionFromSubSections`.
- `section-summary.ts` (moved from `apps/mobile/components/plan-form/section-summary.ts`): `getBaseSpeedKph` and `buildPlanSectionSummary` — per section, movement ETA from `sectionSegments["section-N"]` (the outgoing station's `pauseMinutes` added), targets scaled by duration, D+/D− from sub-segment stats. Without an elevation profile, a section receives a pro-rata D+ fallback profile.

The mobile files are one-line re-exports; behavior is unchanged (golden test `apps/mobile/lib/continuousNutrition.test.ts`). This model reads only `sectionSegments` adjustments, not the web per-station `segmentMinutesOverride` / `paceAdjustmentMinutesPerKm` fields used by `segments.ts`, so a web plan that relies on those station-level overrides can show Chronologie section times that differ from its web timeline ETAs.

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
- Do not expect `secondsPerKm` alone to apply elevation equivalence during sub-section recomputation; that field is the explicit flat fallback.
- Do not move UI-dependent planner code into `packages/shared`.
- The web planner (`segments.ts`) and the shared plan-timeline section summary are two pacing paths over the same effort formula. Change the formula in both, or consolidate them deliberately; the shared one also drives mobile live mode and recaps (OTA on merge).

## Related Docs

- [Nutrition Algorithm](nutrition-algorithm.md)
- [Plan Storage](plan-storage.md)
- [race_plans](../02-database/tables/race-plans.md)
- [Packages](../01-architecture/packages.md)
