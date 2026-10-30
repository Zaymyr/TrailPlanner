---
title: race_supporter_points
scope: database
last_verified: 2026-10-29
ai_priority: high
related_files:
  - supabase/migrations/20261029091807_add_race_supporter_points.sql
  - supabase/migrations/20261029155052_fix_supporter_point_replacement_ordinality.sql
  - supabase/tests/race_supporter_points_checks.sql
  - apps/web/app/api/organizer/races/[id]/supporter-points/route.ts
  - apps/web/app/api/racebook-data/route.ts
  - apps/mobile/lib/racebook.ts
  - apps/mobile/components/racebook/RacebookSupporterPointsSection.tsx
related_tables:
  - races
  - organizer_racebook_module_settings
  - race_supporter_points
---

# race_supporter_points

When the deployed web snapshot predates `supporterPointRows`, mobile may read this table directly; the public-select RLS policy remains responsible for exposing only complete points from an effective module.

## Purpose

Supporter points stay official, public RaceBook content. The user-facing section is named **Suivi coureur** while database and API identifiers keep `supporter_points`. They are not copied into a runner plan or personalized by the Livret plan reflection.

Stores organizer-authored locations where supporters may encourage a runner, provide assistance, or both. The course kilometer and the supporter access location are deliberately separate: `km` positions the runner on the course while the coordinates and Maps URL describe how a supporter reaches the location.

## Contract

| Column | Rule |
|---|---|
| `race_id` | Required format owner; deleted with the format. |
| `name` | Organizer label. Blank values are allowed only for drafts. |
| `km` | Distance from the start. A published point must be between zero and `races.distance_km`. |
| `order_index` | Server-derived order after sorting by kilometer. |
| `encouragement_allowed` / `assistance_allowed` | At least one must be true for public visibility. |
| `access_on_course` | Organizer hint that access uses the GPX coordinate at `km`; the persisted coordinates remain the public routing source of truth. |
| `access_label` | Human-readable address or access label. |
| `latitude` / `longitude` | Optional as a pair in drafts; both are required and range-checked for public visibility. |
| `google_maps_url` | Optional HTTP(S) directions URL. Mobile falls back to the coordinates when absent. |
| `access_note` | Optional free-form access instructions. |
| `plan_url` | Optional HTTP(S) link to an external access plan. |

Draft rows may be incomplete and remain visible through the authenticated organizer route. Direct client reads are restricted by RLS to complete points whose `supporter_points` module is effective. Completeness requires a non-empty name, an in-range kilometer, valid paired coordinates, and at least one permission flag.

Mobile presents permission chips inside the title/distance header, hides `access_label` only when its normalized value repeats `name`, and keeps directions plus the optional external plan as right-aligned icon actions. A distinct access label and access note remain visible beneath the header.

Organizer GET responses normalize nullable editable text and URL fields to empty strings. PUT accepts both those strings and legacy `null` values, so re-saving an existing point cannot fail before the atomic RPC. Mobile keeps directions and an optional external plan as right-aligned, icon-only 44-point actions with explicit accessibility labels.

## Writes and ordering

Clients cannot insert, update, or delete rows directly. `PUT /api/organizer/races/:id/supporter-points` verifies the organizer membership and effective module, then calls the service-only `replace_race_supporter_points` function. The function locks the format, validates the complete submitted collection, preserves submitted identifiers, sorts by kilometer, preserves submitted order when kilometers are equal, assigns zero-based `order_index` values, and replaces the collection atomically. Its JSON input is enumerated with `jsonb_array_elements ... WITH ORDINALITY`, then parsed laterally; PostgreSQL does not allow the previous recordset column-definition form together with ordinality.

## Security

- `anon` and `authenticated` receive `SELECT` only; the public policy still filters incomplete or disabled rows.
- `service_role` owns all mutations and is the only role allowed to execute the replacement function.
- Organizer ownership is checked by the API before the service mutation.
- Analytics must never include addresses, coordinates, access notes, Maps URLs, or external plan URLs.

## Related Docs

- [Organizer RaceBook Module Settings](organizer-racebook-module-settings.md)
- [RLS Policies](../rls-policies.md)
- [Organizer Race Management](../../03-business-rules/organizer-race-management.md)
