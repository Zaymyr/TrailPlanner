---
title: Packages Architecture
scope: architecture
last_verified: 2026-05-17
ai_priority: medium
related_files:
  - package.json
  - apps/web/next.config.mjs
  - packages/shared/src/index.ts
  - packages/design-system/package.json
  - packages/design-system/src/index.ts
  - packages/tanstack-react-query/package.json
  - packages/fuel-planner/computeFuelPlan.ts
related_tables: []
---

# Packages Architecture

## Purpose

This document describes the local packages and shared modules in the monorepo. Use it when deciding whether a change belongs in an app or a shared package.

## Key Concepts

- Workspace package: a package included by the root npm workspace list.
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

This package is used for logic that should not depend on Next.js or Expo runtime APIs.

### `@pace-yourself/design-system`

Location: `packages/design-system`

Exports tokens, fonts, and signature icons. The web app transpiles this package in `apps/web/next.config.mjs`.

Primary source files:

- `packages/design-system/src/tokens/colors.ts`
- `packages/design-system/src/tokens/typography.ts`
- `packages/design-system/src/tokens/spacing.ts`
- `packages/design-system/src/tokens/radius.ts`
- `packages/design-system/src/tokens/shadows.ts`
- `packages/design-system/src/icons/index.ts`

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

- The package name `@trailplanner/shared` still uses the old TrailPlanner naming. Do not rename it casually; workspace package names affect imports.
- `apps/web/next.config.mjs` transpiles `@trailplanner/shared` and `@pace-yourself/design-system`. If a new package exports TS/TSX directly, the web config may need a matching transpile entry.
- The local `@tanstack/react-query` package can mask assumptions about the upstream package. Inspect it before changing data-fetching code.

## Related Docs

- [Overview](overview.md)
- [Design Tokens](../07-design-system/tokens.md)
- [Design Icons](../07-design-system/icons.md)
- [Pacing Algorithm](../03-business-rules/pacing-algorithm.md)
