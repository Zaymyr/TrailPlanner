---
title: Packages Architecture
scope: architecture
last_verified: 2026-11-26
# Crew follow UX (2026-11-17): passed checkpoints collapse, confirmed passages can be corrected or undone, the crew handover is a device-local checklist, aid-station directions match supporter points by place name within 2 km, and phones without the app get an app-first gate on the public page; no column, RLS or crew_state shape change.
ai_priority: medium
related_files:
  - packages/shared/src/supporter-guide.ts
  - packages/shared/src/racebook-cutoffs.ts
  - package.json
  - apps/web/next.config.mjs
  - packages/shared/src/index.ts
  - packages/shared/src/plan-share-tracking.ts
  - packages/shared/src/plan-timeline/index.ts
  - packages/shared/src/course-weather/index.ts
  - packages/shared/src/course-terrain/index.ts
  - packages/shared/src/course-terrain/types.ts
  - packages/shared/src/course-terrain/presentation.ts
  - apps/web/package.json
  - apps/mobile/package.json
  - packages/design-system/package.json
  - packages/design-system/src/index.ts
  - packages/design-system/src/index.d.ts
  - packages/design-system/src/branding.ts
  - packages/tanstack-react-query/package.json
  - packages/fuel-planner/computeFuelPlan.ts
related_tables: []
---

# Packages Architecture

Supporter Guide course line endpoints (2026-11-15): `addCourseEndpoints` opens every `formats[].stops` line with a start stop (`endpoint: "start"`, km 0, `startTimes` — wave names only when there are several SAS — and start-area directions) and closes it with the finish (`endpoint: "finish"`: the organizer « Arrivée » checkpoint is enriched, otherwise a finish stop is added) carrying `expectedArrivals`, the resolved finish cutoff and finish directions. A single wave is never labelled (no « Départ commun ») in the programme either.

`SupporterGuideTimelineEntry` gains `arrival_estimate` / `animation` kinds with `audience`, `eventWide`, `endTime`, `animationType`; formats gain `estimatedWinners`.

`@trailplanner/shared` `SupporterGuideStop` types the server-grouped Supporter Guide places; timeline entries gain an optional `mapsUrl`.

`@trailplanner/shared` exports `racebook-cutoffs`: organizer cutoff parsing, the official in-order multi-day resolution and race-day clock conversion. It mirrors `apps/mobile/lib/racebookPlanReflection.ts`; mobile keeps its local copy and receives already-resolved cutoffs in the Supporter Guide payload.

`@trailplanner/shared` exports the transport-only `SupporterGuidePayload` contract consumed by web and mobile. The web-only `qrcode` dependency renders organizer download SVGs and is not shipped to the mobile bundle.

## Shared followed-plan helpers

`@trailplanner/shared` exports followed-plan kilometer interpolation, confirmed-passage recalibration, preparation aggregation and multi-day completion calculation. Web lifecycle logic/tests and the Expo assistant view use this pure module; it has no storage, analytics or network side effects.

`@trailplanner/shared` now owns the pure shared-plan tracking calculations used by the public web timeline and native crew screen: clock parsing, midnight resolution, trackable-point selection, passage normalization and downstream ETA recalculation. UI, persistence and locale formatting remain app-specific.

`plan-share-tracking.ts` also exports `resolvePlanSharePassageCorrection` (crew-entered clock → elapsed minute near the planned passage), `isPlanShareCheckpointPassed` (collapse rule), `formatPlanShareClockInput` and `buildPlanShareCheckpointHandover` (products then bladder refill). The native adapter `apps/mobile/lib/followedPlanTimeline.ts` mirrors them because the native dependency pre-check forbids importing this package.
`@trailplanner/shared` owns the canonical runner profile field order, localized labels, units, required flags and readiness predicate used by web and mobile. It contains no UI or provider-specific access logic.

## Purpose

This document describes the local packages and shared modules in the monorepo. Use it when deciding whether a change belongs in an app or a shared package.

## Key Concepts

- Workspace package: a package included by the root npm workspace list.
- Package manager pin: the root `packageManager` field fixes npm 10.9.2 so Turbo can resolve workspaces in local and CI commands.
- Shared logic: code intended to be used across app surfaces.
- Design system: tokens, fonts, and icons exported by `@pace-yourself/design-system`.
- Local shim: repository-owned package that satisfies an import path without external package behavior.

## Workspace Packages

### `@trailplanner/shared`

Location: `packages/shared`

Exports from `packages/shared/src/index.ts`. Current shared logic includes alert scheduling:

- `buildAlertSchedule`
- `getAlertsToFire`
- related alert types

This package contains runtime-neutral logic. The web app imports it by package name (Supporter Guide, followed plan, plan share tracking, runner profile, plan timeline). For alert scheduling, mobile intentionally imports its narrower local `apps/mobile/lib/shared.ts` implementation and tests that implementation directly; treat consolidation as a deliberate compatibility change, not as a mechanical import rewrite.

### Plan-timeline module (2026-11-23)

`packages/shared/src/plan-timeline/` (re-exported by `src/index.ts`) is the single implementation of the plan-editor section summary and intake chronology used by both apps: `types.ts` (plan-form contracts), `profile-utils.ts` (profile slices, sub-segments, effort/fatigue duration), `section-summary.ts`, `plan-values.ts` (planner-values normalization), `continuous-nutrition.ts` (continuous intake chronology) and `presentation.ts` (`compactPlanTimeline`). Rules: [Nutrition Algorithm](../03-business-rules/nutrition-algorithm.md#intake-chronology-engine-shared-web--mobile-2026-11-23), [Pacing Algorithm](../03-business-rules/pacing-algorithm.md).

- Web imports it from `@trailplanner/shared` (adapter `apps/web/lib/plan-chronology.ts`).
- Mobile does **not** import the package by name (the Mobile Pre-Check workflow `.github/workflows/main.yml` rejects `@trailplanner/shared` under `apps/mobile/app` and `apps/mobile/lib`). Its former modules — `lib/continuousNutrition.ts`, `lib/planTimelinePresentation.ts`, `components/plan-form/profile-utils.ts`, `section-summary.ts`, and parts of `contracts.ts` / `helpers.ts` — re-export the source files through relative paths (`../../../packages/shared/src/plan-timeline/...`). Metro bundles them because `apps/mobile/metro.config.js` watches the workspace root (as for `packages/design-system`); `tsc` and vitest follow the relative imports.
- Mobile-only pieces stay in the app: the fallback `buildSectionIntakeTimelineV2` and gauges (`components/plan-form/metrics.ts`), carryover and auto-fill, and all rendering.

### Course-weather module (2026-11-23)

`packages/shared/src/course-weather/` (re-exported by `src/index.ts`) holds the `GET /api/race-weather` contract (`types.ts`: `CourseWeatherResponse`, `COURSE_WEATHER_HORIZON_DAYS`) and pure display helpers (`presentation.ts`: nearest forecast hour, feels-like, alerts and thresholds, summaries, weather at planned passages). Runtime-neutral, no network. The MET Norway client and point selection stay server-side in `apps/web/lib/course-weather/`. Rules: [MET Norway Course Weather](../05-integrations/met-norway-weather.md).

`packages/shared/src/course-terrain/` (re-exported by `src/index.ts`) holds the course terrain contract (`types.ts`: `CourseTerrainResponse` of `GET /api/race-terrain`, `OrganizerCourseTerrain` and `CourseTerrainOverridesInput` of `/api/organizer/races/[id]/terrain`, classes, attribution, `COURSE_TERRAIN_CLASS_COLORS`) and pure helpers (`presentation.ts`: normalize, `applyCourseTerrainOverrides`, `summarizeCourseTerrain`, segment at km, rescale, km range shares). Runtime-neutral, display-only. Overpass, matching and the resumable job stay server-side in `apps/web/lib/course-terrain/`. Rules: [Course Terrain](../03-business-rules/course-terrain.md).

### `@pace-yourself/design-system`

Location: `packages/design-system`

Exports tokens, fonts, signature icons, and the runtime-neutral RaceBook branding resolver. The brand tokens define forest green as primary and alpine blue `#3F6F8F` as secondary; the resolver consumes those shared defaults and derives primary/accent surfaces, borders, contrasting solid-surface text, and accessible foreground/graphic variants for use on white. It also owns the enabled edition-logo release switch used consistently by web and mobile. The web app transpiles this package in `apps/web/next.config.mjs`.

Primary source files:

- `packages/design-system/src/tokens/colors.ts`
- `packages/design-system/src/tokens/typography.ts`
- `packages/design-system/src/tokens/spacing.ts`
- `packages/design-system/src/tokens/radius.ts`
- `packages/design-system/src/tokens/shadows.ts`
- `packages/design-system/src/icons/index.ts`
- `packages/design-system/src/branding.ts`

### `@tanstack/react-query`

Location: `packages/tanstack-react-query`

This local package uses the public `@tanstack/react-query` name. Treat it as an intentional local shim until verified otherwise. Do not upgrade or replace it without reading its implementation and callers.

### `packages/fuel-planner`

Location: `packages/fuel-planner`

This directory contains `computeFuelPlan.ts` but no package metadata was found during this audit. Treat it as source code, not a published workspace package, unless package metadata is added later.

## Dependency Direction

Preferred dependency direction:

```text
apps/web ─┐
          ├─> packages/shared
apps/mobile ┘

apps/web ─┐
          ├─> packages/design-system
apps/mobile ┘
```

Avoid importing app-specific code from packages. Packages should not depend on Next.js route handlers, Expo modules, local storage, or service-role configuration.

The diagram is the target direction for genuinely shared behavior, not proof that every package currently has both consumers. `@pace-yourself/design-system` is shared by web and mobile today; of `@trailplanner/shared`, mobile bundles only the `plan-timeline` module, by relative path.

## When to Move Code Into a Package

Move logic into `packages/shared` only when:

- both web and mobile need the same behavior;
- the logic can run without DOM, Next.js, Expo, or React Native APIs;
- the data contracts can be kept stable through tests.

Keep logic inside an app when:

- it depends on route handlers, cookies, local storage, navigation, or UI state;
- it is still changing rapidly in one product surface;
- the mobile and web flows intentionally differ.

## Gotchas

- When editing `apps/web/next.config.mjs`, preserve both shared-package transpilation and the browser/locale header rules. The initial CSP is deliberately report-only and is not an authorization to remove required service origins before observing production reports.

- `packages/shared/src/plan-timeline/` is bundled into the Expo app: keep it free of React, React Native, DOM, Node and network imports, never import the package root (`src/index.ts`) from it or from mobile, and remember any change ships to mobile as an OTA on merge. Mobile golden snapshots (`apps/mobile/lib/continuousNutrition.test.ts`) must change only deliberately.
- In a parallel-agent worktree whose `node_modules` is a junction to the primary checkout, `@trailplanner/shared` resolves to the primary checkout's `packages/shared`: new shared exports then fail web `tsc`/vitest locally until merged or aliased; CI and fresh installs are unaffected.
- Keep the RaceBook branding resolver runtime-neutral: both Next.js and Expo import it, so it must not depend on DOM, Node, React, or React Native APIs.
- Keep color contrast derivation in this shared resolver; app surfaces must not independently darken bright organizer colors.
- The package name `@trailplanner/shared` still uses the old TrailPlanner naming. Do not rename it casually; workspace package names affect imports.
- Alert scheduling currently has a broader package implementation and a time-only mobile implementation. Preserve their explicit tests and reconcile their product contract before removing either copy.
- `apps/web/next.config.mjs` also exports `temporaryPathRedirects` (bare `/en` to `/`, 307), separate from the permanent list.
- `apps/web/next.config.mjs` also exports `staticPathRedirects` (served through `redirects()` instead of middleware). Edit it together with `lib/legacy-redirects.ts` / `lib/blog/redirects.ts`.
- `apps/web/next.config.mjs` transpiles `@trailplanner/shared` and `@pace-yourself/design-system` and owns route-scoped response headers such as the English subtree's `Content-Language`. Preserve both responsibilities when editing the config; a new package that exports TS/TSX directly may need a matching transpile entry.
- The local `@tanstack/react-query` package can mask assumptions about the upstream package. Inspect it before changing data-fetching code.
- Keep the root `packageManager` field present when upgrading npm/Turbo; current Turbo versions refuse to resolve this workspace graph without it.
- Keep root `build`, `test`, and `verify` scripts delegated through Turbo so new workspace scripts automatically join the repository gate.

## Related Docs

- [Overview](overview.md)
- [Design Tokens](../07-design-system/tokens.md)
- [Design Icons](../07-design-system/icons.md)
- [Pacing Algorithm](../03-business-rules/pacing-algorithm.md)

`apps/video-render-worker` is a standalone Node package outside the npm workspaces (its own `package-lock.json`, Playwright only) built into the Cloud Run render image. The web CSP (`next.config.mjs`, report-only) allows `https://storage.googleapis.com` for signed render uploads and downloads.

The runner follow-up keeps plan selection, renaming and URL restoration inside the existing web workspace; it adds no shared-package contract or dependency.

Blog runtime bundling (2026-11-23): `next.config.mjs` gained `experimental.outputFileTracingIncludes` for `content/blog/**`; package boundaries are unchanged.

Catalogue slug redirects (2026-11-23): `next.config.mjs` exports `catalogSlugRedirects`; package boundaries are unchanged.

Catalogue slug redirects (2026-11-23, follow-up): `catalogSlugRedirects` gained two format entries; package boundaries are unchanged.
