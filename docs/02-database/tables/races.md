---
title: races Table
scope: database
last_verified: 2026-08-24
ai_priority: high
related_files:
  - supabase/migrations/20251220120000_add_race_catalog.sql
  - supabase/migrations/20260324000000_refactor_race_catalog_to_races.sql
  - supabase/migrations/20260720120000_add_race_edition_groups.sql
  - supabase/migrations/20260804152041_add_race_event_editions.sql
  - supabase/migrations/20260820135823_add_racebook_publication_control.sql
  - supabase/migrations/20260824114439_add_organizer_import_sessions_and_drafts.sql
  - supabase/migrations/20260824152859_add_relay_course_points.sql
  - supabase/tests/organizer_import_sessions_checks.sql
  - apps/web/app/api/organizer/events/[id]/website-import/route.ts
  - apps/web/lib/public-races.ts
related_tables:
  - races
  - race_events
  - race_event_editions
  - organizer_import_sessions
  - race_aid_stations
  - race_relay_points
  - race_plans
---

# `races`

## Purpose

`races` stores one course format, including its catalog identity, yearly edition membership, course metrics, GPX metadata, Organizer details, and independent Racebook publication state.

## Key Concepts

- Format row: one distance/course under a parent `race_events` event.
- Edition membership: `edition_id` identifies the yearly event edition; `edition_group_id` groups the same format across years.
- Catalog visibility: `is_live` and `is_public` control course discovery.
- Racebook visibility: `racebook_is_live` is independent and requires durable admin approval.
- Import completeness: `data_status` and `missing_required_fields` distinguish incomplete formats from real zero values.

## Columns

The table originates as `race_catalog`; later migrations rename and extend it. Important current groups are:

| Columns | Type | Purpose |
| --- | --- | --- |
| `id`, `slug`, `name` | `uuid`, `text`, `text` | Stable id, unique catalog slug, and display name; import RPCs cap names at 300 characters. |
| `event_id`, `edition_id`, `edition_group_id`, `series_name`, `race_date` | ids/text/date-like | Event, yearly edition, cross-year format series, and format date. |
| `distance_km`, `elevation_gain_m`, `elevation_loss_m` | `numeric` | Course metrics; legacy non-null zero can be an import sentinel only when listed missing. |
| `location_text`, `external_site_url`, `thumbnail_url` | nullable text | Format location and official presentation sources. |
| `gpx_path`, `gpx_hash` | non-null text | Legacy GPX compatibility fields. |
| `gpx_storage_path`, `gpx_sha256` | nullable text | Actual private Storage object and digest; null means no imported GPX. |
| altitude/start/bounds columns | nullable numeric | GPX-derived geographic summary. |
| `organizer_details` | nullable `jsonb` | Progressive format schedule, logistics, equipment override, and notes. |
| `is_live`, `is_public` | boolean | Course catalog state. |
| `racebook_is_live`, approval columns | boolean/timestamps/FK | Runner Racebook state and trusted approval provenance. |
| `participation_mode` | nullable text | `solo`, `relay`, or `solo_and_relay`; null means an unconfirmed historical format. |
| `data_status` | `text` | `draft` or `complete`; existing rows default to `complete`. |
| `missing_required_fields` | `text[]` | Subset of `race_date`, `distance_km`, and `elevation_gain_m`. |

## Foreign Keys

- `event_id -> race_events(id)` is expected by current code; its original migration is not visible.
- `edition_id -> race_event_editions(id) on delete set null`
- `created_by -> auth.users(id)` for private/user-created races.
- `racebook_publication_approved_by -> auth.users(id) on delete set null`
- Child source stations reference `races(id)` with cascade delete.
- Child relay points reference `races(id)` with cascade delete.
- Saved plans reference `races(id)` with `on delete set null`.

## Indexes

Important visible indexes cover slug uniqueness, catalog flags, edition membership, `(event_id, edition_group_id, race_date desc)`, and child station ordering.

## RLS Policies

Existing `races` policies control the whole row, including import status. Organizer import writes use service-role-only `SECURITY INVOKER` RPCs after the trusted server route verifies the admin/session scope. No direct client grant is added for draft fields.

## Business Invariants

- `data_status = complete` requires an empty `missing_required_fields` array.
- A draft cannot have `is_live` or `racebook_is_live` enabled.
- Unknown imported distance/D+ use zero only while the corresponding snake_case field is listed missing; an explicitly known flat D+ may be zero without being missing.
- A confirmed new import format inherits the edition start date, uses legacy GPX placeholders without creating a file, and starts missing distance and D+.
- A grounded named format from an event/format/regulation source can be confirmed even when its other claims are missing. Additional registration, results/archive, other, or unusable URLs cannot create the row.
- Completing an imported draft sets `is_live = true`, leaves `is_public` unchanged, and keeps `racebook_is_live = false`.
- The Organizer format PATCH route and GPX upload route recompute these markers too, so a draft completed outside the import review cannot remain stuck on sentinel values.
- Racebook publication remains a separate reviewed action even when course data becomes complete.
- Relay legs are derived from start, ordered relay points, and finish; they are not separate race rows.

## Common Queries

Find incomplete formats for an edition:

```sql
select id, name, missing_required_fields
from public.races
where edition_id = :edition_id
  and data_status = 'draft'
order by name;
```

Select publishable course formats:

```sql
select id, name, distance_km, elevation_gain_m
from public.races
where is_live = true
  and is_public = true
  and data_status = 'complete';
```

## Gotchas

- Do not treat zero D+ as unknown without checking `missing_required_fields`.
- `gpx_path` may contain a deterministic placeholder while `gpx_storage_path` remains null; never fetch the placeholder as a Storage object.
- Do not set a draft live. The database constraint rejects both course and Racebook visibility.
- Do not use `edition_group_id` as yearly edition membership; use `edition_id`.
- Do not derive Racebook visibility from catalog completion or `is_live`.
- Do not infer relay participation from ravitos; use `participation_mode` and `race_relay_points`.

## Related Docs

- [organizer_import_sessions](organizer-import-sessions.md)
- [race_events](race-events.md)
- [race_event_editions](race-event-editions.md)
- [race_aid_stations](race-aid-stations.md)
- [race_relay_points](race-relay-points.md)
- [Schema Overview](../schema-overview.md)
