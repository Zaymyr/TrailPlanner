---
title: racebook_gear_checks Table
scope: database

last_verified: 2026-11-09

ai_priority: high
related_files:
  - supabase/migrations/20260924140119_add_racebook_gear_checks.sql
  - supabase/tests/racebook_gear_checks.sql
  - apps/mobile/lib/racebookGearChecklist.ts
  - apps/mobile/components/racebook/RacebookGearSection.tsx
  - apps/mobile/app/(app)/race/[id]/racebook.tsx
  - apps/mobile/lib/racebookGearAnalytics.ts
  - apps/mobile/lib/racebookGearAnalytics.test.ts
  - apps/mobile/lib/racebookGearItemKey.ts
  - apps/mobile/lib/racebookGearItemKey.test.ts
  - scripts/backfill-racebook-gear-state-posthog.mjs
related_tables:
  - racebook_gear_checks
  - user_profiles
  - races
---

# `racebook_gear_checks`

The shared RaceBook screen now also renders additive bib-pickup conditions. Material checklist keys, optimistic persistence, account/race ownership, and organizer-equipment immutability remain unchanged.

The header-attached workspace switch does not read or mutate checklist rows.

Chronological cutoff resolution does not read or mutate checklist rows.

The race-workspace header toolbar/footer layout (lot 10) does not read or mutate checklist rows.

The shared RaceBook identity header and finish-cutoff placement do not read or mutate checklist rows; equipment completion remains independent owner state.

La checklist conserve ses clés et mutations owner-scoped. Une ligne prête reste lisible sans texte barré et les cases utilisent la palette Pace Yourself. La carte Decathlon se place après la checklist et n'affiche plus de nombre, car le contrat ne distingue pas de façon fiable les objets achetables ; son ouverture ne crée ni ne modifie une coche.

RaceBook personal passage-time interpolation does not affect the independent gear-check persistence flow.

> CTA scope: the RaceBook plan CTA resolves a runner-owned plan independently of the gear checklist. It never reads or mutates `racebook_gear_checks`.

> Terminologie : les textes français destinés aux utilisateurs emploient **Livret coureur** et les textes anglais **Race Book**. Les identifiants techniques stables — routes, événements analytics, objets de base de données et valeurs historiques — conservent `racebook`.

## Purpose

`racebook_gear_checks` stores the runner's per-format RaceBook equipment checklist. A signed-in account sees the same checked items on every device using that account.

The Livret may read this durable completion when no linked plan is available to offer creation, but it never copies completion into `race_plans.planner_values` or treats a source-revision acknowledgement as an equipment update. A linked plan instead contributes its duration and pace to the course identity metrics; it does not restore a separate equipment summary card.

## Columns

| Column | Type | Constraints/default | Purpose |
| --- | --- | --- | --- |
| `user_id` | `uuid` | primary-key part, references `user_profiles(user_id)` on delete cascade | Checklist owner. |
| `race_id` | `uuid` | primary-key part, references `races(id)` on delete cascade | Exact course format whose equipment is being prepared. |
| `item_key` | `text` | primary-key part, 1–320 characters | Stable organizer item id, or deterministic group-and-label fallback. |
| `checked_at` | `timestamptz` | not null, UTC `now()` | First persisted check time. |

## RLS Policies

- `anon` has no table grant.
- `authenticated` may select, insert, and delete only rows whose `user_id` equals `auth.uid()`.
- Rows are append/remove state; authenticated clients receive no update grant or policy.
- `service_role` retains explicit full access for administration and cleanup.

## Business Invariants

- Preview scrolling and paywall CTAs do not mutate a gear checklist.

- Catalog plan CTAs, preview scrolling, and the RaceBook/Mon plan switch do not mutate a gear check. Gear rows remain a deliberate owner checklist interaction only.

- State is isolated by both user and exact `race_id`; two formats of one event never share completion.
- Organizer equipment changes do not rewrite runner rows. The UI counts only keys that still match currently published items, so removed items become harmless dormant rows.
- Items with a persisted organizer id use it. Legacy items without an id use a deterministic normalized-label key scoped by required/recommended/weather group.
- Toggling is optimistic in the app and rolls back visibly if the owner-scoped database write fails.
- After a confirmed insert/delete, mobile emits `racebook gear item toggled`. The event includes the bounded published item label/id, required/recommended/weather group, weather context, and checked state, but never `item_key`, notes, or total checklist state. Failed writes emit nothing.
- After a successful non-empty load, and after persisted changes settle, mobile emits `racebook gear item state synced` once per currently published item. This bounded snapshot distinguishes checked from missing items only for runners who started the checklist; a plain RaceBook open with no saved or successful interaction state emits no missing-item snapshot.
- Leaving a RaceBook replaces it with Courses instead of another previously opened format; persisted checks remain keyed by account and exact `race_id` across navigation.
- Compact sponsor rows and the Ravitos endpoint timing/spacing presentation do not read or mutate equipment-check rows.
- Fullscreen route/profile presentation and tappable ravito points do not read or mutate equipment-check rows.
- Global Booking and Decathlon destinations are read independently through the web API. Decathlon renders after the checklist with generic, non-numeric copy because the source does not classify purchasable items. Opening either partner action does not create, complete, or mutate a personal equipment-check row.

When a saved plan exists, the Livret shows planned duration, pace and departure in the identity hero; matched ravito passage/segment timing and late-cutoff disclosure stay separate from equipment state. Warm state is accepted only for the exact plan id, and none of these display/navigation values changes a checked row.

Trail signature (2026-11-09): the runner RaceBook screen adds presentation only: faint contour lines in the hero derived from the already-loaded course elevation profile (drawn only when the organizer publishes it through `gpxDisplay.showElevationProfile`) and a ridge-line divider inside the course essentials card. It reads and writes no row of this domain and changes no query, payload or analytics event.

Trail signature iteration (2026-11-11): runner presentation only. In-page RaceBook Course, Profile and plan view selectors become trail tabs, map/transport links and the catalog format RaceBook action become signpost buttons, catalog format distance/D+ read as cotes, tab-bar blazes move to the left of the selected icon, the hero contours are lightened and the elevation profile gains a decorative summit flag and iso-line echo. No query, row, payload, navigation target or analytics event changes.

## Related Docs

This table remains the source of truth for current checked state. PostHog organizer rankings use the latest observed state per person, race, and published analytics item inside the selected reporting window; they exclude runners who never started the checklist and must not be presented as a live table snapshot. The marker-guarded `racebook_gear_state_2026_09_28` import seeded checked and missing states only for users represented by existing rows.

Opening supporter directions or an external access plan does not read or mutate personal equipment checks. Both datasets remain owner- and purpose-specific.


- [Schema Overview](../schema-overview.md)
- [Relationships](../relationships.md)
- [RLS Policies](../rls-policies.md)
- [Mobile App](../../01-architecture/mobile-app.md)

Checklist progress remains visually neutral until every required item is checked, then becomes successful. This state styling does not alter row ownership, checked persistence, or analytics snapshots.

Versioned RaceBook publication changes only the source equipment payload. Owner-scoped checked rows remain live user state and are never copied into, restored from, or exposed through a public publication.

Progressive plan disclosure (2026-11-09): the plan is optional in the RaceBook. Runners without an owned plan for the format see no `Livret officiel | Mon plan` switch, no `Temps prévu`/`Allure` hero metrics and an unattached hero; the only plan entry is the discreet `RacebookPlanInviteCard` at the end of the Course route/ravitos sub-tabs (hidden in guided RaceBook onboarding, for past races and when D+ is unknown). Once a plan exists, the switch (labelled `Mon plan`) and plan metrics appear and the plan keeps enriching the Livret. This is runner presentation only: it reads and writes no row of this domain.

RaceBook polish (2026-11-09): the runner hero keeps the format/event thumbnail but renders it blurred (`blurRadius` 24) under a 90% organizer-primary veil, so no artwork text is readable behind the identity, omits the default `Solo` participation label, appends a `J-N`/`Aujourd'hui` countdown to the date line (hidden after race day), and moves its expanded block up with the collapse so titles never overlap and metrics are never clipped. Runner wording was simplified (`Où encourager`, `Barrière horaire`, `Sac d'allègement`, `Nourriture`, `Relais {n}`, weather-alert and partial-route sentences). Access transport notes turn pasted URLs into labelled buttons (`Réserver ma navette` / `Ouvrir le lien`) and bib pickup addresses without an organizer maps link fall back to a Google Maps search (`lib/racebookTextLinks.ts`). Profile cumulative tiles show `—` until the runner touches the curve. This is runner presentation only: no row, contract or tracking of this domain changes.

Publication checks and partner slots (2026-11-09): pre-publication checks and the Matériel/hébergement partner slots read the built snapshot and their own table only. They do not read, write or change this domain's rows or contracts.
