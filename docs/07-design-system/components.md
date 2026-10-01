---
title: Design Components
scope: design-system
last_verified: 2026-10-01
ai_priority: medium
related_files:
  - apps/web/components/ui/button.tsx
  - apps/web/components/ui/card.tsx
  - apps/web/components/ui/input.tsx
  - apps/web/components/ui/dialog.tsx
  - apps/web/components/ui/tabs.tsx
  - apps/web/components/utils.ts
  - apps/mobile/components/themed/Button.tsx
  - apps/mobile/components/themed/LoadingState.tsx
  - apps/mobile/components/themed/ErrorState.tsx
  - apps/mobile/components/themed/EmptyState.tsx
related_tables: []
---

# Design Components

## Purpose

This document records the current web component primitives and styling conventions visible in the repo. The shared design-system package exports tokens/icons; web primitives live under `apps/web/components/ui` and mobile primitives live under `apps/mobile/components/themed`.

## Key Concepts

- UI primitive: small reusable web component.
- `cn`: class name join helper.
- Variant: component prop that selects a style branch.
- Theme variable: CSS HSL variable from `apps/web/app/globals.css`.

## Web Primitives

Current files include:

- `button.tsx`
- `card.tsx`
- `dialog.tsx`
- `input.tsx`
- `label.tsx`
- `table.tsx`
- `tabs.tsx`
- `MetricCard.tsx`
- `SectionHeader.tsx`

The `cn` helper in `apps/web/components/utils.ts` filters falsey class values and joins strings.

## Reuse-First Rule

Before creating a new UI component, search `apps/web/components`, the nearest route `_components` folder, and package design-system exports. Reuse or extend an existing component when it fits the interaction and visual language. Keep new components at the narrowest practical scope first, then promote them to a shared location only after multiple screens need the same abstraction.

## Button

`Button` supports variants:

- `default`
- `outline`
- `ghost`

Base styling includes:

- `inline-flex`
- fixed height `h-10`
- center alignment;
- `rounded-md`;
- focus-visible outline using `ring`.

## Card

`Card` uses:

- rounded border;
- `bg-card`;
- `text-card-foreground`;
- brand-tinted shadow;
- dark border/shadow adjustments.

Card subcomponents:

- `CardHeader`
- `CardTitle`
- `CardDescription`
- `CardContent`

## Dialog

`Dialog` uses a React context and `createPortal`. `DialogContent` renders only when open and includes:

- full-screen overlay button;
- a viewport-scrollable portal shell with horizontally centered content;
- backdrop blur;
- close-on-overlay-click behavior.

## Input

`Input` is a forwardRef input with:

- full width;
- fixed height;
- `rounded-md`;
- border and card background;
- focus-visible outline.

## Mobile primitives

The themed mobile folder provides small shared React Native building blocks.
`Button` has primary, secondary, and ghost variants, a 48-point minimum action
height, pressed and disabled states, and an `isLoading` state that disables the
action with a native spinner. `LoadingState` presents an accessible busy
indicator and optional localized label. `ErrorState` provides a title,
description, and optional retry action. `EmptyState` provides a title,
description, optional illustration, and optional primary action. Screen-level
callers own all visible strings so they can use the locale files.

## Gotchas

- Web UI primitives are not currently exported from `@pace-yourself/design-system`.
- If moving primitives into the design-system package, update package exports, web transpilation, and docs.
- Keep primitive variants small and consistent with existing Tailwind/CSS variable names.
- Avoid duplicating primitives or route-local components without first checking whether an existing component can be reused or extended.
- Do not introduce a new class merge library without a real collision problem; current `cn` only joins classes.
- Since `cn` does not merge conflicting Tailwind utilities, route-specific dialogs that replace the primitive's default `grid` layout must use an explicit priority modifier such as `!flex`; otherwise constrained inner scroll regions can be clipped.
- Do not create a local loading, error, or empty state when a themed state can
  express the screen; pass localized labels and preserve the shared retry CTA.

## Related Docs

- [Tokens](tokens.md)
- [Icons](icons.md)
- [Web App](../01-architecture/web-app.md)
- [Add New Mobile Screen](../06-workflows/add-new-screen-mobile.md)
