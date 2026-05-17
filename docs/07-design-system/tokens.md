---
title: Design Tokens
scope: design-system
last_verified: 2026-05-17
ai_priority: medium
related_files:
  - packages/design-system/src/tokens/colors.ts
  - packages/design-system/src/tokens/typography.ts
  - packages/design-system/src/tokens/spacing.ts
  - packages/design-system/src/tokens/radius.ts
  - packages/design-system/src/tokens/shadows.ts
  - packages/design-system/src/fonts/index.ts
  - apps/web/tailwind.config.ts
  - apps/web/app/globals.css
related_tables: []
---

# Design Tokens

## Purpose

This document records the shared design tokens exported by `@pace-yourself/design-system` and how the web app consumes them.

## Key Concepts

- Token: named design value exported from a package.
- Tailwind bridge: web Tailwind config maps tokens into utility scales.
- CSS variable: web runtime theme variable in `globals.css`.
- Font package: shared font metadata for web/mobile use.

## Token Sources

Design token files:

- `packages/design-system/src/tokens/colors.ts`
- `packages/design-system/src/tokens/typography.ts`
- `packages/design-system/src/tokens/spacing.ts`
- `packages/design-system/src/tokens/radius.ts`
- `packages/design-system/src/tokens/shadows.ts`

Font metadata:

- `packages/design-system/src/fonts/index.ts`

## Colors

Token groups:

- `brand`: forest, forestLight, forestDark.
- `surface`: sand, sandLight, white, cream.
- `text`: primary, secondary, tertiary, inverse.
- `accent`: terracotta, amber, olive.
- `border`: subtle, strong, brand.

The web app also defines HSL CSS variables in `apps/web/app/globals.css` for light/dark runtime themes.

## Typography

Shared typography includes:

- sans: Bricolage Grotesque stack;
- mono: JetBrains Mono stack;
- system stack;
- sizes from `xs` through `5xl`;
- line heights tight/snug/normal/relaxed;
- weights light through bold.

`packages/design-system/src/fonts/index.ts` records Google font package/url metadata for Bricolage Grotesque and JetBrains Mono.

## Spacing, Radius, Shadows

Spacing uses numeric pixel tokens plus `section` and `gutter`.

Radius tokens include `none`, `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`, `full`, and `card`.

Shadows include `sm`, `md`, and `lg` with brand-tinted rgba values.

## Web Tailwind Bridge

`apps/web/tailwind.config.ts` imports design-system tokens and maps:

- spacing numbers to pixel scales;
- radius numbers to pixel scales;
- shadows into Tailwind box shadows;
- colors under `pace`.

It also exposes CSS-variable theme colors such as `background`, `foreground`, `brand`, `brand-light`, `brand-surface`, and `brand-border`.

## Gotchas

- The design-system color tokens and web CSS variables are related but not identical.
- Do not hardcode actual PostHog/Supabase/Stripe colors or secrets in design docs.
- If tokens change, update Tailwind mapping and design docs together.
- Existing web body background uses a brand-surface radial gradient in light mode and flat dark background in dark mode.

## Related Docs

- [Icons](icons.md)
- [Components](components.md)
- [Packages](../01-architecture/packages.md)
- [Web App](../01-architecture/web-app.md)
