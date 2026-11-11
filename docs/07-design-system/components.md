---
title: Design Components
scope: design-system
last_verified: 2026-11-11
ai_priority: medium
related_files:
  - apps/web/components/ui/button.tsx
  - apps/web/components/ui/card.tsx
  - apps/web/components/ui/input.tsx
  - apps/web/components/ui/dialog.tsx
  - apps/web/components/ui/tabs.tsx
  - apps/web/components/utils.ts
  - apps/mobile/components/themed/Button.tsx
  - apps/mobile/components/themed/ActionButton.tsx
  - apps/mobile/components/themed/ChoiceChip.tsx
  - apps/mobile/components/themed/Field.tsx
  - apps/mobile/components/themed/IconAction.tsx
  - apps/mobile/components/themed/MetricTile.tsx
  - apps/mobile/components/themed/SectionHeading.tsx
  - apps/mobile/components/themed/StatusPill.tsx
  - apps/mobile/components/themed/TopoCard.tsx
  - apps/mobile/components/themed/TopoContourPattern.tsx
  - apps/mobile/components/themed/TrailBlaze.tsx
  - apps/mobile/components/themed/Cote.tsx
  - apps/mobile/components/themed/Ridge.tsx
  - apps/mobile/components/themed/TrailRail.tsx
  - apps/mobile/components/themed/TrailSignButton.tsx
  - apps/mobile/components/themed/TrailTabs.tsx
  - apps/mobile/components/themed/TrailSeedProvider.tsx
  - apps/mobile/components/themed/SheetHeader.tsx
  - apps/mobile/components/themed/AccordionHeader.tsx
  - apps/mobile/components/themed/trail/ActionPlates.tsx
  - apps/mobile/components/themed/trail/WatchButton.tsx
  - apps/mobile/components/themed/trail/MilestoneGlyphs.tsx
  - apps/mobile/components/themed/trail/MilestoneLabel.ts
  - apps/mobile/components/themed/trail/BraceletTab.tsx
  - apps/mobile/components/themed/trail/NotebookParts.tsx
  - apps/mobile/components/themed/trail/BibParts.tsx
  - apps/mobile/components/themed/trail/WoodGeometry.ts
  - apps/mobile/components/themed/trail/CardProfile.tsx
  - apps/mobile/lib/catalogCourseProfiles.ts
  - apps/mobile/lib/planReadiness.ts
  - apps/mobile/lib/fieldLabel.ts
  - apps/mobile/components/themed/trail/HeartMark.tsx
  - apps/mobile/components/themed/trail/TapeStrip.tsx
  - apps/mobile/components/themed/trail/StampMark.tsx
  - apps/mobile/components/themed/trail/TrailEmptyIllustration.tsx
  - apps/mobile/components/race-workspace/RaceWorkspaceSwitch.tsx
  - apps/mobile/components/catalog/CatalogPresentation.tsx
  - apps/mobile/components/themed/SummitCelebration.tsx
  - apps/mobile/lib/trailSignature.ts
  - apps/mobile/hooks/useReduceMotion.ts
  - apps/mobile/components/themed/Card.tsx
  - apps/mobile/components/themed/Screen.tsx
  - apps/mobile/components/profile/ProfileSaveButton.tsx
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
`ActionButton` is the canonical action primitive with primary, secondary,
ghost and destructive variants; small/medium/large sizes all preserve at least
a 44-point target, support leading/trailing content, and expose pressed,
disabled and loading states (each variant is a trail object, see "Trail
objects" below). `Button` remains a compatibility export of this
primitive, so existing screens adopt the same sentence-case label and geometry
without a second implementation. `LoadingState` presents an accessible busy
indicator and optional localized label. `ErrorState` provides a title,
description, and optional retry action. `EmptyState` provides a title,
description, optional illustration, and optional primary action. Screen-level
callers own all visible strings so they can use the locale files.

The Pace Yourself trail signature is expressed through a small vocabulary of
terrain objects. Every element is structural (shape/motif) rather than a
color, so it survives organizer RaceBook colors:

- `TrailBlaze` is the product waymark: light green (olive), amber and dark
  green (forest) bands stacked in fixed 2:1:4 proportions, so light green is
  deliberately shorter than dark green and the amber stays a light accent.
  Semantic tones (info, warning, danger, muted) and explicit `bandColors` keep
  two bands. It is the product's own blaze, never the red/white GR waymark. It
  marks section starts (`SectionHeading`), the leading edge of
  signature/featured cards, toasts, the error state and the summit flags. It is
  decorative and hidden from assistive technologies.
- `BlazeLine` is the same blaze laid flat: one horizontal line whose light
  green, amber and dark green segments have the blaze's 2:1:4 proportions as
  lengths (a band's thickness in the blaze equals its length share in the
  line). It is the active-state accent: it underlines the selected label in the
  global and RaceBook/plan tab bars and the active Livret/plan switch segment
  across the whole label width (the label and line share a shrink-wrapped
  container; in the tab bars the line is always laid out and hidden when
  inactive so labels never shift), and it is the active `TrailTabs` leg.
- `TrailTabs` draws in-page tabs as a trail: every label sits on a wooden
  plank along a dotted path. The active tab is a raised plank painted in the
  `solid` sign wood (grain, small knot, routed groove, top bevel, thickness,
  cast shadow, slight hand-set lean) with a bold inverse label, and its leg of
  the path becomes the `BlazeLine` (static under reduced motion). Unselected
  tabs are flat bare-wood planks (`SignPlate raised={false}`, muted wood, no
  shadow) with a semibold secondary label, so selection never relies on colour
  alone. Tabs are centered by default; `stretch` shares the full width, and
  with `scrollable` each tab is at least 1/n of the visible width (RaceBook ›
  Course). Tabs keep at least 10 points between the label and the plank
  edge. Targets are 44 points with tab roles and selected state.
- `TrailSignButton` is the "go somewhere" action drawn as a trail direction
  sign by `SignPlate`: a 44-point plank with a soft cast shadow, a 2-point
  visible thickness, a face lit from above (gradient from a lighter tone to the
  plate color), a routed border parallel to its edge, two fixing bolts on the
  post side, faint grain and a pointed 16-point end towards the destination.
  Each sign leans 0.4° to 2.9° either way and sits up to 1.5 points higher or
  lower, drawn from the session seed and its label (plus an optional
  `variationKey`, e.g. the race id); a disabled sign stays upright. Pressing
  straightens it slightly. The plate is painted wood: per-sign tip length
  (16 ± 3) and paint tone (±5 %), slightly jittered edges with chipped
  shoulders, a soft layered shadow, grain fibres and a knot, worn paint near
  the edges and tip, a top bevel, a routed groove and two ringed bolts, all
  drawn from the sign's `useTrailRandom` key; tab planks stay calm (grain and
  bevel only). In catalog formats both signs keep their natural
  width side by side with full labels and only wrap on a phone too narrow for
  both. Variants are
  `solid` (forest), `soft` (brand surface) and `muted`. It carries RaceBook map,
  general-map and transport links and both actions of each catalog format
  (RaceBook as `solid`, plan as `soft`); it is never used for form submission or
  destructive actions.
- Trail variation (`TrailSeedProvider`, `useTrailRandom(key)`,
  `createTrailRandom` in `apps/mobile/lib/trailSignature.ts`): a seed is drawn
  once per cold launch (forced with `EXPO_PUBLIC_TRAIL_SEED` or the provider
  `seed` prop; tests pass a fixed seed). Each element derives every decorative
  value statelessly from FNV-1a + mulberry32 over `seed | key | name`, so it
  never changes on re-render, tab switch or scroll — only on the next launch.
  Ranges live in `mobileComponents.trailVariation`; `amount` scales them all
  (0 = identical and upright). Only decoration varies; destructive and disabled
  elements use `neutral` and never vary. No `Math.random()` during render.
- `Cote` typesets a measurement like an elevation mark on a topographic map:
  bold JetBrains Mono figure and its unit in spaced capitals (`42,3 KM`,
  `D+ 1 240 M`). It accepts a raw value plus unit or an already formatted label,
  split by `splitCoteLabel` in `apps/mobile/lib/trailSignature.ts`; labels with
  no short trailing unit stay unchanged. `MetricTile` renders its value through
  `Cote`, and the shared race header metrics use the same split.
- `Ridge.tsx` holds the ridge-line motif: `RidgeDivider` (a thin ridge replacing
  flat separators between major blocks), `RidgeLoader` (the indeterminate busy
  indicator: the brand ridge draws and erases itself, static under reduced
  motion) and `CourseRidge` (a compact filled silhouette of a real course
  profile with its summit point). Geometry comes from pure, tested helpers in
  `apps/mobile/lib/trailSignature.ts` (profile resampling, smooth paths clamped
  to the frame, summit and dash length).
- `TrailRail` is the dotted vertical trail line linking timeline steps (RaceBook
  ravitos and supporter points, onboarding steps).
- `TopoContourPattern` draws the brand contour lines, or, when given a usable
  `profile`, nested iso-lines derived from that course's real elevation profile
  so each race carries its own fingerprint.
- `SummitCelebration` is the one-off reward when a plan is created: the course
  ridge draws itself, a flag carrying the blaze is planted on the summit, a
  success haptic plays and the title is announced to assistive technologies.
  It dismisses on tap or by itself and stays static under reduced motion.
- `TopoCard` (standard, interactive, signature, featured) is a "fiche topo": a
  clean sheet in the chosen `surface` (white by default, brand green for
  featured) with a 1-point `border.subtle` edge (`brand.border` on a featured
  brand surface), the 18-point radius and padding, a very light `shadows.sm`,
  and no texture or tilt. Its identity comes from fixed details in a clipped,
  decorative layer: faint forest contour lines in the top-right corner
  (standard, interactive, signature) or the signature course ridge as a
  bottom-right watermark (featured), plus a slender tricolour blaze flush with
  the left edge at `topoCard.blazeTop` (`topoCard.edgeBlaze`; interactive,
  signature and featured, danger or info tone on those surfaces). Interactive
  cards keep the pressed opacity and scale and add no affordance. A caller's
  `borderColor` or `backgroundColor` overrides the defaults; the card does not
  clip its children; `variationKey` is accepted but ignored. The legacy `Card`
  delegates to the signature variant. `WoodGeometry` also exports `shadeHex`,
  the shading helper used by `TrailSignButton`.
- `SectionHeading` normalizes section hierarchy.
- Shared `LoadingState` (ridge loader) and `ErrorState` (danger blaze) keep
  their semantic roles, live-region behavior and localized actions.
  `EmptyState` is a dashed cream "blank trail" card; with `signLabel` and no
  icon it draws the trail, a cairn and a start sign.

### Trail objects

- `SheetHeader` is the header of every bottom sheet and modal: a short dotted
  trail segment (48×3 points) replaces the grey drag handle (`showHandle={false}`
  on centred or fade cards), then one row with a slender 10×34 `TrailBlaze`
  (`geometry` override), the title (bold 20, header role) and optional
  secondary subtitle, an optional `trailing` slot (favourite, status pill) and
  a neutral `IconAction` close button with `closeLabel`. It only draws; sheets
  keep their own gestures.
- `AccordionSection` / `AccordionHeader` / `AccordionTrail` draw collapsible
  groups as a kilometre milestone: a 52-point row with `expanded` state, a
  40×44 borne whose 9-point cap is forest when open and grey when closed and
  which shows a mono `count` or an `icon`, the label and subtitle, and a
  chevron. When open, a solid 2-point trail descends from the borne along the
  content (indented 52 points); consecutive trails join for list rows.
  `accentColor` takes organizer colours; `disabled` locks a section open. No
  animation.

Rule of use: a sign (`TrailSignButton`) means "I go elsewhere", a plate (primary
`ActionButton`) means "I act here", and a screen shows at most one plate.

- `ActionButton` primary is an enamelled riveted plate (forest enamel lit from
  above, cream liner, four rivets, 3-point thickness, uppercase label tracked
  0.08em). Secondary is an aid-station ticket with a stub and dotted
  perforation, leaning ±0.9° per label. Ghost is an amber arrow painted on the
  ground under the label (soft exits: Plus tard, Passer, Annuler). Destructive
  is the red "wrong way" cross, reserved for confirming a deletion;
  `destructive-outline` (red cross and label on cream, 1.5-point red border, no
  fill) is for delete actions in lists, rows and management sheets. Disabled
  (any variant) is the closed trail: a
  diagonal red/white striped tape under a light label plate, never the GR
  waymark. Destructive and disabled never vary. Callers must not add their own
  disabled opacity or shadows.
- `IconAction` is a 48-point round watch button: a case with a solid ring and
  twelve hour ticks around a concentric push button (lip drawn as a ring, soft
  top highlight, sinks 4 % when pressed). Face and icon live in a fixed
  48-point box so the icon stays centred even when a caller stretches or pads
  the button in neutral, brand or danger tones, always with an
  `accessibilityLabel`. `tone="onBrand"` (forest-dark case, cream bezel,
  forest-light dome) is for forest headers. `variant="back"` draws a small sign
  blade pointing left with no glyph (the pointed plank is the arrow; an
  explicit `icon` is still honoured), drawn as a small painted plank (rounded post end,
  thickness, cast shadow, routed groove, two bolts; cream with
  `tone="onBrand"`, or `bladeColor` for organizer headers, the relief
  being dark overlays so any colour keeps its hue). Root header actions are 48-point watch
  buttons. Screens never use a raw `TextInput` or pressable icon: they use
  `Field` (units split from labels by `splitLabelUnit`) and `IconAction`.
- `ChoiceChip` is a kilometre milestone: 18-point rounded top, 11-point painted
  cap (forest when active, grey when idle, amber with `tone="climb"`), figure in
  JetBrains Mono and unit in spaced capitals split from the label;
  `kind="favorite"` paints a heart. `MilestoneCompassButton` opens all filters.
- `StatusPill` is a control wristband (24 points, coloured tab with a dotted
  tear line, mono capitals, danger tab in tape stripes) leaning ±0.75°; it is
  never pressable.
- `Field` is a road notebook: cardboard label tab, faint IGN grid, unit as a
  cote (`unit`), green tab plus `TrailBlaze` on focus, closed-trail tape strip
  on error, and `variant="search"` with a compass ring. State is never carried
  by colour alone; the input keeps a 48-point minimum height.
- `RaceWorkspaceSwitch` (Livret / plan, 56 points, `RACE_WORKSPACE_SWITCH_HEIGHT`)
  shows the active view as a white bib pinned by two safety pins with one bold
  label and one accent, the perforated tear-off line; the other view is a
  flipped hatched bib tucked behind. Leans come from `trailVariation.bib`;
  disabled bibs stay upright; each bib is a 44-point tab with its selected
  state.
- Trail cards: race cards end with a 34-point elevation strip
  (`CardProfileStrip`; with `layers` from `buildCatalogProfileLayers` it
  overlays up to five formats longest first on a shared distance axis and
  elevation range, in sober map inks — forest, blue-grey, sign-post brown,
  ochre, stone — thin strokes, light fill only under the longest; brand ridge
  when no layer exists);
  list rows use a 72x26 `CardMiniProfile` beside a `StatusPill`. Mes courses
  plan cards lead with two signs (Livret coureur solid, plan action soft, keyed
  by plan id), then watch buttons; their wristband is Brouillon (neutral), En
  cours (info) or Prêt (success) from `computePlanReadiness`. The favourite
  is a forest `HeartMark` (filled = favourite, never red) in a 44-point
  pressable. Warning banners such as "Dernière minute" carry an orange/white
  `TapeStrip`. The plan invitation shows aid stations as a dashed trail.
  Checklists stamp checked rows with `StampMark` (rotated -10 to -4° per item,
  upright when unchecked) above a static dotted progress trail.

Controls, fields, data blocks and cards use symmetric radii: the former
shortened lower-right "signature corner" was removed because it read as a
rendering defect rather than an identity.

`RootCollapsibleHeader` is the shared header for the four primary mobile tabs.
It uses the forest brand surface with a faint decorative contour pattern,
respects the native top inset, and progressively
contracts from a 76-point body to a 60-point sticky body. Both states keep one
horizontal row: a 44-point leading target at the 16-point gutter, a title whose
left edge does not move during collapse, and an optional matching trailing target.
The large title shrinks to fit one line, both lower corners share the same
radius, icon actions use the 12-point control radius, and scrolling content begins
below the expanded height.

Shared React Native geometry comes from `mobileComponents`. Filter chips use the
same selected/unselected structure across Courses and Nutrition; Profile, RaceBook Course
and plan view selectors use `TrailTabs` while the attached Livret/plan header
switch is the bib switch; input shells keep
one surface/border/radius with units or clear actions inside; modal dismiss actions
use a labelled 44-point target; primary and secondary buttons share the same
symmetric 12-point family. Screen-specific
components own copy, state, color roles and behavior.

`BriefToast` provides short success or network-error feedback above the mobile tab bar, with an optional action. It leads with a small inverse trail blaze and uses symmetric corners. Its default duration remains 2.6 seconds for success and 5 seconds for errors; callers may supply a longer duration for an actionable informational notice or `null` for an explicitly persistent notice. It is reserved for informational outcomes; destructive confirmation remains modal. Root tab headers add elevation only after collapsing, while the bottom tab bar keeps a subtle top divider and shadow.

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
- Do not use `StatusPill` for an action or `ChoiceChip` for passive information;
  their interaction semantics must remain visually distinct.
- Keep contour artwork low-contrast and decorative. It must not sit behind
  dense body copy or communicate elevation/status information.
- Do not restore the former horizontal mark at the lower-right of cards or the
  shortened lower-right corner. The leading trail blaze is the card signature.
- Never draw the red/white GR waymark or another federation mark: `TrailBlaze`
  is the product's own olive-over-forest blaze.
- Never pass a course profile the viewer is not allowed to see to
  `TopoContourPattern`, `CourseRidge` or `SummitCelebration`; in the RaceBook the
  hero contours require the organizer's `showElevationProfile`. `CourseRidge`
  must only receive a real stored profile, never a placeholder that would look
  like course data.
- Use `RidgeLoader` for milestone-based loading. Do not turn plan or launch
  milestones into a determinate ridge or percentage.
- `Cote` is for measurements; counts or statuses containing words still use the
  normal themed `Text`.
- The RaceBook elevation profile keeps its measured, unsmoothed curve. Its
  signature layer is decorative only: a faint iso-line echo offset below the
  curve, a blaze flag on the summit carrying the summit elevation as a cote (it
  replaces the redundant highest graduation label), mono map-style graduations
  and cote metric tiles. Never smooth or reshape the measured curve for style.
- Keep RaceBook hero contours faint (opacity 0.05): they sit behind the identity
  metrics and must never compete with their legibility.
- Do not make routine success toasts persistent. A longer or unbounded duration is for notices whose action must remain reachable, and the caller must still provide a clear dismissal path or bounded lifecycle.

## Related Docs

- [Tokens](tokens.md)
- [Icons](icons.md)
- [Web App](../01-architecture/web-app.md)
- [Add New Mobile Screen](../06-workflows/add-new-screen-mobile.md)
