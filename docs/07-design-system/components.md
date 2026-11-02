---
title: Design Components
scope: design-system
last_verified: 2026-11-02
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
  - apps/mobile/components/themed/BriefToast.tsx
  - apps/mobile/components/navigation/RootCollapsibleHeader.tsx
  - packages/design-system/src/tokens/mobile-components.ts
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

`RootCollapsibleHeader` is the shared header for the four primary mobile tabs.
It uses the forest brand surface, respects the native top inset, and progressively
contracts from a 76-point body to a 60-point sticky body. Both states keep one
horizontal row: a 44-point leading target at the 16-point gutter, a title whose
left edge does not move during collapse, and an optional matching trailing target.
The large title shrinks to fit one line, the lower corner shape remains stable,
and scrolling content begins below the expanded height.

Shared React Native geometry comes from `mobileComponents`. Filter chips use the
same selected/unselected structure across Courses and Nutrition; Profile and plan
workspace selectors use the same segmented-control geometry; input shells keep
one surface/border/radius with units or clear actions inside; modal dismiss actions
use a labelled 44-point circular close; primary and secondary buttons share one
radius. Screen-specific components own copy, state, color roles and behavior.

`BriefToast` provides short success or network-error feedback above the mobile tab bar, with an optional action. Its default duration remains 2.6 seconds for success and 5 seconds for errors; callers may supply a longer duration for an actionable informational notice or `null` for an explicitly persistent notice. It is reserved for informational outcomes; destructive confirmation remains modal. Root tab headers add elevation only after collapsing, while the bottom tab bar keeps a subtle top divider and shadow.

## Gotchas

- The shared web `Button` primitive enforces a 44 px minimum height. Compact visual variants may reduce padding or font size, but must not override the minimum interactive target.

- Web UI primitives are not currently exported from `@pace-yourself/design-system`.
- If moving primitives into the design-system package, update package exports, web transpilation, and docs.
- Keep primitive variants small and consistent with existing Tailwind/CSS variable names.
- Avoid duplicating primitives or route-local components without first checking whether an existing component can be reused or extended.
- Do not introduce a new class merge library without a real collision problem; current `cn` only joins classes.
- Since `cn` does not merge conflicting Tailwind utilities, route-specific dialogs that replace the primitive's default `grid` layout must use an explicit priority modifier such as `!flex`; otherwise constrained inner scroll regions can be clipped.
- Do not create a local loading, error, or empty state when a themed state can
  express the screen; pass localized labels and preserve the shared retry CTA.
- Use `DataText` only for comparable numeric values. Counts or statuses containing words use the normal themed `Text` component.
- Do not make routine success toasts persistent. A longer or unbounded duration is for notices whose action must remain reachable, and the caller must still provide a clear dismissal path or bounded lifecycle.

## Related Docs

- [Tokens](tokens.md)
- [Icons](icons.md)
- [Web App](../01-architecture/web-app.md)
- [Add New Mobile Screen](../06-workflows/add-new-screen-mobile.md)
