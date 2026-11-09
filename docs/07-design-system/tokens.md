---
title: Design Tokens
scope: design-system
last_verified: 2026-11-09
ai_priority: medium
related_files:
  - packages/design-system/src/tokens/colors.ts
  - packages/design-system/src/tokens/typography.ts
  - packages/design-system/src/tokens/spacing.ts
  - packages/design-system/src/tokens/radius.ts
  - packages/design-system/src/tokens/shadows.ts
  - packages/design-system/src/tokens/mobile-components.ts
  - packages/design-system/src/fonts/index.ts
  - packages/design-system/src/branding.ts
  - apps/web/tailwind.config.ts
  - apps/web/app/globals.css
  - apps/mobile/constants/colors.ts
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

- `brand`: forest, forestLight, forestDark, secondary, plus the shared soft `surface` and `border` selection tokens. The shared secondary is the alpine blue `#3F6F8F`.
- `surface`: sand, sandLight, white, cream, muted.
- `text`: primary, secondary, tertiary, inverse.
- `accent`: terracotta, amber, olive.
- `border`: subtle, strong, brand.
- `semantic`: success, danger, warning, and information roles with their soft
  surfaces/borders. The information role aliases the alpine blue; terracotta
  remains an attention/danger accent rather than a general action color.

The web app also defines HSL CSS variables in `apps/web/app/globals.css` for light/dark runtime themes.

### Mobile compatibility palette

`apps/mobile/constants/colors.ts` preserves the established `Colors` import
shape for React Native callers, but every value is an alias of `colors` from
`@pace-yourself/design-system`. New mobile UI may import the shared tokens
directly; it must not add local hex values to `Colors`. Compatibility semantic
names map to shared semantic, selection, and neutral-surface tokens, preserving
their established visual roles.
The deprecated `_dark*` aliases remain only so older callers continue to type
check while their screens migrate to the shared light palette.

### RaceBook edition theme

`packages/design-system/src/branding.ts` owns the shared runtime theme contract used by the organizer preview and mobile RaceBook. Defaults are `#2D5016` for primary and the shared alpine blue `#3F6F8F` for accent. It accepts only `#RRGGBB`, computes contrasting text for each solid brand color, derives light surfaces and borders, and exposes separate foreground (4.5:1 on white) and graphic (3:1 on white) variants. These derived variants preserve bright organizer colors such as yellow as identity inputs while keeping small text and route/profile strokes readable. `RACEBOOK_EDITION_LOGO_ENABLED` is enabled, so a valid published HTTPS edition logo can render in runner-facing RaceBook surfaces.

Primary colors style the RaceBook hero, its softly tinted screen background, interactions, links, active tabs and icons. Accent colors style progress, route and elevation profile together with their related cards, positive information rows and other non-semantic highlights. Typography, layout, and semantic danger/warning/info colors are never organizer-controlled.

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

Radius tokens include `none`, `sm`, `md`, `data`, `lg`, `xl`, `2xl`, `3xl`,
`full`, and `card`. Mobile product UI uses four semantic families: 10-point
data blocks, 12-point controls/actions, 18-point cards, and full-radius pills.

Shadows include `sm`, `md`, and `lg` with brand-tinted rgba values.

`mobileComponents` composes those base tokens into shared React Native control
geometry: a 16-point screen gutter, 10-point data blocks, 12-point
action/button/input radii, 18-point cards, full-radius filter chips, and
44-point minimum selection/close targets. All of these use symmetric radii; the
former 4-point lower-right signature corner was removed. It also owns the
small/medium/large action heights and the restrained 0.98 press feedback plus
140/180 ms motion durations.

The trail signature tokens live in the same object:

- `topoCard.blazeTop`: where the leading-edge blaze sits on signature cards.
- `blaze`: small/medium/large band width, band height and gap for the
  two-band trail blaze, plus its 1-point band radius.
- `ridge`: stroke width, divider/loader/silhouette heights, the resampling
  count for course profiles, and the loader (1.6 s) and celebration (1.1 s)
  durations.
- `timeline`: the dotted trail rail width, dash and gap.

Mobile callers continue to apply semantic colors from `Colors`/`colors`; the
blaze bands reuse existing tokens (olive over forest by default) and add no new
palette value.

## Web Tailwind Bridge

`apps/web/tailwind.config.ts` imports design-system tokens and maps:

- spacing numbers to pixel scales;
- radius numbers to pixel scales;
- shadows into Tailwind box shadows;
- colors under `pace`.

It also exposes CSS-variable theme colors such as `background`, `foreground`, `brand`, `brand-light`, `brand-surface`, and `brand-border`.

## Gotchas

- Do not use an edition accent as a semantic success, warning, danger, or information color.
- Invalid colors and non-HTTPS logos must resolve to the Pace Yourself defaults without breaking the RaceBook.
- Use the derived foreground or graphic variant when an organizer color is drawn on white; do not assume the raw color has sufficient contrast.
- The design-system color tokens and web CSS variables are related but not identical.
- Mobile `Colors` is an alias layer, not a second source of palette values; add
  a shared token before a mobile screen needs a new color.
- Equivalent mobile filters, segmented selectors, fields, modal closes and buttons must reuse `mobileComponents`; do not copy their dimensions into route-local styles.
- Full-radius geometry is reserved for status pills and selectable chips.
  Numeric race information belongs in the 10-point data geometry instead.
- Use `semantic` tokens for application status UI and `brand.surface` /
  `brand.border` for selected controls; neither is organizer-controlled.
- Do not hardcode actual PostHog/Supabase/Stripe colors or secrets in design docs.
- If tokens change, update Tailwind mapping and design docs together.
- Existing web body background uses a brand-surface radial gradient in light mode and flat dark background in dark mode.

## Related Docs

- [Icons](icons.md)
- [Components](components.md)
- [Packages](../01-architecture/packages.md)
- [Web App](../01-architecture/web-app.md)
