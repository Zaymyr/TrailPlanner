---
title: race_events Table
scope: database
last_verified: 2026-06-18
ai_priority: high
related_files:
  - supabase/migrations/20260331000000_add_thumbnail_to_race_events.sql
  - supabase/migrations/20260528120000_add_organizer_portal.sql
  - apps/web/app/api/race-catalog/route.ts
  - apps/web/app/api/admin/race-catalog/route.ts
  - apps/web/app/api/admin/race-events/[id]/route.ts
  - apps/web/app/api/organizer/events/[id]/route.ts
  - apps/web/app/api/organizer/claims/route.ts
  - apps/web/app/api/admin/organizer-claims/route.ts
  - apps/mobile/app/(app)/catalog.tsx
  - apps/mobile/components/race/RaceEventSummaryCard.tsx
related_tables:
  - race_events
  - race_event_claims
  - race_event_organizers
  - races
---

# `race_events`

## Purpose

`race_events` is used by current code as a grouping table for races that share an event, location, date, image, and live status. The visible migrations in this repo do not include its create-table migration.

## Key Concepts

- Event grouping: multiple `races` can belong to one event.
- Event image: `thumbnail_url` can be used as a shared event thumbnail.
- Event liveness: mobile and onboarding filter on event/race live state.
- Draft organizer event: a non-live event row created when an organizer claims a missing race.
- Missing provenance: table creation must be verified outside the visible migrations.
- Organizer claim target: organizers claim an event, then manage all formats under it after admin approval.

## Columns Observed From Code

| Column | Type | Constraints/default | Purpose |
| --- | --- | --- | --- |
| `id` | `uuid` | inferred primary key | Event id used by `races.event_id`. |
| `name` | `text` | required by API schemas | Event display name. |
| `location` | `text` | nullable in API schemas | Event location. |
| `race_date` | `text` or date-like | nullable in API schemas | Event date used for sorting/filtering/display. |
| `thumbnail_url` | `text` | nullable, added by migration | Shared event thumbnail URL. |
| `is_live` | `boolean` | nullable/boolean in API schemas | Visibility flag used by onboarding/profile routes. |

<!-- TODO: verify with maintainer: confirm exact race_events column types, constraints, indexes, and RLS policies in the live Supabase project. -->

## Foreign Keys

Current code expects `races.event_id` to reference `race_events.id`, but the visible migrations do not show the column creation or FK declaration.

<!-- CONFLICT: apps/web and apps/mobile query races.event_id and race_events joins; visible migrations do not create races.event_id or race_events. -->

## Indexes

No index creation for `race_events` was found in visible migrations. Admin and mobile code query by name/date, so the live schema may have indexes not represented here.

## RLS Policies

No `race_events` RLS policy migration was found in this repo.

Because API routes use service role for event writes, client/mobile read access must be verified against the live policies before changing catalog access.

Organizer portal writes also go through web service routes after checking `race_event_organizers`. The organizer portal migration adds RLS for claims and memberships, but it does not add a `race_events` table policy.

## Business Invariants

- Event rows are created by admin catalog import routes when `event_name` is supplied.
- Event rows can also be created by the organizer claim route for missing events; those rows are inserted with `is_live = false`.
- Race rows can refer to an existing or newly created event.
- Approved organizer membership is event-scoped and grants access to all race formats linked by `races.event_id`.
- Mobile catalog groups event races and also displays standalone races with no event.
- Mobile catalog and onboarding share `RaceEventSummaryCard` for event-row presentation; the component consumes the same event/race shape and should not add database assumptions.
- Mobile catalog root actions are presentation-only and do not change the observed event grouping query shape.
- Event thumbnails can be copied from the first related race by `20260331000000_add_thumbnail_to_race_events.sql`.

## Common Queries

Observed admin/mobile query shape:

```sql
select id, name, location, race_date, thumbnail_url, is_live
from public.race_events
order by name asc;
```

Observed race join shape:

```sql
select id, name, event_id, race_events(id, name, location, race_date, thumbnail_url, is_live)
from public.races;
```

## Gotchas

- Treat this table as live-schema-dependent until its create migration is found.
- Do not add docs that claim exact constraints for `race_events` without verification.
- Code paths are real even though migration provenance is incomplete.
- Keep shared mobile event-row UI changes separate from race event query or schema changes.
- Do not use `races.created_by` to represent event organizer ownership for claimed public events.
- Manual organizer draft events are not public catalog rows until their `is_live` state is explicitly changed.

## Related Docs

- [Schema Overview](../schema-overview.md)
- [Relationships](../relationships.md)
- [GPX Import](../../03-business-rules/gpx-import.md)
- [Mobile App](../../01-architecture/mobile-app.md)
