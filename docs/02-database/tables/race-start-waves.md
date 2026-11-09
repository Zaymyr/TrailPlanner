---
title: race_start_waves Table
scope: database

last_verified: 2026-11-09

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
