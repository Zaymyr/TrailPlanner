---
title: race_event_editions
scope: database
last_verified: 2026-08-19
ai_priority: high
related_files:
  - supabase/migrations/20260804152041_add_race_event_editions.sql
  - apps/web/app/api/organizer/events/route.ts
  - apps/web/app/api/organizer/events/[id]/route.ts
  - apps/web/app/api/organizer/events/[id]/website-import/route.ts
  - apps/web/app/api/organizer/edition-requests/route.ts
  - apps/web/app/api/organizer/races/route.ts
  - apps/web/app/api/organizer/races/[id]/route.ts
  - apps/web/lib/organizer-publication.ts
related_tables:
  - race_event_editions
  - race_events
  - races
  - race_event_publication_requests
---

# race_event_editions

## Purpose

`race_event_editions` stores the canonical yearly date range for an organizer-managed event. It removes the ambiguity between the event date, the edition year, and dates repeated on each format.

## Key Concepts

- One event can have many yearly editions.
- One edition owns one inclusive start/end date range.
- At most one edition is current per event; publication and legacy event-date reads target it.
- A format belongs to an edition through `races.edition_id`. Its `race_date` is only a format-specific start date and must remain inside the edition range.
- `races.edition_group_id` still groups the same format series across years; it is independent from `edition_id`.

## Columns

| Column | Type | Rules | Meaning |
| --- | --- | --- | --- |
| `id` | `uuid` | primary key | Edition identifier. |
| `created_at`, `updated_at` | `timestamptz` | non-null | Audit timestamps. |
| `event_id` | `uuid` | non-null FK | Parent event. |
| `edition_year` | `smallint` | unique per event, 2000–2100 | Year of `start_date`. |
| `start_date` | `date` | non-null | Canonical first day of the edition. |
| `end_date` | `date` | non-null, not before start | Canonical last day of the edition. |
| `is_current` | `boolean` | one true row per event at most | Edition mirrored to legacy event date fields and used for publication. |

`races.edition_id` is nullable only for legacy or undated rows. New organizer formats must provide it.

## Foreign Keys

- `race_event_editions.event_id -> race_events(id) on delete cascade`
- `races.edition_id -> race_event_editions(id) on delete set null`

Deleting an event removes its editions. Deleting an edition detaches formats without deleting them.

## Indexes

- Unique `(event_id, edition_year)` prevents duplicate yearly editions.
- Partial unique `(event_id) where is_current` allows at most one current edition.
- `(event_id, start_date desc)` supports organizer year selection.
- `races(edition_id)` supports edition-scoped format reads and publication.

## RLS Policies

RLS is enabled and direct `anon` / `authenticated` privileges are revoked. Only `service_role` receives table privileges. Organizer routes must first validate active `race_event_organizers` membership and then perform edition writes server-side.

## Business Invariants

- `edition_year` equals the year of `start_date`.
- `end_date >= start_date`.
- A format date edited through organizer routes must lie inside its edition range.
- Database triggers also reject edition range updates that exclude an attached format, event/edition mismatches, and out-of-range format writes from any service path.
- Changing the current edition or its range mirrors `start_date` to `race_events.race_date` and `end_date` to `race_events.organizer_details.dateRange.endDate` for legacy catalog/mobile consumers.
- Publication readiness and approval consider only the current edition and its attached formats.
- Organizer creation may make the new current edition empty, or optionally clone the selected source edition's formats into it. An empty edition remains a valid canonical date range but cannot pass publication readiness until it has a complete format.

## Common Queries

```sql
select id, edition_year, start_date, end_date, is_current
from race_event_editions
where event_id = :event_id
order by start_date desc;
```

```sql
select r.*
from races r
join race_event_editions ree on ree.id = r.edition_id
where ree.event_id = :event_id
  and ree.is_current;
```

## Gotchas

- Do not use `race_events.race_date` as the canonical organizer edition date; it is a compatibility mirror.
- Do not infer edition membership only from the year of `races.race_date` in new writes; persist `races.edition_id`.
- Do not replace `races.edition_group_id` with `edition_id`: one groups a format series across years, the other groups all formats in one event year.
- A multi-day edition may end in the following calendar year; only its start year defines `edition_year`.
- Do not require a source edition lookup when the organizer explicitly disables duplication; source formats are needed only for the cloning branch.

## Related Docs

- [race_events](race-events.md)
- [Database Relationships](../relationships.md)
- [Organizer Race Management](../../03-business-rules/organizer-race-management.md)
- [RLS Policies](../rls-policies.md)
