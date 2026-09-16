---
title: Packages Architecture
scope: architecture
last_verified: 2026-09-16
ai_priority: medium
related_files:
  - package.json
  - apps/web/next.config.mjs
  - packages/shared/src/index.ts
  - packages/design-system/package.json
  - packages/design-system/src/index.ts
  - packages/design-system/src/index.d.ts
  - packages/design-system/src/branding.ts
  - packages/tanstack-react-query/package.json
  - packages/fuel-planner/computeFuelPlan.ts
related_tables: []
---

# Packages Architecture

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

This package contains runtime-neutral logic, but no current application import was found during the 2026-09-16 verification. Mobile intentionally imports its narrower local `apps/mobile/lib/shared.ts` implementation and tests that implementation directly. Treat consolidation as a deliberate compatibility change, not as a mechanical import rewrite.

### `@pace-yourself/design-system`

Location: `packages/design-system`

Exports tokens, fonts, signature icons, and the runtime-neutral RaceBook branding resolver. The resolver derives primary/accent surfaces and borders and owns the temporary edition-logo kill switch used consistently by web and mobile. The web app transpiles this package in `apps/web/next.config.mjs`.

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

The diagram is the target direction for genuinely shared behavior, not proof that every package currently has both consumers. `@pace-yourself/design-system` is shared by web and mobile today; `@trailplanner/shared` is not.

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

- Keep the RaceBook branding resolver runtime-neutral: both Next.js and Expo import it, so it must not depend on DOM, Node, React, or React Native APIs.
- The package name `@trailplanner/shared` still uses the old TrailPlanner naming. Do not rename it casually; workspace package names affect imports.
- Alert scheduling currently has a broader package implementation and a time-only mobile implementation. Preserve their explicit tests and reconcile their product contract before removing either copy.
- `apps/web/next.config.mjs` transpiles `@trailplanner/shared` and `@pace-yourself/design-system` and owns route-scoped response headers such as the English subtree's `Content-Language`. Preserve both responsibilities when editing the config; a new package that exports TS/TSX directly may need a matching transpile entry.
- The local `@tanstack/react-query` package can mask assumptions about the upstream package. Inspect it before changing data-fetching code.
- Keep the root `packageManager` field present when upgrading npm/Turbo; current Turbo versions refuse to resolve this workspace graph without it.
- Keep root `build`, `test`, and `verify` scripts delegated through Turbo so new workspace scripts automatically join the repository gate.

## Related Docs

- [Overview](overview.md)
- [Design Tokens](../07-design-system/tokens.md)
- [Design Icons](../07-design-system/icons.md)
- [Pacing Algorithm](../03-business-rules/pacing-algorithm.md)
