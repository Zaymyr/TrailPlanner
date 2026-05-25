---
title: Design Icons
scope: design-system
last_verified: 2026-05-17
ai_priority: medium
related_files:
  - packages/design-system/ICONS.md
  - packages/design-system/src/icons/index.ts
  - packages/design-system/src/icons/_base/IconBase.tsx
  - packages/design-system/src/icons/_base/IconBase.native.tsx
  - packages/design-system/src/icons/pace.tsx
related_tables: []
---

# Design Icons

## Purpose

This document summarizes the Pace Yourself signature icon set. The archived source reference is `packages/design-system/ICONS.md`.

## Key Concepts

- Signature icon: app-specific icon using logo DNA.
- Web icon: React/SVG component.
- Native icon: React Native-compatible base implementation.
- Logo DNA: broken/dotted arc, upward chevron, and central dot.

## Exported Icons

`packages/design-system/src/icons/index.ts` exports:

- `TrailIcon`
- `AidStationIcon`
- `SummitIcon`
- `PaceIcon`
- `NutritionIcon`
- `HydrationIcon`
- `DescentIcon`
- `CutoffIcon`
- `GpxImportIcon`
- `EmptyPlanIcon`

## Intended Uses

- `TrailIcon`: GPX previews, course cards, route summaries.
- `AidStationIcon`: race timeline aid stations, refill points.
- `SummitIcon`: elevation gain, summits, climb stats.
- `PaceIcon`: pace/allure settings and speed metrics.
- `NutritionIcon`: product catalog and fueling cards.
- `HydrationIcon`: hydration targets and water availability.
- `DescentIcon`: downhill segments and descent stats.
- `CutoffIcon`: cutoff time and deadline states.
- `GpxImportIcon`: GPX import and route ingestion.
- `EmptyPlanIcon`: empty states before a plan/race/timeline exists.

## Usage

Web:

```tsx
import { AidStationIcon } from "@pace-yourself/design-system";

<AidStationIcon size={20} className="text-brand" title="Aid station" />;
```

Mobile:

```tsx
import { TrailIcon, colors } from "@pace-yourself/design-system";

<TrailIcon size={24} color={colors.brand.forest} accessibilityLabel="Trail" />;
```

## Gotchas

- Keep icons readable at 16 px, 24 px, and 48 px.
- Prefer exported icons over ad hoc SVGs for core domain concepts.
- Web and native base icon implementations differ; verify both if changing base props.
- Keep `packages/design-system/ICONS.md` and this doc aligned when adding an icon.

## Related Docs

- [Tokens](tokens.md)
- [Components](components.md)
- [Packages](../01-architecture/packages.md)
- [Nutrition Algorithm](../03-business-rules/nutrition-algorithm.md)
