---
title: race_start_waves Table
scope: database

last_verified: 2026-11-23
# Structured runner-info phase (2026-11-15): additive start-area, briefing and key-rule objects coexist with historical strings for old mobile compatibility; equipment control checkpoints and short notes are optional runner guidance.
# Structured bib phase (2026-11-15): required and third-party document kinds are optional JSON lists rendered as runner-facing guidance; historical free text remains visible as conversion source and no persisted runner checklist is introduced.
# Structured access phase (2026-11-15): optional parking and shuttle collections use geocoded locations, bounded notes and edition-day schedules; event inheritance and historical text fallbacks remain intact, while public pages expose summaries only.
# Structured station phase (2026-11-15): optional amenities, supporter access and maximum-stop metadata remain in organizer JSON; runner surfaces prefer them while preserving legacy notes, and planner pauses only warn when they exceed the organizer limit.
# Structured cutoff phase (2026-11-15): optional day offsets make overnight and multi-day aid-station/final cutoffs deterministic; missing offsets preserve the historical clock heuristic, and relay clock columns remain text normalized client-side.

ai_priority: high
related_files:
  - supabase/migrations/20260907160043_add_structured_racebook_content.sql
  - supabase/migrations/20260907170842_fix_structured_racebook_rls_dependencies.sql
  - supabase/migrations/20260908160018_preserve_global_start_time_without_waves.sql
  - apps/web/app/api/organizer/races/[id]/start-waves/route.ts
  - apps/web/lib/organizer-structured-content.ts
  - apps/web/app/organizer/_components/dashboard/structured-content-editors.tsx
  - apps/web/app/organizer/_components/dashboard/structured-content-editors.test.ts
  - apps/mobile/lib/racebook.ts
  - apps/mobile/lib/fetchWithTimeout.ts
  - apps/mobile/app/(app)/race/[id]/racebook.tsx
  - apps/mobile/components/racebook/RacebookStructuredCourseSections.tsx
related_tables:
  - race_start_waves
  - races
---

# `race_start_waves`

The runner RaceBook no longer shows an « Où encourager » Course sub-tab: supporter points live only in the Livret supporter, and Course sub-tab keys now come from `apps/mobile/lib/racebookCourseTabs.ts` (tested so the tab cannot silently return through a merge). Its « Livret supporter · Partager à mes proches » entry is an interactive `TopoCard` with localized copy. SAS rows and time authority are unchanged; the Supporter Guide programme lists each published wave as a dated start.

Published waves feed each format’s start entries in the Supporter Guide Programme timeline. Missing waves fall back to the published common start time; the `start_waves` module gate remains authoritative.
The organizer's unified time fields and local repeatable-list drafts do not change SAS persistence or ordering. A draft wave is not submitted until it is valid; existing atomic replacement and membership checks remain authoritative.

The shared mobile RaceBook screen now also reads additive bib-pickup conditions. SAS ordering, time precedence, structured replacement, module visibility, and RLS remain unchanged.

Organizer departure microcopy now identifies the earliest wave as `Heure du premier départ (SAS 1)` and directs users to the SAS tab for the remaining waves. Wave timing and persistence rules are unchanged.

The header-attached workspace switch does not alter SAS visibility, ordering, or time authority.

Official cutoffs are resolved from the official (or first ordered SAS) departure; a personal departure only shifts the comparison with the runner's passages and never changes SAS times.

The race-workspace header toolbar/footer layout (lot 10) keeps the same departure fallback and does not alter SAS visibility, ordering, or time authority.

The shared header may use the first ordered SAS only when the common organizer departure is absent. Personal departure selection does not alter the maximum duration derived from that official departure and the finish cutoff.

SAS reste conditionnel dans Course et ses cartes utilisent la couleur principale d'identité. La barre du Livret ne duplique plus de sortie ; retour d'en-tête et retour Android utilisent la même destination sans modifier l'autorité, l'ordre ou les heures des vagues.

RaceBook passage clock labels continue to resolve departure time from existing runner or start-wave data.

> CTA scope: the RaceBook plan CTA is runner-owned and format-scoped; it does not read, create, or alter SAS rows or their time authority.

> Terminologie : les textes français destinés aux utilisateurs emploient **Livret coureur** et les textes anglais **Race Book**. Les identifiants techniques stables — routes, événements analytics, objets de base de données et valeurs historiques — conservent `racebook`.

## Purpose and invariants

RaceBook and plan headers may display the first ordered wave only as a fallback for normalized organizer schedule start time; this does not write a runner's manual recap departure back to a wave.

The locked-plan preview boundary and catalog plan CTA are independent of start-wave storage. A short preview course retains its genuine arrival; neither manual unlock CTA nor workspace navigation changes selected start-wave data.

SAS require Complete or Signature plus an active `start_waves` format module. Disabling masks published rows and blocks organizer writes without deleting them.

Stores ordered start waves (SAS) for a format. Each row has a name, native departure time, ordering and one criterion: all runners, bib range, estimated finish-time range, pace range or custom rule. Database checks require only the bounds relevant to that criterion and reserve free text for `custom`.

Existing `organizer_details.schedule.startTime` values are backfilled as `Départ commun`. Atomic replacement preserves submitted ids and synchronizes the earliest SAS time back to `schedule.startTime` for legacy consumers. While at least one SAS exists, its earliest time is authoritative and the Organizer disables manual editing of the common start time. Removing the last SAS preserves the last synchronized `schedule.startTime`, which becomes editable again. Deleting or duplicating a format cascades or copies rows respectively.

Public/preview read and mutation rules are identical to other RaceBook content: published RaceBook or authorized organizer for reads, and service-role API plus `racebook_content.manage` for writes.

A SAS change advances the linked-plan official revision because it can change a displayed personal passage clock; it warns the runner but does not recalculate their personal durations or pauses. The Livret renders only `Passage prévu à : HH:mm` above the cutoff row; pause details stay in the plan.

The collection is additive on mobile: a temporary Data API/table-unavailable error is treated as no SAS so legacy RaceBooks remain readable during staggered deployment. Its public policy resolves publication solely through `races`; it must not join the service-role-only `race_event_editions` table. Published primary surfaces may style SAS cards and accent-tinted positive information rows may highlight the schedule, but neither changes time authority or ordering.

The typed `RacebookStructuredCourseSections` component owns only SAS-card presentation; the route keeps tab availability and the normalized ordered collection. Mobile renders the ordered rows in `SAS`, with an `S1`, `S2`, etc. marker, name, start time, and eligibility criterion. The resolved personal/common/first-SAS departure is presented once in the Livret hero instead of being repeated in Course summaries or the Ravitos departure card; this adds no stored sequence or derived schedule authority.

The expanded identity hero displays course-level date, distance and elevation metrics but not a derived SAS departure; its compact sticky state keeps course identity, back navigation, emergency and social actions. Start-wave time authority remains in the Course section and is unaffected by hero focus reset, branding, collapse state, or sponsor placement.

The two-line clamp for bib-pickup address links is isolated from SAS rendering and does not change start-wave data or ordering.

Disabling the format access override hides saved runner information only; it does not change SAS rows or start-time authority.

The Organizer editor serializes revisioned autosaves: a response for an older revision cannot replace newer local SAS edits and instead queues the latest revision. Masking a format from the private demo suppresses its whole RaceBook entry without deleting start waves.

Published rows travel only in the immutable RaceBook snapshot on mobile. A successful atomic SAS replacement changes the draft and requires explicit publication before it changes the runner payload.

The 2026-09-14 iOS accessibility pass changes only mobile input, gesture, and motion presentation; SAS time authority, ordering, visibility, and write contracts remain unchanged.

The contextual RaceBook bottom bar changes only primary-section navigation. SAS remains a conditional Course sub-tab and the common start-time synchronization contract is unchanged.

The hero and Android hardware back replace the active RaceBook with Courses, or Plans for an explicit plan-workspace origin; this stack behavior does not alter SAS visibility, ordering, or time authority.

Mobile SAS index and time treatments now use published accent variants. Source wave rows and ordering remain unchanged, and personal equipment checks stay in their separate owner-scoped table.

Per-format GPX map/profile choices affect only the `Tracé` cards and do not alter SAS rows, ordering, or start-time authority.

Fullscreen course visuals and tappable ravito markers remain independent from SAS selection, times, criteria, and ordering.

Global Booking and Decathlon actions are an independent partner payload. Booking renders in the permanent Services tab and Decathlon in Matériel; their availability and presses do not change SAS rows, the authoritative common start time, or Course sub-tab visibility.

Material check/uncheck analytics and bounded per-item checked/missing snapshots are independent from SAS selection and timing; they carry no wave fields and do not mutate start-wave rows.

Supporter points intentionally carry no personalized or official passage time in the first version. Start-wave resolution therefore does not alter their chronology.

When a linked plan exists, its duration-based pace belongs with the Livret identity metrics; each matched ravito shows a resolved clock aligned above the red cutoff and each blue connector may show its pause-excluded expected duration. A late passage exposes a disclosure icon. Tapping the clock row opens the targeted plan editor without a second CTA. Switching back can reuse local editor warm state only for the exact plan id; none of these presentation actions rewrites SAS rows or their time authority.

Departure and passage clocks now share normalized `HH:MM` presentation. The authoritative wave/start resolution and stored source values are unchanged.

Progressive plan disclosure (2026-11-09): the plan is optional in the RaceBook. Runners without an owned plan for the format see no `Livret officiel | Mon plan` switch, no `Temps prévu`/`Allure` hero metrics and an unattached hero; the only plan entry is the discreet `RacebookPlanInviteCard` at the end of the Course route/ravitos sub-tabs (hidden in guided RaceBook onboarding, for past races and when D+ is unknown). Once a plan exists, the switch (labelled `Mon plan`) and plan metrics appear and the plan keeps enriching the Livret. This is runner presentation only: it reads and writes no row of this domain.

RaceBook polish (2026-11-09): the runner hero keeps the format/event thumbnail but renders it blurred (`blurRadius` 24) under a 90% organizer-primary veil, so no artwork text is readable behind the identity, omits the default `Solo` participation label, appends a `J-N`/`Aujourd'hui` countdown to the date line (hidden after race day), and moves its expanded block up with the collapse so titles never overlap and metrics are never clipped. Runner wording was simplified (`Où encourager`, `Barrière horaire`, `Sac d'allègement`, `Nourriture`, `Relais {n}`, weather-alert and partial-route sentences). Access transport notes turn pasted URLs into labelled buttons (`Réserver ma navette` / `Ouvrir le lien`) and bib pickup addresses without an organizer maps link fall back to a Google Maps search (`lib/racebookTextLinks.ts`). Profile cumulative tiles show `—` until the runner touches the curve. This is runner presentation only: no row, contract or tracking of this domain changes.

Publication checks and partner slots (2026-11-09): pre-publication checks and the Matériel/hébergement partner slots read the built snapshot and their own table only. They do not read, write or change this domain's rows or contracts.

Trail signature (2026-11-09): the runner RaceBook screen adds presentation only: faint contour lines in the hero derived from the already-loaded course elevation profile (drawn only when the organizer publishes it through `gpxDisplay.showElevationProfile`) and a ridge-line divider inside the course essentials card. It reads and writes no row of this domain and changes no query, payload or analytics event.

Trail signature iteration (2026-11-11): runner presentation only. In-page RaceBook Course, Profile and plan view selectors become trail tabs, map/transport links and the catalog format RaceBook action become signpost buttons, catalog format distance/D+ read as cotes, tab-bar blazes move to the left of the selected icon, the hero contours are lightened and the elevation profile gains a decorative summit flag and iso-line echo. No query, row, payload, navigation target or analytics event changes.

## Mobile presentation

The RaceBook screen (`apps/mobile/app/(app)/race/[id]/racebook.tsx`) renders its last-minute update through `components/racebook/TapeAlertBanner` (orange/white tape strip, 44-point expand toggle) and passes the resolved start time to the plan invitation card; online data loading and writes are unchanged; when the API is unreachable it shows the device copy of the last published RaceBook (see `docs/03-business-rules/mobile-offline-access.md`).

Course weather (2026-11-23, lot 1; inline since 2026-11-25): the RaceBook screen (`apps/mobile/app/(app)/race/[id]/racebook.tsx`) shows a compact display-only MET Norway weather row inside each card of its Course › Ravitos list (start, aid stations, finish) — at the runner's planned passage with a linked plan, over the field's likely passage hours otherwise — and one status/attribution line under the list (`components/course-weather/CourseWeatherPassage.tsx`). It is fed by `GET /api/race-weather`, not by this data; it changes no stored row, no pacing or nutrition calculation and not the organizer weather plan.

The RaceBook Course tab (Tracé, Ravitos, Où encourager) uses `TrailTabs` with `stretch` + `scrollable`: tabs share the full width, the active one on a raised painted wooden plank and the others on flat bare-wood planks. The Livret / plan bib switch is 56 points high (`RACE_WORKSPACE_SWITCH_HEIGHT`).

The RaceBook Course map and profile cards open fullscreen through watch `IconAction`s (labels `racebookMapExpand` / `racebookProfileExpand`) instead of ad-hoc square buttons; behaviour unchanged.

The RaceBook weather alert renders through the same `TapeAlertBanner` as the last-minute message (replacing the former inline alert card); data unchanged.

Sheets and modals use the shared `SheetHeader` (dotted trail handle, slender blaze, title, watch close button) and collapsible groups use `AccordionSection` (km borne with a count or icon, forest trail along the open content); UI only, data and queries unchanged.

The RaceBook Course map and profile cards are drawn without the contour corner (`contours={false}`), keeping the course visuals uncluttered.

The RaceBook hero no longer draws the course contour lines behind its header (the published elevation profile is still shown in the Course tab).

RaceBook onboarding guide cards now float above the RaceBook tab bar, and the post-tour « Envie d'aller plus loin ? » offer waits until the runner has opened two other tabs; « Créer mon plan » is a trail sign on the same creation path as the Course invite. Data and events are unchanged.

The RaceBook onboarding tour only switches tabs, scrolls and highlights zones; it changes no data or visibility. Onboarding refers to the Trail TST seed ids, so they must stay stable.
The services-only conversion-banner presentation change shares the structured editor file but does not change start-wave rows or autosave.

The Livret quick-return header (`apps/mobile/hooks/useQuickReturnHeader.ts`) is presentation-only: the compact hero and Livret/plan switch hide and reappear on scroll, and nothing about the data, publication, partner, offline or analytics contracts described here changes.
