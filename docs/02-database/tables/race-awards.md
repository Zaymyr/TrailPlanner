---
title: race_awards Table
scope: database

last_verified: 2026-11-11

ai_priority: high
related_files:
  - supabase/migrations/20260907160043_add_structured_racebook_content.sql
  - supabase/migrations/20260907170842_fix_structured_racebook_rls_dependencies.sql
  - apps/web/app/api/organizer/races/[id]/awards/route.ts
  - apps/web/lib/organizer-structured-content.ts
  - apps/web/app/organizer/_components/dashboard/structured-content-editors.tsx
  - apps/web/app/organizer/_components/dashboard/structured-content-editors.test.ts
  - apps/mobile/lib/racebook.ts
  - apps/mobile/lib/fetchWithTimeout.ts
  - apps/mobile/app/(app)/race/[id]/racebook.tsx
  - apps/mobile/components/racebook/RacebookStructuredCourseSections.tsx
related_tables:
  - race_awards
  - races
---

# `race_awards`

The shared mobile RaceBook screen now also renders additive third-party bib-pickup conditions from organizer JSON. That presentation change does not alter award rows, replacement semantics, ordering, module gates, or RLS.

The shared structured-editor status now uses the compact `À jour` label because autosave is explained globally. Award persistence, validation, ordering, and schema are unchanged.

The header-attached workspace switch and the full-width Livret profile chart are presentation only and do not change award rows.

Chronological cutoff resolution and plan access gating do not read or change award rows.

The race-workspace header toolbar/footer layout (lot 10) is presentation-only and does not change award rows, visibility, ordering, or the conditional Podiums tab.

The shared RaceBook identity header and finish-cutoff placement are presentation-only and do not change award rows, visibility, ordering, or podium timing.

Le Livret affiche toujours Podiums comme sous-onglet conditionnel de Course. La barre basse ne contient plus de sortie et les cartes de podium utilisent l'identité principale organisateur plutôt que son accent ; ces changements de navigation et de présentation ne modifient ni les lignes, ni l'ordre, ni les règles de visibilité.

RaceBook personal passage-time interpolation is client-only and does not alter this table's awards contract.

> CTA scope: the RaceBook plan CTA resolves only the current runner's saved plan for the exact `race_id`; it does not read, reorder, or change award rows or Podiums visibility.

> Terminologie : les textes français destinés aux utilisateurs emploient **Livret coureur** et les textes anglais **Race Book**. Les identifiants techniques stables — routes, événements analytics, objets de base de données et valeurs historiques — conservent `racebook`.

## Purpose and invariants

Mobile preview veiling, CTA placement, and normalized start-time display are read-only presentation; they do not change award rows or access.

Catalog plan CTAs and the RaceBook/Mon plan workspace switch do not affect award selection, publication, or row access; awards remain read-only course context.

Awards require Complete or Signature plus an active `awards` format module. Disabling masks published rows and blocks organizer writes without deleting them.

Stores the podium programme for a format, not finisher results. A row records a preset (`scratch`, `u18`, `u20`, `u23`, `senior`, `master`) or custom category, its persisted display label, audience, inclusive rewarded-place range, required podium time, optional location and reward/note.

The owner-only plan reflection in the mobile Livret does not personalize, reorder, or otherwise change the public awards collection.

Rows are ordered, replaced atomically with stable submitted ids, cascade with their format and are copied during Pro edition duplication. Public and organizer-preview reads use RLS; mutations only pass through the Organizer API after `racebook_content.manage` authorization.

The shared web editor file also reports SAS count and earliest time to the surrounding schedule card. That callback is start-wave-only and does not change award persistence or completion.

The collection travels only in the immutable RaceBook publication on mobile: a missing publication makes the RaceBook unavailable instead of querying the draft table or rendering a mixed version. Published edition primary surfaces and borders style podium cards only; they never change award ordering or meaning, while semantic states remain independent.

The typed `RacebookStructuredCourseSections` component owns only podium-card presentation; the route continues to group awards by time and enforce the active module/tab contract.

The image-backed identity hero, edition logo, compact tiered sponsor rows, and Ravitos endpoint timing layout are presentation-only and do not change award ordering, visibility, or the conditional Podiums tab.

The two-line clamp applied to bib-pickup address text is isolated from podium rendering and does not change award data or visibility.

The format access override that hides saved runner information is likewise independent from award rows and their visibility.

The Organizer editor serializes revisioned autosaves: a response for an older revision cannot replace newer local award edits and instead queues the latest revision. Masking a format from the private demo suppresses its whole RaceBook entry without deleting awards.

Published rows travel in the immutable RaceBook snapshot. A successful atomic awards replacement increments the parent draft revision and requires explicit publication before runners see it.

The 2026-09-14 iOS accessibility pass changes only mobile input, gesture, and motion presentation; award rows, ordering, visibility, and read/write contracts remain unchanged.

The RaceBook contextual bottom navigation exposes five primary sections without a duplicated exit and mirrors the global bar's color-only active treatment. Podiums remains a conditional Course sub-tab, so the hero's emergency action, focus-time scroll reset, header/system return, and navigation presentation do not alter award visibility or persistence.

Award cards now use the published accent surface and contrast-safe accent text. This is presentation-only; personal equipment checks live separately in `racebook_gear_checks` and do not alter award rows.

Confirmed Material check/uncheck analytics and the bounded per-item checked/missing snapshots remain isolated from Podiums: they neither read nor mutate award rows and carry no award category or reward content.

Per-format GPX map/profile choices affect only the `Tracé` cards and remain independent from award rows, ordering, and module visibility.

Fullscreen course visuals and tappable ravito markers remain presentation-only and do not change podium grouping, ordering, or persistence.

Global Booking and Decathlon actions are loaded through their own server-mediated contract. Booking renders in the permanent Services tab, while Decathlon renders after the Matériel checklist with generic copy. Neither action reads, filters, or alters award rows or the conditional Podiums view.

Supporter points are an independent Course collection and module. Their presence does not enable, hide, reorder, or otherwise modify award rows or the Podiums sub-tab.

Switching from the Livret to an already saved personal plan can pass an owner-scoped plan identifier and reuse a short-lived editor warm state scoped to that exact plan id. The plan's duration, pace and resolved departure render in the owner-specific hero, while ravito passage, segment duration and late-cutoff warning remain Course presentation; none enters the public awards snapshot or changes Podiums availability.

Shared localized distance/elevation formatting and RaceBook hero/control polish do not read, derive, reorder, or mutate award rows.

Progressive plan disclosure (2026-11-09): the plan is optional in the RaceBook. Runners without an owned plan for the format see no `Livret officiel | Mon plan` switch, no `Temps prévu`/`Allure` hero metrics and an unattached hero; the only plan entry is the discreet `RacebookPlanInviteCard` at the end of the Course route/ravitos sub-tabs (hidden in guided RaceBook onboarding, for past races and when D+ is unknown). Once a plan exists, the switch (labelled `Mon plan`) and plan metrics appear and the plan keeps enriching the Livret. This is runner presentation only: it reads and writes no row of this domain.

RaceBook polish (2026-11-09): the runner hero keeps the format/event thumbnail but renders it blurred (`blurRadius` 24) under a 90% organizer-primary veil, so no artwork text is readable behind the identity, omits the default `Solo` participation label, appends a `J-N`/`Aujourd'hui` countdown to the date line (hidden after race day), and moves its expanded block up with the collapse so titles never overlap and metrics are never clipped. Runner wording was simplified (`Où encourager`, `Barrière horaire`, `Sac d'allègement`, `Nourriture`, `Relais {n}`, weather-alert and partial-route sentences). Access transport notes turn pasted URLs into labelled buttons (`Réserver ma navette` / `Ouvrir le lien`) and bib pickup addresses without an organizer maps link fall back to a Google Maps search (`lib/racebookTextLinks.ts`). Profile cumulative tiles show `—` until the runner touches the curve. This is runner presentation only: no row, contract or tracking of this domain changes.

Publication checks and partner slots (2026-11-09): pre-publication checks and the Matériel/hébergement partner slots read the built snapshot and their own table only. They do not read, write or change this domain's rows or contracts.

Trail signature (2026-11-09): the runner RaceBook screen adds presentation only: faint contour lines in the hero derived from the already-loaded course elevation profile (drawn only when the organizer publishes it through `gpxDisplay.showElevationProfile`) and a ridge-line divider inside the course essentials card. It reads and writes no row of this domain and changes no query, payload or analytics event.

Trail signature iteration (2026-11-11): runner presentation only. In-page RaceBook Course, Profile and plan view selectors become trail tabs, map/transport links and the catalog format RaceBook action become signpost buttons, catalog format distance/D+ read as cotes, tab-bar blazes move to the left of the selected icon, the hero contours are lightened and the elevation profile gains a decorative summit flag and iso-line echo. No query, row, payload, navigation target or analytics event changes.

## Mobile presentation

The RaceBook screen (`apps/mobile/app/(app)/race/[id]/racebook.tsx`) renders its last-minute update through `components/racebook/TapeAlertBanner` (orange/white tape strip, 44-point expand toggle) and passes the resolved start time to the plan invitation card; data loading and writes are unchanged.

The RaceBook Course tab (Tracé, Ravitos, Où encourager) uses `TrailTabs` with `stretch` + `scrollable`: tabs share the full width, the active one on a raised painted wooden plank and the others on flat bare-wood planks. The Livret / plan bib switch is 56 points high (`RACE_WORKSPACE_SWITCH_HEIGHT`).

The RaceBook Course map and profile cards open fullscreen through watch `IconAction`s (labels `racebookMapExpand` / `racebookProfileExpand`) instead of ad-hoc square buttons; behaviour unchanged.

The RaceBook weather alert renders through the same `TapeAlertBanner` as the last-minute message (replacing the former inline alert card); data unchanged.

Sheets and modals use the shared `SheetHeader` (dotted trail handle, slender blaze, title, watch close button) and collapsible groups use `AccordionSection` (km borne with a count or icon, forest trail along the open content); UI only, data and queries unchanged.




