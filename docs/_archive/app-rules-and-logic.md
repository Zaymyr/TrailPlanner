# TrailPlanner — App Rules & Logic Reference

This document is the canonical reference for all business rules and logic across the web (`apps/web`) and mobile (`apps/mobile`) applications. Use it to verify parity between platforms and catch regressions.

---

## Table of Contents

1. [Nutrition / Fuel Calculations](#1-nutrition--fuel-calculations)
2. [Pacing & Speed Conversions](#2-pacing--speed-conversions)
3. [Alert Scheduling & Firing](#3-alert-scheduling--firing)
4. [Water / Hydration Tracking](#4-water--hydration-tracking)
5. [Aid Station Logic](#5-aid-station-logic)
6. [Elevation & Segmentation](#6-elevation--segmentation)
7. [Plan Defaults & Form Validation](#7-plan-defaults--form-validation)
8. [Entitlements & Subscription Logic](#8-entitlements--subscription-logic)
9. [Trial Logic](#9-trial-logic)
10. [Coach / Coachee Logic](#10-coach--coachee-logic)
11. [Rate Limiting](#11-rate-limiting)
12. [Product Catalog & Fuel Types](#12-product-catalog--fuel-types)
13. [GPX Import / Export](#13-gpx-import--export)
14. [Print / Aid-Station Cards](#14-print--aid-station-cards)
15. [Database Schema Key Points](#15-database-schema-key-points)
16. [Known Inconsistencies (Web vs Mobile)](#16-known-inconsistencies-web-vs-mobile)

---

## 1. Nutrition / Fuel Calculations

### Canonical Rule (Web & Shared Package)
**Formula**: Time-proportional intake.

```
segmentDurationHours = segmentDistanceKm * paceMinPerKm / 60
targetFuelGrams      = round(targetIntakePerHour * segmentDurationHours)
targetWaterMl        = round(waterIntakePerHour  * segmentDurationHours)
targetSodiumMg       = round(sodiumIntakePerHour * segmentDurationHours)
```

- Source: `packages/shared/src/index.ts` → `buildAlertSchedule()`
- Source: `apps/web/app/(coach)/race-planner/utils/segments.ts` → `buildSegments()`

### Mobile `raceAlertService` (DIVERGED — see §16)
**Formula**: Distance-proportional intake.

```
fraction        = segmentDistanceKm / raceDistanceKm
carbsGrams      = round(targetCarbsPerHour * fraction)
waterMl         = round(targetWaterMlPerHour * fraction)
sodiumMg        = round(targetSodiumMgPerHour * fraction)
```

- Source: `apps/mobile/lib/raceAlertService.ts`
- **Problem**: Ignores pace variation — segments with slower pace receive the same fuel as faster segments of equal distance.

### Race Totals Aggregation (Web)
`apps/web/app/(coach)/race-planner/utils/nutrition.ts` → `buildRaceTotals(segments)`:
- Sums `plannedFuelGrams`, `plannedWaterMl`, `plannedSodiumMg`, `segmentMinutes` across all segments.

### Product Estimate (Web)
`buildFuelProductEstimates(products, raceTotals)`:
- For each product: `count = ceil(totalFuelGrams / product.carbsGrams)`

### Default Gel Carbs
- `defaultFuelProducts[0].carbsGrams = 25g` (Maurten Gel 100)
- Source: `apps/web/lib/default-products.ts`

---

## 2. Pacing & Speed Conversions

Source: `apps/web/app/(coach)/race-planner/utils/pacing.ts`

| Function | Formula | Notes |
|---|---|---|
| `minutesPerKm(values)` | Returns pace directly or `60 / speedKph` | Returns `null` if speed ≤ 0 |
| `paceToSpeedKph(min, sec)` | `60 / (min + sec/60)` | — |
| `speedToPace(speedKph)` | `60 / speedKph` → split into min + sec | Handles 60-second rollover |

Source: `packages/fuel-planner/computeFuelPlan.ts`
- Speed mode pace: `paceMinPerKm = 60 / speedKmh`

---

## 3. Alert Scheduling & Firing

### `buildAlertSchedule(plan, mode)` — Shared Package
Source: `packages/shared/src/index.ts`

- One alert per segment: Start → each aid station → Finish.
- Per alert payload:
  - `carbsGrams = round(targetIntakePerHour * segmentHours)`
  - `waterMl = round(waterIntakePerHour * segmentHours)`
  - `sodiumMg = round(sodiumIntakePerHour * segmentHours)`
  - Products from `segmentPlan.products`; gel count from `segmentPlan.gelsCount`
- Trigger logic by `mode`:
  - `"time"` → `triggerMinutes = cumulativeElapsedMinutes`
  - `"gps"` → `triggerDistanceKm = cumulativeDistanceKm`
  - `"auto"` → sets **both** `triggerMinutes` AND `triggerDistanceKm`

### `getAlertsToFire(alerts, elapsedMinutes, elapsedKm?)` — Shared Package
Source: `packages/shared/src/index.ts`

Returns alerts that should fire given current elapsed time and/or distance.

| Alert State | Condition to Fire |
|---|---|
| `pending` | `elapsedMinutes >= triggerMinutes` OR `elapsedKm >= triggerDistanceKm` |
| `snoozed` | `elapsedMinutes >= snoozedUntilMinutes` |
| `confirmed` | Never fires |
| `skipped` | Never fires |

### Snooze Options
```
SNOOZE_OPTIONS_MINUTES = [5, 10, 15]
```
Defined in both `packages/shared/src/index.ts` and `apps/mobile/lib/shared.ts` (identical).

### Mobile Auto-Confirm Modes
Source: `apps/mobile/lib/raceAlertService.ts`

| Mode | Behaviour |
|---|---|
| `auto_5` | Confirms alert 5 minutes after trigger |
| `auto_10` | Confirms alert 10 minutes after trigger |
| `fire_forget` | Confirms immediately when trigger passes |

### Mobile GPS Tracking
- Haversine formula, Earth R = 6371 km
- Minimum update interval: 200 m between GPS events
- Source: `apps/mobile/lib/raceAlertService.ts` → `haversineKm()`

### Nutrition Stats (Mobile)
`getNutritionStats(session)`:
- Computes cumulative and last-hour intake vs. target from confirmed alerts.

---

## 4. Water / Hydration Tracking

Source: `apps/web/app/(coach)/race-planner/utils/segments.ts` → `buildSegments()`

- Tracks `availableWaterMl` across segments.
- Each segment deducts `targetWaterMl` from available water.
- Water refills to capacity at any station where `waterRefill !== false` (default: `true`).
- Shortfall is flagged if `availableWaterMl < 0` mid-segment.
- Default water bag: `waterBagLiters = 1.5` L.

---

## 5. Aid Station Logic

### Deduplication
Source: `apps/web/app/(coach)/race-planner/utils/plan-sanitizers.ts` → `dedupeAidStations()`

- Deduplicates by `(name, distanceKm)` where distance equality tolerance = **0.01 km**.
- Sorts by `distanceKm` ascending.

### Sanitization Rules
`sanitizeAidStations(stations?)`:
- Each station must have a `string` name and a `number` distanceKm.
- `waterRefill` defaults to `true` if not set.

### Mobile: New Aid Station Default Distance
Source: `apps/mobile/components/PlanForm.tsx`

- New station placed at `last.distanceKm + 10`, capped at `raceDistanceKm`.

### Fuel Planner: Aid Station Filtering
Source: `packages/fuel-planner/computeFuelPlan.ts`

- Aid stations outside `(0, distanceKm)` exclusive range are filtered out (start and finish are not aid stations).

---

## 6. Elevation & Segmentation

### Auto-Segmentation Presets
Source: `apps/web/app/(coach)/race-planner/utils/segmentation.ts` → `autoSegmentSection()`

| Preset | Smoothing Window | Slope Threshold | Min Segment Length |
|---|---|---|---|
| `grossier` | 0.6 km | ±4% | 3.0 km |
| `moyen` | 0.4 km | ±3% | 1.5 km |
| `fin` | 0.25 km | ±2% | 0.75 km |

- Terrain classes: `climb`, `flat`, `descent`
- Adjacent same-type intervals are merged; short segments are merged into neighbours.

### Segment Stats
`computeSegmentStats(segment, samples, paceModel?)`:
- Computes D+ / D− (elevation gain/loss) per segment via interpolation over GPX samples.
- Supports custom pace model with optional `estimateSeconds` callback; falls back to `secondsPerKm` / `speedKph`.

### Elevation Profile Slicing
Source: `apps/web/app/(coach)/race-planner/utils/elevation-slice.ts`
- `getElevationSlice(profile, startKm, endKm)` — extracts sub-profile with interpolated endpoints.

### Section Recompute
Source: `apps/web/app/(coach)/race-planner/utils/section-recompute.ts`
- Iterates sub-segments, calls `computeSegmentStats`, accumulates totals. All values clamped to ≥ 0.

---

## 7. Plan Defaults & Form Validation

### Default Intake Values (Both Platforms — Identical)

| Field | Default |
|---|---|
| `targetIntakePerHour` (carbs) | **70 g/h** |
| `waterIntakePerHour` | **500 ml/h** |
| `sodiumIntakePerHour` | **600 mg/h** |
| `waterBagLiters` | **1.5 L** |
| `paceMinutes` | **6** min |
| `paceSeconds` | **0** sec |
| `speedKph` | **10** km/h |

Sources: `apps/mobile/components/PlanForm.tsx`, `apps/mobile/app/(app)/plan/[id]/edit.tsx`

### Validation Rules

- Plan `name` is required.
- `raceDistanceKm > 0` required.
- `paceSeconds` clamped to `min(59, floor(value))`.
- Segment plan: non-negative check on override minutes, pause minutes, gel count, pickups.
- Segment plan: finite check on pace adjustment.
- Supply items: `productId` must be a string, quantity must be non-negative.

### Plan Sanitizer (Web)
Source: `apps/web/app/(coach)/race-planner/utils/plan-sanitizers.ts`

- `sanitizePlannerValues(values?)` — full form sanitizer; validates paceType, waterBagLiters, merges segments/sectionSegments, falls back to implicit segments if none stored.
- `sanitizeElevationProfile(profile?)` — filters points with non-finite `distanceKm` or `elevationM`.

---

## 8. Entitlements & Subscription Logic

### Free Tier Defaults
Source: `apps/web/lib/entitlements.ts`

| Entitlement | Free |
|---|---|
| `planLimit` | 1 |
| `favoriteLimit` | 3 |
| `customProductLimit` | 0 |
| `allowExport` | `false` |
| `allowAutoFill` | `false` |

### Premium Tier
All limits set to `Infinity`; `allowExport = true`; `allowAutoFill = true`.

### Coach Tier
Configured per-row in `coach_tiers` DB table. Fields: `invite_limit`, `plan_limit`, `favorite_limit`, `custom_product_limit`, `allow_export`, `allow_auto_fill`, `is_premium`.

### Entitlement Resolution Priority
Source: `apps/web/lib/entitlements.ts`

1. Active coach profile with a tier ID → use coach tier entitlements
2. Active subscription with plan name matching a coach tier → use coach tier entitlements
3. `is_coach = true` with `coach_plan_name` matching a tier → use coach tier entitlements
4. `is_coach = true` with no matched tier → full premium
5. Active `premium_grants` entry → override to full premium
6. No active subscription + trial expired → free defaults
7. Anything else → full premium

### `isSubscriptionActive` (Entitlements)
```
status === "active" OR status === "trialing"
AND current_period_end > now()
```

### `isSubscriptionActive` (Stripe Webhook — STRICTER, see §16)
```
status === "active"   // does NOT accept "trialing"
AND current_period_end > now()
```

### Plan Limit Enforcement (API)
Source: `apps/web/app/api/plans/route.ts`

- On `POST /api/plans`: counts existing user plans; returns **HTTP 402** if `count >= planLimit`.
- Coach plan mode routes to `/api/coach/plans` and bypasses personal limit.

---

## 9. Trial Logic

Source: `apps/web/lib/trial.ts`, `apps/web/lib/trial-server.ts`

| Rule | Value |
|---|---|
| Trial duration | **14 days** |
| Trial active condition | `trial_ends_at > now()` |
| Auto-provision | Trial created automatically on first access if none exists |
| Back-fill | `trial_ends_at` back-filled from `trial_started_at + 14d` if missing |

- `markTrialWelcomeSeen` — one-time stamp when user dismisses welcome banner.
- `markTrialExpiredSeen` — one-time stamp when user dismisses expiry banner.

---

## 10. Coach / Coachee Logic

### Invite Flow
Source: `apps/web/app/api/coach/invite/route.ts`

1. Rate limit: **6 invites per minute** per coach
2. Coach must have `subscription_status = active/trialing` OR `is_coach = true`
3. Coach tier must exist → **HTTP 403** if not found
4. Existing non-cancelled invite count must be `< tier.invite_limit` → **HTTP 403** if exceeded
5. Duplicate invite → **HTTP 409**
6. Self-invite → **HTTP 400**
7. Existing user → insert invite + send password reset email
8. New user → insert invite + Supabase `inviteUserByEmail`

### Intake Targets (Coach Override)
Source: `apps/web/app/api/coach/coachees/[id]/intake-targets/route.ts`

- Coach sets per-coachee: `carbsPerHour`, `waterMlPerHour`, `sodiumMgPerHour` (all `>= 0`)
- Requires active `coach_coachees` relationship before write
- History stored in `coach_intake_targets` table

### Coachee Access
- `GET /api/coach/coachees/[id]` returns profile + latest intake override
- Only accessible if active `coach_coachees` link exists

---

## 11. Rate Limiting

Source: `apps/web/lib/http.ts`

| Endpoint | Limit | Window |
|---|---|---|
| Default in-memory | 30 requests | 60 seconds |
| Trial status | 30 requests | 60 seconds (per IP) |
| Stripe checkout | 5 requests | 60 seconds (per user) |
| Coach invite | 6 invites | 60 seconds (per coach) |

- **In-memory**: Sliding window per key (`checkRateLimit(key, limit, windowMs)`)
- **DB-backed**: Calls Supabase RPC `check_and_increment_rate_limit`; falls back to in-memory on failure

---

## 12. Product Catalog & Fuel Types

### Fuel Type Enum
Source: `apps/web/lib/fuel-types.ts`

```
"gel" | "drink_mix" | "electrolyte" | "capsule" | "bar" | "real_food" | "other"
```
Default: `"other"`

### Default Products (Web)
Source: `apps/web/lib/default-products.ts`

| Product | Carbs | Sodium |
|---|---|---|
| Maurten Gel 100 | 25 g | 85 mg |
| GU Energy Gel | 22 g | 60 mg |
| SIS GO Isotonic | 22 g | 10 mg |

### Product Schema Fields
`id, slug, sku, name, fuelType, productUrl, caloriesKcal, carbsGrams, sodiumMg, proteinGrams, fatGrams, waterMl?, createdBy?`

### Local Products (Web)
- Stored in `localStorage` under key `"trailplanner.localProducts"`
- Validated with `fuelProductSchema` on read/write

### Selected Products (Web)
- Stored in `localStorage` under `"trailplanner.selectedProducts"`
- Reduced view: `{id, name, slug, carbsGrams, sodiumMg, caloriesKcal}`

### Mobile Product Catalog
Source: `apps/mobile/app/(app)/nutrition.tsx`
- Queries `products` table with `is_live = true AND is_archived = false`
- Filter chips: `all, gel, drink_mix, electrolyte, bar, real_food, other`
- User favorites stored in `user_favorite_products` join table

---

## 13. GPX Import / Export

Source: `apps/web/app/(coach)/race-planner/utils/gpx.ts`

### Import
- Parses GPX XML; decodes embedded `trailplanner:state` (base64 JSON of full planner state)
- Falls back to track-point parsing with haversine distance accumulation
- Extracts waypoints as aid stations by nearest track point

### Export
- Generates GPX XML with pseudo-coordinates (`lat=0, lon=distanceKm/111`)
- Encodes full planner state as base64 in `<metadata>` block

### Haversine Formula
```
R = 6371e3 metres
```
(Mobile uses R = 6371 km — same value, different unit expression)

---

## 14. Print / Aid-Station Cards

Source: `apps/web/lib/print/aidStations.ts` → `buildPrintAidStationCards()`

- Generates a printable card per segment for crew/assist use.
- Water split: **50/50** between isotonic and plain water.
- Gel count: from `supplies` or best-gel-product estimate.
- Terrain classification thresholds: **±60 m** net gain/loss → UP / DOWN / FLAT.
- Elapsed time format: `T+HH:MM`

### Aid Station Pick List (Auto-Fill)
Source: `apps/web/app/(coach)/race-planner/utils/aid-station-picklist.ts` → `buildAidStationPickList()`

- Greedy algorithm: up to **200 iterations**
- Each iteration: scores every product by fractional coverage of remaining carbs/sodium/water deficit
- Picks highest-scoring product each round
- Default minimum coverage threshold: **95%**
- Default flask size: **500 ml**

---

## 15. Database Schema Key Points

| Table | Key Fields |
|---|---|
| `race_plans` | `planner_values` (JSONB), `elevation_profile` (JSONB), `race_id` FK, `coach_id` |
| `user_profiles` | `trial_started_at`, `trial_ends_at`, `is_coach`, `coach_plan_name` |
| `subscriptions` | Stripe subscription state per user |
| `products` | `is_live`, `is_archived`, `fuel_type`, `carbs_g`, `sodium_mg` |
| `user_favorite_products` | User-product favorites join |
| `coach_tiers` | `invite_limit`, `plan_limit`, `favorite_limit`, `custom_product_limit`, `allow_export`, `allow_auto_fill`, `is_premium` |
| `coach_coachees` | `coach_id`, `coachee_id`, `status`, `invited_email` |
| `coach_invites` | Pending/accepted/cancelled invites |
| `coach_intake_targets` | Per-coachee nutrition override history |
| `coach_profiles` | Links coach to Stripe subscription + tier |
| `premium_grants` | Manual grants: `starts_at`, `initial_duration_days`, `ends_at`, `reason` |
| `rate_limit_entries` | DB-backed rate limit store |
| `races` | Public/private race definitions with GPX storage |

---

## 16. Known Inconsistencies (Web vs Mobile)

These are confirmed bugs / divergences that must be fixed or explicitly accepted.

---

### 🔴 CRITICAL — Nutrition Calculation Formula Mismatch

| | Formula | Behaviour |
|---|---|---|
| **Web / Shared** | `carbs = round(targetPerHour * segmentDurationHours)` | Time-proportional — a longer segment = more carbs |
| **Mobile `raceAlertService`** | `carbs = round(targetPerHour * segmentDistanceKm / raceDistanceKm)` | Distance-proportional — ignores pace variation |

**Impact**: On a course with varying pace (e.g. slow climbs, fast descents), the mobile app will calculate different nutrition targets than the web planner, causing under/over-fuelling alerts.

**Fix**: `apps/mobile/lib/raceAlertService.ts` should use the shared `buildAlertSchedule()` from `packages/shared`, or adopt the time-based formula.

---

### 🔴 CRITICAL — Time-Triggered Alerts Never Fire on Mobile

| | Time Trigger |
|---|---|
| **Shared `buildAlertSchedule`** | Sets `triggerMinutes` for `"time"` and `"auto"` modes |
| **Mobile `raceAlertService`** | Never sets `triggerMinutes`; only sets `triggerDistanceKm` |

**Impact**: Users who select `"time"` or `"auto"` alert mode will never receive alerts from the mobile `raceAlertService`. Only GPS-triggered alerts work.

**Fix**: `raceAlertService.buildAlertSchedule()` must set `triggerMinutes` based on cumulative elapsed time, matching the shared package logic.

---

### 🟡 MEDIUM — Alert Body Missing Products / Gel Count

| | Products in alert |
|---|---|
| **Shared `buildAlertSchedule`** | Reads `segmentPlan.products` and `segmentPlan.gelsCount`, includes in notification |
| **Mobile `raceAlertService`** | Reads `segmentPlan?.products` but omits `gelsCount` fallback; field not surfaced in alert body text |

**Impact**: Mobile alert notifications are missing product/gel information.

---

### 🟡 MEDIUM — `isSubscriptionActive` Inconsistency

| | Accepts `"trialing"` |
|---|---|
| **`apps/web/lib/entitlements.ts`** | ✅ Yes |
| **`apps/web/app/api/stripe/webhook/route.ts`** | ❌ No — `"active"` only |

**Impact**: A user in trial state may not have their `is_coach` / `user_profiles` flags updated correctly by the webhook handler, even though they're treated as active in the entitlements system.

**Fix**: The webhook `isSubscriptionActive` helper should also accept `"trialing"`.

---

### 🟠 LOW — `capsule` Fuel Type Missing from Mobile Filter UI

| | `capsule` filter chip |
|---|---|
| **`apps/web/lib/fuel-types.ts`** | Defined in enum |
| **`apps/mobile/app/(app)/nutrition.tsx`** | Missing from filter list |

**Impact**: Users cannot filter products by `capsule` type on mobile.

**Fix**: Add `capsule` to the filter chips array in `apps/mobile/app/(app)/nutrition.tsx`.

---

### 🟠 LOW — Duplicate `buildAlertSchedule` Implementation

`apps/mobile/lib/shared.ts` is a **copy** of `packages/shared/src/index.ts`. The mobile app should import from `packages/shared` directly rather than maintaining a separate copy, which has already drifted.

---

*Last updated: auto-generated from codebase exploration on 2026-03-24.*
