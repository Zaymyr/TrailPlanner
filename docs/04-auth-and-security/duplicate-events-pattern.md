---
title: Duplicate Events Pattern
scope: auth
last_verified: 2026-05-17
ai_priority: high
related_files:
  - apps/web/app/onboarding/account/page.tsx
  - apps/web/app/api/onboarding/save-plan/route.ts
  - apps/web/app/(coach)/race-planner/hooks/useRacePlan.ts
  - apps/mobile/app/_layout.tsx
related_tables:
  - race_plans
---

# Duplicate Events Pattern

## Purpose

Supabase auth flows can emit multiple session-related events for one user action. This document records the guard pattern used to prevent duplicate onboarding plan saves.

## Key Concepts

- Duplicate auth event: repeated sign-in/profile events around email confirmation or session refresh.
- `useRef` guard: in-memory React guard for the current mounted component.
- Module guard: module-level flag that survives component remount in the same runtime.
- Storage flag: session/local storage guard that survives redirects or page reloads.

## Problem

Signup and email-confirmation flows can cause the app to observe more than one session transition for the same user. Without guards, onboarding could save the same plan more than once.

The user-requested pattern is:

- `useRef` guard;
- `sessionStorage` flag;
- optionally `localStorage` flag for redirect/reload survival.

## Current Web Application

`apps/web/app/onboarding/account/page.tsx` applies this pattern:

- module-level `_planSaved`;
- component-level `hasSavedPlan` ref;
- `sessionStorage.getItem('onboarding_plan_saved')`;
- `localStorage.getItem('onboarding_plan_saved')`.

After a successful save it sets:

- `trailplanner.pendingPlanId`;
- `sessionStorage.setItem('onboarding_plan_saved', '1')`;
- `localStorage.setItem('onboarding_plan_saved', '1')`.

`apps/web/app/(coach)/race-planner/hooks/useRacePlan.ts` later removes `trailplanner.pendingPlanId` and both onboarding save flags after loading the pending plan.

## Server-Side Backstop

`apps/web/app/api/onboarding/save-plan/route.ts` adds idempotency:

- with a catalog race id, it checks existing `user_id + race_id`;
- without a race id, it checks plans created within the last 60 seconds.

This is the last line of defense if the browser guard fails.

## Mobile Auth Events

Mobile listens to `supabase.auth.onAuthStateChange` in `apps/mobile/app/_layout.tsx` and other auth screens. The audited code tracks `SIGNED_IN` and sign-out analytics; no direct `USER_UPDATED` handling was found in the same onboarding-save pattern.

## Gotchas

- A `useRef` guard alone does not survive redirects.
- A storage flag alone can stale-lock a user if never cleared.
- Server idempotency is still needed because clients can retry or double-submit.
- Keep `trailplanner.pendingPlanId` cleanup near plan hydration.

## Related Docs

- [Plan Storage](../03-business-rules/plan-storage.md)
- [Session Management](session-management.md)
- [Auth Flows](auth-flows.md)
- [race_plans](../02-database/tables/race-plans.md)
