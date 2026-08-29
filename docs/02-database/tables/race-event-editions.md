---
title: race_event_editions
scope: database
last_verified: 2026-08-29
ai_priority: high
related_files:
  - supabase/migrations/20260820164141_target_racebook_publication_requests.sql
  - supabase/migrations/20260804152041_add_race_event_editions.sql
  - supabase/migrations/20260820135823_add_racebook_publication_control.sql
  - supabase/migrations/20260824114439_add_organizer_import_sessions_and_drafts.sql
  - supabase/migrations/20260824164101_manage_organizer_edition_visibility_and_deletion.sql
  - supabase/migrations/20260824170652_restrict_delete_race_event_edition_rpc.sql
  - supabase/migrations/20260829080943_update_amazeaunes_2026_final_roadbook.sql
  - supabase/tests/organizer_import_sessions_checks.sql
  - apps/web/app/api/organizer/events/route.ts
  - apps/web/app/api/organizer/events/[id]/route.ts
  - apps/web/app/api/organizer/events/[id]/website-import/route.ts
  - apps/web/app/api/organizer/edition-requests/route.ts
  - apps/web/app/api/organizer/editions/[id]/route.ts
  - apps/web/app/api/organizer/editions/[id]/route.test.ts
  - apps/web/app/api/organizer/races/route.ts
  - apps/web/app/api/organizer/races/[id]/route.ts
  - apps/web/lib/organizer-publication.ts
related_tables:
  - race_event_editions
  - race_events
  - races
  - race_event_publication_requests
  - organizer_import_sessions
---

# race_event_editions

## Purpose

`race_event_editions` stores the canonical yearly date range for an organizer-managed event. It removes the ambiguity between the event date, the edition year, and dates repeated on each format.

## Key Concepts

- One event can have many yearly editions.
- One edition owns one inclusive start/end date range.
- At most one edition is current per event; legacy event-date reads and the admin event-wide switch target it, while a format-specific publication request targets the requested race's own edition.
- Each edition has an independent catalog visibility state. Hiding one edition hides every attached course format and Racebook without hiding other years of the same event.
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
| `is_current` | `boolean` | one true row per event at most | Edition mirrored to legacy event date fields and used by event-wide admin publication controls. |
| `is_visible` | `boolean` | non-null, default `true` | Whether complete attached formats may remain visible in course discovery. |

`races.edition_id` is nullable only for legacy or undated rows. New organizer formats must provide it.

## Foreign Keys

- `race_event_editions.event_id -> race_events(id) on delete cascade`
- `races.edition_id -> race_event_editions(id) on delete cascade`

Deleting an event removes its editions. Deleting an edition removes its formats and their cascading source children; saved plans keep their snapshots because `race_plans.race_id` becomes null. The service-only deletion RPC rejects deletion of the event's only edition and promotes the newest remaining edition when the deleted row was current.

## Indexes

- Unique `(event_id, edition_year)` prevents duplicate yearly editions.
- Partial unique `(event_id) where is_current` allows at most one current edition.
- `(event_id, start_date desc)` supports organizer year selection.
- `races(edition_id)` supports edition-scoped format reads and publication.

## RLS Policies

RLS is enabled and direct `anon` / `authenticated` privileges are revoked. Only `service_role` receives table privileges and execute access to the invoker-security deletion RPC. Organizer routes must first validate active `race_event_organizers` membership and then perform edition writes server-side.

## Business Invariants

- `edition_year` equals the year of `start_date`.
- `end_date >= start_date`.
- A format date edited through organizer routes must lie inside its edition range.
- Database triggers also reject edition range updates that exclude an attached format, event/edition mismatches, and out-of-range format writes from any service path.
- Changing the current edition or its range mirrors `start_date` to `race_events.race_date` and `end_date` to `race_events.organizer_details.dateRange.endDate` for legacy catalog/mobile consumers.
- Data corrections that move every attached format outside the old range must first widen the edition, update the format dates, then narrow the canonical range. The Les Amaz’Eaunes 2026 roadbook migration uses this guarded sequence to move the edition from 11–13 September to the confirmed single race day on 13 September.
- Format-specific publication readiness and first approval follow `race_event_publication_requests.race_id -> races.edition_id`, even when that edition is not current.
- Organizer creation may make the new current edition empty, or optionally clone the selected source edition's formats into it. An empty edition remains a valid canonical date range but cannot pass publication readiness until it has a complete format.
- Editions start visible by default. Setting `is_visible = false` forces `is_live = false` and `racebook_is_live = false` on every attached format, including later writes. Setting it true restores catalog visibility only for complete formats and deliberately leaves Racebooks hidden for explicit republication.
- `delete_race_event_edition(uuid)` is a `SECURITY INVOKER`, service-role-only transaction boundary. It cascades the edition's formats, import sessions, and targeted publication requests, then returns the replacement edition selected by the organizer UI.
- Project default ACLs grant function execution directly to API roles, so the follow-up repair migration explicitly revokes `anon` and `authenticated` from all three new functions; revoking only `PUBLIC` is insufficient in this project.
- An admin-only website-import preview that falls back to supplied roadbook documents remains review-only; LLM reconciliation can recommend format matches but cannot create or update an edition. Apply requires an unexpired signed proposal snapshot and an explicit target format inside the selected edition. Those 25 MB-per-file temporary Storage objects are deleted after extraction, and an edition changes only after explicit admin confirmation.
- Two-pass import sessions reference one edition and verify it belongs to the selected event. New confirmed format drafts inherit this edition's `start_date`; field apply cannot target a format in another edition.
- Dates extracted from classified additional URLs or documents remain review evidence. Source intelligence cannot change `edition_id`, and registration/result dates are not promoted into edition claims.

## Common Queries

```sql
select id, edition_year, start_date, end_date, is_current, is_visible
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
- A cloned/new edition may be course-visible while every attached Racebook is hidden. Do not derive Racebook visibility from edition currentness or `races.is_live`.
- Do not detach formats when deleting an edition. The cascade is intentional so no yearless organizer course survives a confirmed edition deletion.
- Do not republish Racebooks when an edition becomes visible again; hiding is destructive to their live flag, not to their durable approval timestamp.
- Do not infer import scope from a year string. Use the session's validated `edition_id`, and reject expired sessions before confirming or applying fields.

## Related Docs

- [race_events](race-events.md)
- [Database Relationships](../relationships.md)
- [Organizer Race Management](../../03-business-rules/organizer-race-management.md)
- [RLS Policies](../rls-policies.md)
