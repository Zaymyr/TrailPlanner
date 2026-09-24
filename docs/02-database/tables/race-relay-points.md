---
title: race_relay_points Table
scope: database
last_verified: 2026-09-24
ai_priority: high
related_files:
  - supabase/migrations/20260824152859_add_relay_course_points.sql
  - apps/web/app/api/organizer/races/[id]/relay-points/route.ts
  - apps/web/app/api/organizer/races/[id]/relay-points/route.test.ts
  - supabase/migrations/20260910081049_add_atomic_organizer_course_collections.sql
  - supabase/tests/organizer_atomic_course_collections_checks.sql
  - apps/mobile/lib/racebook.ts
  - apps/mobile/lib/fetchWithTimeout.ts
  - apps/mobile/app/(app)/race/[id]/racebook.tsx
  - apps/mobile/components/racebook/RacebookStructuredCourseSections.tsx
related_tables:
  - race_relay_points
  - races
  - race_aid_stations
  - race_event_organizers
---

# `race_relay_points`

## Purpose

Stores ordered relay handover points. This runner-facing Racebook information remains separate from nutrition and saved-plan aid stations.

## Key Concepts

- A point may stand alone or reference a source `race_aid_stations` row.
- Copied `name` and `km` values form the durable relay snapshot; deleting a linked ravito only clears the optional link.
- Legs are derived from start, ordered points, and finish rather than stored as rows, then rendered only in the mobile Racebook `Course` tab's conditional `Relais` sub-tab.
- The route still derives those legs; `RacebookStructuredCourseSections` only renders the typed result and never feeds it into nutrition or persistence.
- Relay cards remain isolated from the event-level `Services` tab, flag-filtered optional content, route-local transport expansion state in `Accès`, and the single-open ravito accordion state. The image-backed identity hero may show a `Relais` participation badge, but it does not change relay rows or derived legs.

## Racebook Identity Presentation

Relay participation badges stay in the identity hero beside the course-date, location and format metrics. The hero does not display the emergency phone number; the number remains available only through the localized call action in the neutral details card.

The compact runner-progress and unified sponsor loading composition is presentation-only and remains independent from relay-point reads and derived legs.

The stable post-load sponsor surface and contextual sponsor placements likewise remain independent from relay ordering and the conditional `Relais` sub-tab.

The two-line clamp for bib-pickup address links likewise remains independent from relay ordering, rows, and derived legs.

Disabling the format access override hides saved runner information only; it does not change relay rows or the derived `Relais` view.

The published edition accent may recolor route/profile graphics and their lightly tinted cards, while primary may recolor the active `Relais` tab. Neither value changes relay rows, ordering, semantic cutoff states, or derived-leg calculations.

Selecting the conditional `Relais` sub-tab is recorded as RaceBook product engagement with the parent race id. Relay-point payloads and persistence remain unchanged.

## Columns

| Column | Type | Purpose |
| --- | --- | --- |
| `id`, `race_id` | `uuid` | Stable id and cascade-delete parent format. |
| `race_aid_station_id` | nullable `uuid` | Optional ravito location; set null when the ravito is deleted. |
| `name`, `km` | text/numeric | Non-empty runner label and positive course position. |
| `handover_time`, `cutoff_time`, `notes` | nullable text | Optional organizer instructions. |
| `order_index`, `created_at` | integer/timestamptz | Display order and creation time. |

## RLS Policies

- Public reads require the parent race to be public, course-live, Racebook-live, and attached to a Pro edition.
- Owners, active event organizers, and trusted `app_metadata` admins can read managed rows, which lets the mobile organizer preview include relay legs before Racebook publication.
- Mutations are service-role-only; Organizer routes enforce event membership and `relay.manage` (Pro).

## Business Invariants

- Points are positive and strictly before the parent race distance.
- A linked ravito and every submitted existing point id must belong to the same race.
- Switching `races.participation_mode` to `solo` removes all relay points.
- The Organizer endpoint distance-sorts and replaces the ordered collection.

## Gotchas

- The 2026-09-14 iOS accessibility pass changes only mobile input, gesture, and motion presentation; relay-point rows, ordering, derived legs, and nutrition separation remain unchanged.
- Organizer relay replacement is a single parent-race-locked transaction. Keep race/station ownership and distance validation inside the database function so failures cannot leave a partial sequence.

- Relay writes require Signature and an active `relay` format module; public RLS masks stored points when the module is inactive or locked.

- RaceBook onboarding is presentation-only and leaves relay-point loading and the conditional Relais tab unchanged.
- Holding initial RaceBook progress for sponsor preparation does not delay, cache, or change the separate relay-point read contract.
- Published relay points now also travel in the consolidated RaceBook CDN snapshot; a successful replacement invalidates the parent race tag while preserving the same row/RLS contract.
- RaceBook tab analytics may report that the Relay view was selected, but must not emit relay notes or other organizer-authored content as analytics properties.
- Do not use organizer branding colors to reinterpret relay cutoff or warning semantics.
- Published primary surfaces may decorate relay segment cards, but handover/cutoff meaning, ordering, and warning treatment remain unchanged.
- Solo/Relais is rendered as icon-led expanded-hero metadata rather than badges and disappears with the detailed metadata when the hero compacts; emergency/social actions remain visible independently. The conditional Relais view remains a Course sub-tab and still depends on effective module visibility plus published relay points.
- Returning to Courses dismisses the active RaceBook rather than exposing an earlier format; relay rows and the conditional Relais tab remain unchanged.

- A handover is not necessarily a ravito, and a ravito is not necessarily a handover.
- Do not copy relay points into `plan_aid_stations` or nutrition calculations in this first version.
- FK behavior does not synchronize copied location text or distance; the Organizer editor does so before save.

## Related Docs

Masking a format from the private RaceBook demo suppresses its complete mobile RaceBook entry point without deleting relay points.

Derived relay cards now use published accent surfaces and contrast-safe accent text. This remains presentation-only and independent from the runner-owned Material checklist.

- [races](races.md)
- [race_aid_stations](race-aid-stations.md)
- [Relationships](../relationships.md)
- [Organizer Race Management](../../03-business-rules/organizer-race-management.md)
