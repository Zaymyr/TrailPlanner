---
title: Mobile offline access (RaceBook, Supporter Guide, plans)
scope: business-rule
last_verified: 2026-11-18
ai_priority: high
related_files:
  - apps/mobile/lib/offlineCache.ts
  - apps/mobile/lib/offlineCacheFormat.ts
  - apps/mobile/lib/offlineCacheFormat.test.ts
  - apps/mobile/lib/offlineFollowedPlans.ts
  - apps/mobile/lib/racebook.ts
  - apps/mobile/lib/racebook.published.test.ts
  - apps/mobile/lib/plansScreenBootstrap.ts
  - apps/mobile/lib/onboardingGate.ts
  - apps/mobile/hooks/usePlansScreen.ts
  - apps/mobile/hooks/useFollowedPlans.ts
  - apps/mobile/app/_layout.tsx
  - apps/mobile/app/(app)/plans.tsx
  - apps/mobile/app/(app)/race/[id]/racebook.tsx
  - apps/mobile/app/(app)/courses/supporter-guide/[raceId].tsx
  - apps/mobile/app/(app)/plan/[id]/edit.tsx
  - apps/mobile/app/(app)/plan/followed/[id].tsx
  - apps/mobile/components/plan-workspace/PlanRecapContent.tsx
  - apps/mobile/components/plans/FollowedPlansList.tsx
related_tables:
  - race_plans
  - plan_share_follows
---

# Mobile offline access

## Purpose

Trail races start and run where the network is weak or absent. The mobile app keeps, on the device, a copy of the last successfully loaded **Livret coureur** (RaceBook), **Livret supporter** (Supporter Guide), the runner's **plans** and the **followed (supporter) plans**, and shows that copy when the server cannot be reached. Lot 1 covers the "last loaded version" copy; an explicit "download for race day" action and offline queuing of crew actions are not implemented.

## Key Concepts

- **Device copy**: a JSON file in the app document directory (`<document>/offline-cache/<kind>--<key>.json`), written by `apps/mobile/lib/offlineCache.ts`. The envelope (`{ v, savedAt, data }`) and every pure rule live in `apps/mobile/lib/offlineCacheFormat.ts`. AsyncStorage is not used because its per-entry size limit on Android is too small for course profiles.
- **Unreachable vs answered**: a copy is shown only when the server could not answer — transport failure (no network, timeout, abort, PostgREST `status: 0`) or HTTP 5xx (`isNetworkFailure`, `isPostgrestNetworkFailure`, `isServerUnavailableStatus`). An authoritative HTTP answer (404, 403, 410…) never falls back to a copy.
- **Saved at**: each copy records the time of the network load that produced it. Screens showing a copy display it (`t.common.offlineTitle` / `offlineCopy` via `TapeAlertBanner`, or `offlineToast` via `BriefToast` on the plan workspace).

## Copies kept

| Kind | Key | Written when | Read when |
|---|---|---|---|
| `racebook` | race id | the RaceBook screen loads a published, openable RaceBook from `/api/racebook-data` (and again when its sponsors arrive) | `fetchRaceRacebookDataOutcome` reports `reachable: false` |
| `supporter-guide` | race id | `/api/supporter-guide` answers 200 | the request throws or answers 5xx (initial load only) |
| `plans-list` | user id | `fetchPlansScreenBootstrap` succeeds | the `race_plans` list query fails with a transport error |
| `plan` | user id + plan id | the plan workspace loads the plan row, and after every successful save | the plan row query fails with a transport error |
| `plan-race-start` | plan id | the plan summary resolves the race date, official start time and start waves | the `race_plans` query of the summary fails with a transport error |
| `followed-plans` | user id | `GET /api/plan-share-follows` succeeds | the call throws without HTTP status or with 5xx |
| `followed-plan` | user id + follow id | the followed plan loads, and after each successful crew-state update | same as above |

A plan copy stores the raw `race_plans` row, the best elevation profile and only the products the plan references (`collectPlanProductIdsFromValues`), so the summary keeps product names offline.

## Rules

1. **Only published content is copied.** The RaceBook copy is the screen snapshot of an API-published RaceBook (`publicationId`), never source tables, so the "no draft fallback" rule of `fetchRaceRacebookData` still holds. When the API answers that the RaceBook (404 → `reachable: true`, `data: null`) or the Supporter Guide (404) is no longer published, the copy is deleted.
2. **Access ends the copy.** A followed plan answered with an HTTP status below 500 (unfollowed, revoked share, 410) deletes its copy.
3. **Copies belong to the account.** Plan and followed-plan copies are keyed by user id; every copy is deleted on `SIGNED_OUT` (`clearOfflineCache` in `apps/mobile/app/_layout.tsx`).
4. **A copy never refreshes its own timestamp.** Only a network load (or a successful save / crew-state update) rewrites a copy; showing a copy, or the in-memory warm snapshot of the RaceBook screen, does not.
5. **Offline launch keeps the account.** When the access token has expired and the refresh fails for lack of network, supabase-js reports no session although the refresh token is still stored. The root layout then uses the persisted session (`readStoredAuthSession`) instead of creating a guest session or sending the runner to login, and ignores a null `INITIAL_SESSION`. Plan rights come from the cached capabilities (`readCachedRunnerPlanCapabilities`) of that account.
6. **Offline launch opens the plans.** `getPostAuthRoute` routes to `/(app)/plans` when the profile query fails with a transport error. A startup OTA check that fails for lack of network continues to the installed version instead of the "Mise à jour indisponible" screen; the foreground check retries later.
7. **Edits made offline are not queued.** Plan saves and crew passage confirmations still need the network; they fail as before and are not replayed.

## Gotchas

- `fetchRaceRacebookData` still returns `null` for both "not published" and "offline"; screens that need the difference use `fetchRaceRacebookDataOutcome`.
- RaceBook images (logos, sponsor visuals) are not copied: they rely on the platform image cache populated by `Image.prefetch` and may be missing offline. Map tiles need the network.
- The copy format version is `OFFLINE_CACHE_FORMAT_VERSION`; bump it when a stored shape changes incompatibly — older copies are then ignored, not migrated.
- `SIGNED_OUT` is the only purge trigger: an anonymous-to-account upgrade keeps the guest copies, but they stay keyed by the guest user id and are never read for the new account.
- The followed plan screen and the plan workspace keep their existing offline behaviour for writes (error alert / `saveStatus: 'error'`).

## Related Docs

- `docs/01-architecture/mobile-app.md`
- `docs/03-business-rules/plan-storage.md`
- `docs/02-database/tables/plan-share-follows.md`
- `docs/04-auth-and-security/auth-flows.md`
- `docs/03-business-rules/organizer-race-management.md`
