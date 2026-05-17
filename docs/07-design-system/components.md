---
title: Design Components
scope: design-system
last_verified: 2026-05-17
ai_priority: medium
related_files:
  - apps/web/components/ui/button.tsx
  - apps/web/components/ui/card.tsx
  - apps/web/components/ui/input.tsx
  - apps/web/components/ui/dialog.tsx
  - apps/web/components/ui/tabs.tsx
  - apps/web/components/utils.ts
related_tables: []
---

# Design Components

## Purpose

This document records the current web component primitives and styling conventions visible in the repo. The shared design-system package currently exports tokens/icons, while web UI primitives live under `apps/web/components/ui`.

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
- centered content;
- backdrop blur;
- close-on-overlay-click behavior.

## Input

`Input` is a forwardRef input with:

- full width;
- fixed height;
- `rounded-md`;
- border and card background;
- focus-visible outline.

## Gotchas

- Web UI primitives are not currently exported from `@pace-yourself/design-system`.
- If moving primitives into the design-system package, update package exports, web transpilation, and docs.
- Keep primitive variants small and consistent with existing Tailwind/CSS variable names.
- Do not introduce a new class merge library without a real collision problem; current `cn` only joins classes.

## Related Docs

- [Tokens](tokens.md)
- [Icons](icons.md)
- [Web App](../01-architecture/web-app.md)
- [Add New Mobile Screen](../06-workflows/add-new-screen-mobile.md)
