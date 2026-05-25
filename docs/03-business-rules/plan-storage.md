---
title: Plan Storage
scope: business-rule
last_verified: 2026-05-19
ai_priority: high
related_files:
  - apps/web/app/onboarding/account/page.tsx
  - apps/web/app/api/onboarding/save-plan/route.ts
  - apps/web/app/(coach)/race-planner/hooks/useRacePlan.ts
  - apps/web/app/(coach)/race-planner/utils/plan-sanitizers.ts
  - apps/web/app/(coach)/race-planner/utils/__tests__/plan-sanitizers.test.ts
  - apps/web/app/api/plans/route.ts
  - apps/web/lib/race-planner-storage.ts
  - apps/web/lib/auth-storage.ts
  - apps/mobile/app/(app)/plan/[id]/edit.tsx
  - apps/mobile/app/(app)/plan/new.tsx
  - apps/mobile/lib/onboardingDemoPlan.ts
related_tables:
  - race_plans
  - plan_aid_stations
---

# Plan Storage

## Purpose

This document explains where planner state lives before signup, during onboarding account creation, and after a user has a verified session.

## Key Concepts

- Onboarding state: browser-local planner state before account persistence.
- Pending plan: saved server plan id that should be auto-loaded after sign-in.
- `planner_values`: JSONB planner state in `race_plans`.
- Hydration: mapping saved JSON back into form state.
- Idempotency guard: client and server duplicate-save protection.
- Aid station service flags: `waterRefill` and `solidRefill` are stored per station. Missing flags hydrate as enabled for backward compatibility.

## Onboarding Stage

Before signup, planner state is local to the browser. The onboarding account page reads onboarding plan data and prepares a server save after account creation.

Local/session keys involved in the flow include:

- `onboarding_plan_saved`
- `trailplanner.pendingPlanId`
- session tokens under `trailplanner.accessToken`, `trailplanner.refreshToken`, and `trailplanner.sessionEmail`

## Signup Save

`apps/web/app/onboarding/account/page.tsx` saves the onboarding plan after signup.

Duplicate protection exists at multiple levels:

- module-level `_planSaved`;
- component `hasSavedPlan` ref;
- `sessionStorage.getItem('onboarding_plan_saved')`;
- `localStorage.getItem('onboarding_plan_saved')`.

On successful save, the flow stores `trailplanner.pendingPlanId`, marks `onboarding_plan_saved`, and clears onboarding local storage.

## Server Save

`apps/web/app/api/onboarding/save-plan/route.ts` uses the service role to save an onboarding plan for a known user id.

Idempotency behavior:

- if `catalogRaceId` exists, it checks for an existing plan by `user_id + race_id`;
- without a race id, it checks plans created in the last 60 seconds;
- it inserts `race_plans` with `user_id`, `name`, `planner_values`, `elevation_profile`, and optional `race_id`.

## Post-Signup Storage

After signup, `race_plans` is the source of truth:

- `planner_values` stores form/planner JSON.
- `elevation_profile` stores elevation points separately.
- `race_id` links to source race when applicable.
- `plan_gpx_path` and `plan_course_stats` store catalog GPX import metadata.

Aid station entries in `planner_values.aidStations` persist both service flags:

- `waterRefill: false` means the station cannot refill water.
- `solidRefill: false` means the station cannot provide carb/sodium products, and persisted `supplies` for that station should hydrate as empty.

`apps/web/app/api/plans/route.ts` creates, updates, fetches, and deletes saved plans.

## Hydration on Read

`apps/web/app/(coach)/race-planner/hooks/useRacePlan.ts` maps saved rows into planner state.

It:

- reads `planner_values` and `elevation_profile`;
- handles `race_id` and old `catalog_race_id` naming;
- sanitizes aid stations, start supplies, finish plan, segments, and elevation;
- auto-loads `trailplanner.pendingPlanId` after signup;
- removes pending/duplicate-save flags after loading.

## Business Invariants

- Onboarding state stays local until signup.
- After signup, `race_plans.planner_values` is the durable planner JSON.
- `elevation_profile` is stored outside `planner_values`.
- Email confirmation or duplicated auth events must not create duplicate plans.
- A catalog plan import should not recreate a plan repeatedly while the same URL/action is still active.

## Gotchas

- Do not save twice on Supabase email confirmation or duplicate session events.
- Do not assume every saved plan has current planner JSON shape.
- Treat missing `solidRefill` and `waterRefill` values as enabled on intermediate aid stations.
- Clearing auth/session state should clear race planner local storage.
- Updating by plan name in `/api/plans` can patch an existing plan rather than creating a new one.

## Related Docs

- [race_plans](../02-database/tables/race-plans.md)
- [Duplicate Events Pattern](../04-auth-and-security/duplicate-events-pattern.md)
- [GPX Import](gpx-import.md)
- [Premium Entitlement](premium-entitlement.md)
