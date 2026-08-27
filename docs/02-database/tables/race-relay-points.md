---
title: race_relay_points Table
scope: database
last_verified: 2026-08-27
ai_priority: high
related_files:
  - supabase/migrations/20260824152859_add_relay_course_points.sql
  - apps/web/app/api/organizer/races/[id]/relay-points/route.ts
  - apps/web/app/api/organizer/races/[id]/relay-points/route.test.ts
  - apps/mobile/lib/racebook.ts
  - apps/mobile/app/(app)/race/[id]/racebook.tsx
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
- Relay cards remain isolated from the event-level `Services` tab, the flag-filtered optional content in `Accès`, its category-card presentation, and the Racebook identity card's compact website/emergency actions, flexible icon-and-separator metadata row, participation badges, and emphasized race-day row. Mixed formats show separate `Solo` and `Relais` badges in the metadata row.

## Racebook Identity Presentation

Relay participation badges stay in the compact metadata row beside the course-date and location information. The identity card does not display the event date range or the emergency phone number; the number remains available only through the localized call action.

## Columns

| Column | Type | Purpose |
| --- | --- | --- |
| `id`, `race_id` | `uuid` | Stable id and cascade-delete parent format. |
| `race_aid_station_id` | nullable `uuid` | Optional ravito location; set null when the ravito is deleted. |
| `name`, `km` | text/numeric | Non-empty runner label and positive course position. |
| `handover_time`, `cutoff_time`, `notes` | nullable text | Optional organizer instructions. |
| `order_index`, `created_at` | integer/timestamptz | Display order and creation time. |

## RLS Policies

- Public reads require the parent race to be public, course-live, and Racebook-live.
- Owners, active event organizers, and trusted `app_metadata` admins can read managed rows, which lets the mobile organizer preview include relay legs before Racebook publication.
- Mutations are service-role-only; Organizer routes enforce event membership first.

## Business Invariants

- Points are positive and strictly before the parent race distance.
- A linked ravito and every submitted existing point id must belong to the same race.
- Switching `races.participation_mode` to `solo` removes all relay points.
- The Organizer endpoint distance-sorts and replaces the ordered collection.

## Gotchas

- A handover is not necessarily a ravito, and a ravito is not necessarily a handover.
- Do not copy relay points into `plan_aid_stations` or nutrition calculations in this first version.
- FK behavior does not synchronize copied location text or distance; the Organizer editor does so before save.

## Related Docs

- [races](races.md)
- [race_aid_stations](race-aid-stations.md)
- [Relationships](../relationships.md)
- [Organizer Race Management](../../03-business-rules/organizer-race-management.md)
