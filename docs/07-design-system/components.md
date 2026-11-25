---
title: Design Components
scope: design-system
last_verified: 2026-11-24
# Organizer headers (2026-11-13): `SectionHeader` receives a section-specific icon, supports two-line titles, and no longer supplies a generic arrow fallback.
ai_priority: medium
related_files:
  - apps/web/components/ui/button.tsx
  - apps/web/components/ui/card.tsx
  - apps/web/components/ui/input.tsx
  - apps/web/components/ui/dialog.tsx
  - apps/web/app/organizer/_components/dashboard/form-kit/index.tsx
  - apps/web/components/ui/tabs.tsx
  - apps/web/components/ui/StatusBadge.tsx
  - apps/web/components/ui/Switch.tsx
  - apps/web/components/ui/Select.tsx
  - apps/web/components/ui/Drawer.tsx
  - apps/web/components/ui/EmptyState.tsx
  - apps/web/components/ui/KpiTile.tsx
  - apps/web/components/ui/kpi-delta.ts
  - apps/web/components/ui/kpi-delta.test.ts
  - apps/web/components/ui/Toast.tsx
  - apps/web/components/ui/CommandPalette.tsx
  - apps/web/components/ui/command-palette-filter.ts
  - apps/web/components/ui/command-palette-filter.test.ts
  - apps/web/components/ui/focus-trap.ts
  - apps/web/components/utils.ts
  - apps/web/components/race-planner/ActionPlan.tsx
  - apps/web/components/race-planner/AidStationBadge.tsx
  - apps/web/components/race-planner/TimelineIcons.tsx
  - apps/web/components/race-planner/plan-fonts.ts
  - apps/web/components/race-planner/plan-views/PlanHeroStats.tsx
  - apps/web/components/race-planner/plan-views/PlanViewTabs.tsx
  - apps/web/components/race-planner/plan-views/chronology-types.ts
  - apps/web/app/(planner)/race-planner/components/PlanPrimaryContent.tsx
  - apps/web/components/course-weather/CourseWeatherPanel.tsx
  - apps/web/components/course-weather/course-weather-model.ts
  - apps/web/app/(planner)/race-planner/components/ElevationProfileChart.tsx
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
  - apps/mobile/hooks/useQuickReturnHeader.ts
  - apps/mobile/lib/quickReturnHeader.ts
  - packages/design-system/src/tokens/mobile-components.ts
related_tables: []
---

# Design Components

`Cote` gains an `xs` size (mono `xs` figure and unit) for dense rows such as catalog cards. Readiness wristbands: draft neutral, « En construction » warning (amber), ready success.

## Purpose

This document records the current web component primitives and styling conventions visible in the repo. The shared design-system package exports tokens/icons; web primitives live under `apps/web/components/ui` and mobile primitives live under `apps/mobile/components/themed`.

## Key Concepts

- UI primitive: small reusable web component.
- `cn`: class name join helper.
- Variant: component prop that selects a style branch.
- Theme variable: CSS HSL variable from `apps/web/app/globals.css`.
- Full-width form controls keep `min-width: 0` so intrinsic input sizing cannot overflow narrow cards or grid columns.

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
- `TimeSeriesLineChart.tsx`
- admin console primitives (2026-11-22): `StatusBadge.tsx`, `Switch.tsx`, `Select.tsx`, `Drawer.tsx`, `EmptyState.tsx`, `KpiTile.tsx` (+ `kpi-delta.ts`), `Toast.tsx`, `CommandPalette.tsx` (+ `command-palette-filter.ts`), and the shared `focus-trap.ts` helper (see « Admin console primitives » below)

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
- Escape dismissal, initial focus, Tab/Shift+Tab focus trap, and focus restoration to the trigger on close.

## Admin console primitives (2026-11-22)

Created for the admin console (ADR [2026-11-22 admin console](../08-decisions/2026-11-22-admin-console.md), lot 1) and meant to be reused by every admin screen instead of local badges, toggles and modals. French copy, keyboard and screen-reader support built in; pure logic is unit-tested (`vitest.config.ts` includes `components/**/*.test.ts`).

- `StatusBadge` — one pill for every status: `tone` = `neutral | info | success | warning | danger`, optional dot (`dot`, default on) and `pulse` for something running. The text carries the meaning; the colour is a reinforcement.
- `Switch` — on/off control: a native `<button role="switch" aria-checked>`, `checked` + `onCheckedChange`; with `label` (and optional `description`) it renders the labelled row, otherwise pass `aria-label`.
- `Select` — styled native `<select>` (forwardRef, all native props) with a chevron; keeps the browser's keyboard and mobile pickers. Prefer it to a custom listbox.
- `Drawer` — side panel (`side="right"` by default, `left` for the mobile admin menu): portal, `role="dialog"` + `aria-modal`, title (`hideTitle` keeps it for screen readers only) and description wired by id, focus moved inside and trapped (`focus-trap.ts`), Échap and backdrop close, focus returned to the opener, page scroll locked while open. `actions` sit next to the close button; `className` sets the panel background and text colours (default `bg-card text-foreground`).
- `EmptyState` — dashed card with title, description and an action slot (empty lists, placeholder pages).
- `KpiTile` — dashboard figure: label, value in mono figures, optional `hint` line under the value (2026-11-23, « Ventes & facturation »), change vs the previous period and an SVG sparkline. `formatKpiDelta(current, previous, { mode, higherIsBetter })` (`kpi-delta.ts`) gives « ▲ 12,4 % » / « ▼ 3 » / « = » / « nouveau » with a tone (`positive | negative | neutral`, inverted when `higherIsBetter: false`) and a spoken description; `sparklinePaths(values, width, height)` returns the line and area paths (null under two points).
- `Toast` — `ToastProvider` (mounted by `AdminShell`) and `useToast().show({ message, tone, actionLabel, onAction, durationMs })`: polite live region bottom right, four toasts at most, 5 s (8 s with an action) before closing; the action (« Annuler ») runs once then closes the toast. Use it for reversible actions; irreversible ones keep an explicit `Dialog`.
- `CommandPalette` — ⌘K / Ctrl+K dialog (`useCommandPaletteShortcut(open)`): combobox input + grouped listbox (`aria-activedescendant`), ↑ ↓ (wrapping), Ctrl+Début/Fin, Entrée, Échap, Tab kept inside. The caller passes every item (`CommandItem`: `id`, `label`, `group`, `href`, `hint`, `keywords`, `prefiltered`); `filterCommandItems` matches every word of the query ignoring case and accents (label prefix, then word prefix, then contains, then keywords), keeps groups in their first-seen order and caps each group (`limitPerGroup`); `prefiltered` items (server search results) are kept for any non-empty query and hidden for an empty one. The admin wiring (destinations, runners, races) is `AdminCommandPalette` in `app/admin/_components/shell`.

## Race plan (web) (2026-11-23)

Visual language of the web race planner (« carte de course »), redesigned without any logic or data change. It uses the signature icons and brand tokens written as Tailwind arbitrary values (forest `#2D5016` / dark `#1F3810`, olive `#C8D44E`, cream `#FAF8F2`, alpine blue `#3F6F8F`), with no raw emerald / rose / slate.

- Rail: timeline points sit on a dotted trail rail (`RailItem` in `ActionPlan.tsx`: marker column + content). Setup steps (`PlannerSetupSteps.tsx`) are one cream sheet with numbered posts on the same kind of rail.
- Markers: `AidStationBadge` draws round trail posts: start = forest post with a start-arch glyph, ravito = cream post ringed in forest with the signature `AidStationIcon`, finish = dark forest post with an olive tab; a small mono tab carries the point number. It is also used by the organizer aid-stations editor.
- Station card: white, light ring (no coloured border). Meta line = forest mono post chip (« km 11,0 »), « Passage 1h 28min », pause (only when > 0), service pill with Hydration / Nutrition icons, crew pill. Products are pills with a forest quantity badge, service toggles are pill checkboxes, remove is a trash icon.
- Position / window gauge (`NutritionCard`, redesigned after founder feedback): the only solid bar is the planned amount (forest when on target, amber / danger outside); the target window is a dashed outline, never a fill, so it cannot be read as « the bar »; a tick marks the exact target. Layout: one compact mono line « Glucides 180 g / 103 g », the bar, then « +77 g » and « Cible 103 g » (or the water-capacity helper). Names no longer carry « totaux / totale / total ». The tone still comes from `getPlanStatus` / `buildGaugeRanges`; a water capacity shortfall is flagged by `helperIsWarning`.
- Three views (`ActionPlan.tsx`), same as the mobile app: `PlanHeroStats` above, then the sticky `PlanViewTabs`, then one panel. « Ravitos »: aid stations with products and compact gauges for the section that follows each point, a one-line `SectionHeaderLine` (« Départ → Chaponost · 11,0 km · ↗ ↘ · durée · allure ») and a « Découper · allure » button that opens the pace view scrolled to that section. « Allures »: per section the header, the section pace stepper, the section elevation chart, the sub-section list only when the section is split, and « + Marqueur » / « Découpage auto ». « Chronologie »: rendered by the page through the `renderChronology` prop (`ChronologyView`, see [Nutrition algorithm](../03-business-rules/nutrition-algorithm.md#web-chronology-re-timing-2026-11-23)). Folding an aid station only hides its section in the Ravitos view.
- Free preview: the Ravitos view keeps the departure and the first aid station usable, the Allures view keeps the first section, and the Chronologie blurs from section 2 (`lockedFromIndex`). Section elevation charts in the Allures view name their ends after the two aid stations of the section (`ElevationProfileChart` / `SubSectionElevationChart` `startLabel` / `finishLabel`), and split-part charts after their kilometres, instead of « Départ » / « Arrivée » (2026-11-23, display only).
- Section strip (`SegmentCard`, `section` variant): distance, time, D+ (`SummitIcon`) / D- (`DescentIcon`) and the pace stepper (`PaceIcon`).
- Finish card: a light card « Arrivée · km · arrivée estimée » (finish post marker). It replaces the former dark « ticket d'arrivée »; the race totals now live in the `PlanHeroStats` band.
- Elevation profile (`ElevationProfileChart.tsx`): subtle forest area, climb forest / descent alpine blue, mono axes, station posts with haloed labels, discreet legend. The farthest aid station is treated as the finish only within max(0.3 km, 2 %) of the course end; otherwise the finish is drawn at the course end (catalog aid stations stop before the finish).
- Plan-scoped fonts: `plan-fonts.ts` loads Bricolage Grotesque (`--font-plan-display`) and JetBrains Mono (`--font-plan-mono`) with `next/font` and exposes `planFontVariables`, applied on the `PlanPrimaryContent` root and the timeline card and used as `font-[family-name:var(--font-plan-display)]` / `font-[family-name:var(--font-plan-mono)]`. The rest of the site keeps its stack (same approach as the admin console fonts in [Tokens](tokens.md)).
- Numbers are locale-formatted (« 11,0 km », « 3,0 L », « 24,8 km » via `formatDistanceWithUnit`).
- Plan views (`components/race-planner/plan-views/`, pure presentational, `locale: "fr" | "en"`): `PlanHeroStats` is the persistent dark forest race band above the tabs (race name, perforated edge, « Plan prêt : N tronçons sur M dans la cible » completeness line with a segmented bar, a full-width mono stats grid under it: estimated time, distance with D+ / D−, carbs with g/h and gels, water, sodium with the web-only `SaltIcon`; olive elevation sparkline with aid-station ticks; `ActionPlan` feeds `computeCompleteness` the same planned amounts and `getPlanStatus` tones as the gauges, a section counting on target when carbs and sodium are `success` and water is `success` or `neutral`); `PlanViewTabs` is the sand pill tablist « Ravitos / Allures / Chronologie » with a forest active pill (roving tabindex, arrow / Home / End keys, ids from `planViewTabId` / `planViewPanelId`); `ChronologyView` is the vertical time rail (relative mono clock, station posts, section header, event rows with Nutrition / Hydration / Salt icons) that blurs and inerts sections from `lockedFromIndex` behind `renderLockedCta`. `chronology-types.ts` now re-exports the `lib/plan-chronology.ts` types (no local copy).

## Organizer form kit

The route-local Organizer form kit standardizes labelled fields, select/file/switch controls, local repeatable drafts, validation messages and polite sticky save status. Drafts remain client-only until valid and saved; errors appear after interaction or an attempted save.

`SelectField` is the only route-level wrapper allowed to render a native `<select>`; editors consume the wrapper rather than duplicating height, focus, and error classes.

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
  inactive so labels never shift). `TrailTabs` no longer draw it: their painted
  plank marks the active tab.
- `TrailTabs` draws in-page tabs as a trail: every label sits on a wooden
  plank along a dotted path. The active tab is a raised plank painted in the
  `solid` sign wood (grain, small knot, routed groove, top bevel, thickness,
  cast shadow, slight hand-set lean) with a bold inverse label; there is no extra underline,
  the painted plank already marks the active tab. Unselected
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
  Each sign leans 0.2° to 1.45° either way (halved on 2026-11-15 so signs never look crooked) (capped by its measured width with
  `capLeanForWidth` so the tip drifts at most 4.5 points) and sits up to 1.5 points higher or
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
  clip its children; `variationKey` is accepted but ignored; `contours={false}` drops the contour
  corner (RaceBook › Course map and profile cards). The legacy `Card`
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
  perforation, leaning ±0.9° per label; its stub shows the `leading` glyph,
  otherwise a single punched hole — never a number or text. Ghost is an amber arrow painted on the
  ground under the label (soft exits: Plus tard, Passer, Annuler);
  `arrowDirection="back"` mirrors it for « Précédent ». Destructive
  is the red "wrong way" cross, reserved for confirming a deletion;
  `destructive-outline` (red cross and label on cream, 1.5-point red border, no
  fill) is for delete actions in lists, rows and management sheets. Disabled
  (any variant) is the closed trail: a
  diagonal red/white striped tape under a light label plate, never the GR
  waymark. Destructive and disabled never vary. Callers must not add their own
  disabled opacity or shadows.
- `IconAction` is a 48-point round watch button: a plain case with a thin ring
  (the former twelve hour ticks were removed on 2026-11-15 as visually too heavy) around a concentric push button (lip drawn as a ring, soft
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
- Trail cards: race cards carry no elevation strip;
  list rows use a 72x26 `CardMiniProfile` beside a `StatusPill`. Mes courses
  plan cards lead with two signs (Livret coureur solid, plan action soft, keyed
  by plan id), then watch buttons; their wristband is Brouillon (neutral), En
  cours (info) or Prêt (success) from `computePlanReadiness`. « Voir les
  distances » on race cards is a soft `TrailSignButton`. The favourite
  is a forest `HeartMark` on the title line (filled = favourite, never red) in a 44-point
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
below the expanded height. An optional `hideProgress` value from
`useQuickReturnHeader` slides the compact bar fully off screen on long lists and
fades in a brand strip over the status bar; screens without it keep the sticky
compact bar. `RacebookCollapsibleHero` and `RaceWorkspaceSwitch` take the same
optional `hideProgress`; the hero's strip uses the organizer primary and sits
above the switch so both can slide under it.

Shared React Native geometry comes from `mobileComponents`. Filter chips use the
same selected/unselected structure across Courses and Nutrition; Profile, RaceBook Course
and plan view selectors use `TrailTabs` while the attached Livret/plan header
switch is the bib switch; input shells keep
one surface/border/radius with units or clear actions inside; modal dismiss actions
use a labelled 44-point target; primary and secondary buttons share the same
symmetric 12-point family. Screen-specific
components own copy, state, color roles and behavior.

`BriefToast` provides short success or network-error feedback above the mobile tab bar, with an optional action. It leads with a small inverse trail blaze and uses symmetric corners. Its default duration remains 2.6 seconds for success and 5 seconds for errors; callers may supply a longer duration for an actionable informational notice or `null` for an explicitly persistent notice. It is reserved for informational outcomes; destructive confirmation remains modal. Root tab headers add elevation only after collapsing, while the bottom tab bar keeps a subtle top divider and shadow.

Supporter Guide and followed-plan screens reuse the same `TopoCard`, `ActionButton`, `Field`, `SectionHeading`, loading, error and empty-state primitives as the runner app. Their public or follower-specific data must never be represented by a decorative variant that hides availability, emergency, or access state.

## Gotchas

- The shared web `Button` primitive enforces a 44 px minimum height. Compact visual variants may reduce padding or font size, but must not override the minimum interactive target.

- Web UI primitives are not currently exported from `@pace-yourself/design-system`.
- `Drawer` and `CommandPalette` portal into `document.body` and lock nothing but the page scroll (Drawer); only one should be open at a time. Both reuse `focus-trap.ts`; `Dialog` still has its own copy of the same selector.
- `cn` does not merge Tailwind conflicts: pass the background of a `Drawer` through `className` (which replaces the default `bg-card text-foreground`), not as an extra class on top of it.
- If moving primitives into the design-system package, update package exports, web transpilation, and docs.
- Keep primitive variants small and consistent with existing Tailwind/CSS variable names.
- Avoid duplicating primitives or route-local components without first checking whether an existing component can be reused or extended.
- Use the Organizer form kit inside the Organizer route rather than adding a competing route-local form control pattern.
- Do not introduce a new class merge library without a real collision problem; current `cn` only joins classes.
- Race plan buttons that override the shared `Button` (which sets `min-h-11` and its own height, padding and colours) need `!` utilities (for example `!h-8 !min-h-0`) because `cn` does not merge conflicting Tailwind classes; keep a 44 px target on touch-first controls and only lower it for compact secondary actions.
- Plan gauges: the target window must stay a dashed outline and never become a fill, otherwise it reads as the planned amount again (founder feedback); only the planned-amount bar is solid.
- `TimelineIcons.tsx` imports `React` explicitly because Vitest renders the plan-views components with the classic JSX runtime; keep that import when editing the file.
- The plan fonts only exist inside elements that carry `planFontVariables`; `var(--font-plan-...)` elsewhere falls back to the default stack.
- Since `cn` does not merge conflicting Tailwind utilities, route-specific dialogs that replace the primitive's default `grid` layout must use an explicit priority modifier such as `!flex`; otherwise constrained inner scroll regions can be clipped.
- Do not create a local loading, error, or empty state when a themed state can
  express the screen; pass localized labels and preserve the shared retry CTA.
- Use `DataText` only for comparable numeric values. Counts or statuses containing words use the normal themed `Text` component.
- Do not use `StatusPill` for an action or `ChoiceChip` for passive information;
  their interaction semantics must remain visually distinct.
- Wire a quick-return header through `useQuickReturnHeader().onScroll` only: it
  also feeds `scrollY`, and a second handler writing `scrollY` would desynchronise
  the collapse from the hide decision.
- Keep contour artwork low-contrast and decorative. It must not sit behind
  dense body copy or communicate elevation/status information.
- Do not restore the former horizontal mark at the lower-right of cards or the
  shortened lower-right corner. The leading trail blaze is the card signature.
- Never draw the red/white GR waymark or another federation mark: `TrailBlaze`
  is the product's own olive-over-forest blaze.
- Never pass a course profile the viewer is not allowed to see to
  `TopoContourPattern`, `CourseRidge` or `SummitCelebration`; the RaceBook hero no
  longer draws course contours. `CourseRidge`
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
- Do not make routine success toasts persistent. A longer or unbounded duration is for notices whose action must remain reachable, and the caller must still provide a clear dismissal path or bounded lifecycle.

## Related Docs

- [Tokens](tokens.md)
- [Icons](icons.md)
- [Web App](../01-architecture/web-app.md)
- [Add New Mobile Screen](../06-workflows/add-new-screen-mobile.md)

Organizer uploads reuse `FileField` for a single file and `MultiFileField` for official import documents. Both expose a human-readable format/size hint, visible selected filenames, replacement or removal actions, and visually hidden native inputs.

Organizer `FieldGroup` uses a responsive label/description column (up to 200 px) beside its controls and stacks on narrow screens. `Field` owns the explicit `Requis`, `Optionnel`, and inherited markers, while `SectionHeader` provides the shared icon/title/description/status composition.

`FileField` renders an optional 80 px preview, filename, mono metadata, and replacement/removal actions while keeping the native input visually hidden. Empty file fields use the same compact drop target.

`SwitchRow` is the single Organizer yes/no presentation: label and optional explanation on the left, accessible switch on the right, and a shared focus target. `BooleanField` remains an alias for compatible callers.

Organizer editor cards now use `SectionHeader` with a brand-surface icon, visible description, save state, and a subtle token-based terrain wash. Dark mode relies only on theme variables.

Compact `FileField` actions wrap beneath metadata so the control remains contained in the 250 px media rail and narrow mobile layouts.

## Course weather (2026-11-23)

`apps/web/components/course-weather/` (display-only, fr/en copy in `copy.ts`, pure logic in `course-weather-model.ts`):

- `CourseWeatherPanel`: shared shell. States: loading, `too_early` (« Prévisions météo disponibles à partir du {date} »), forecast rows, a discreet one-line message for a provider error or fetch failure; `unavailable` renders nothing. Footer: « Prévision du {date} » plus the provider attribution (`source.attribution`, linked).
- Row: local time (race time zone), `CourseWeatherGlyph` (small inline-SVG set, signature stroke: clear, clear night (moon), partly, partly night, cloudy, fog, rain, snow, storm; MET `symbol` mapped by `weatherGlyphForSymbol`, `_night` and `_polartwilight` variants get the moon), label and km, temperature with feels-like, wind and gusts, precipitation, alert chips (heat, cold, wind, rain, storm, snow from `courseWeatherHourAlerts`). « Heure de départ estimée à 7h » when `startTimeIsEstimated`.
- `CoursePlanWeather` (planner, one row per plan passage via `passagesFromPlanSegments` and `courseWeatherAtPassages`) and `CourseRaceDayWeather` (public race page, one summary row per course point over the hours the field is likely to pass it, `courseWeatherLikelyPassageHours`). Light theme tokens only (`border-border`, `bg-card`, `text-muted-foreground`), no `dark:` classes.
- Tests: `course-weather-model.test.ts`.
