---
title: race_event_updates Table
scope: database
last_verified: 2026-08-31
ai_priority: high
related_files:
  - supabase/migrations/20260629123858_add_race_event_favorites_and_updates.sql
  - supabase/migrations/20260820130930_add_format_targeted_race_updates.sql
  - apps/web/app/api/organizer/events/[id]/updates/route.ts
  - apps/web/app/api/organizer/events/[id]/updates/route.test.ts
  - apps/web/app/api/race-events/[id]/updates/route.ts
  - apps/web/app/api/race-events/[id]/updates/route.test.ts
  - apps/web/lib/push.ts
  - apps/mobile/app/(app)/catalog.tsx
related_tables:
  - race_event_updates
  - race_events
  - race_event_organizers
  - push_notification_events
  - race_event_update_reads
  - races
---

# `race_event_updates`

## Purpose

`race_event_updates` stores manual organizer announcements for one event. Each row is runner-facing history and can also trigger a push notification to users who follow that event.

## Key Concepts

- Manual announcement: organizer chooses when to publish an update.
- Event history: runners can read the latest published updates from the event sheet.
- Push source: one update can fan out one push send using a dedupe key derived from the update id.
- Live visibility: public read access is limited to updates whose parent event is live.

## Columns

| Column | Type | Constraints/default | Purpose |
| --- | --- | --- | --- |
| `id` | `uuid` | primary key, default `gen_random_uuid()` | Update id. |
| `created_at` | `timestamptz` | not null, default UTC `now()` | Publish time. |
| `event_id` | `uuid` | not null, references `race_events(id)` on delete cascade | Event receiving the update. |
| `created_by` | `uuid` | nullable, references `auth.users(id)` on delete set null | Organizer/admin author. |
| `race_id` | `uuid` | nullable, references `races(id)` on delete set null | Optional format concerned by the announcement. |
| `message` | `text` | not null, trimmed length `1..280` | Runner-facing update message. |

## Foreign Keys

- `event_id -> public.race_events(id) on delete cascade`
- `created_by -> auth.users(id) on delete set null`
- `race_id -> public.races(id) on delete set null`

## Indexes

- `race_event_updates_event_created_idx` on `(event_id, created_at desc)`
- partial `race_event_updates_race_created_idx` on `(race_id, created_at desc)` when `race_id` is not null

## RLS Policies

See [../rls-policies.md](../rls-policies.md).

Summary:

- `anon` and `authenticated` can select rows only when the parent `race_events.is_live = true`.
- Direct authenticated inserts/deletes are not allowed. Creation, history reads, and confirmed deletion go through the membership-checked service route and require Pro for the selected edition.

## Business Invariants

- Updates are event-scoped and intentionally manual; normal organizer saves or publish toggles must not auto-create rows here.
- `race_id = null` means the update concerns the whole event. A non-null format must be live and belong to the same event; the route and insert RLS policy both enforce this.
- Push titles use the event name for event-wide updates and the format name for format-specific updates.
- The same message can be reused later, but each send should create a new update row with a new id.
- An active organizer may remove an obsolete or mistaken announcement from the public history after explicit confirmation. Deletion cannot recall push notifications already delivered.
- Push dedupe relies on `organizer-race-update:<updateId>`, so re-sending the same stored update should not produce duplicate device logs.
- Runner-facing history should show only these manual announcements, not every organizer mutation.
- The organizer history response includes the event follower total as a Supabase exact count with a one-row response range; it must not materialize the complete `user_favorite_race_events` audience in the web process.

## Common Queries

Fetch the latest runner-visible updates:

```sql
select id, event_id, race_id, message, created_at
from public.race_event_updates
where event_id = '<event-id>'
order by created_at desc
limit 20;
```

Insert one organizer update:

```sql
insert into public.race_event_updates (event_id, race_id, created_by, message)
values ('<event-id>', null, auth.uid(), 'Retrait des dossards dès 17h.');
```

Organizer deletion includes both `updateId` and `editionId`. The server verifies event membership, the edition/event relationship, Pro, and filters the service-role delete by update and event ids.

## Gotchas

- The catalog onboarding parameter is presentation/navigation state only; organizer-update loading, targeting, visibility, and read behavior stay unchanged.

- Do not edit old runner-facing announcements in place; editing would make delivered push content misleading. The organizer UI may delete a row after confirmation, while historical push-delivery logs remain untouched.
- The mobile event sheet now preloads only a short recent preview from the main catalog query so the sheet can render updates immediately; keep that embedded payload intentionally small.
- The catalog's embedded formats are filtered to live rows. Hiding an edition removes its format actions/Racebooks but does not delete event announcement history; deleting the edition nulls a targeted update's `race_id` through the race foreign key.
- Adding an event favorite from that sheet may close it so the catalog can reveal the newly pinned event and success toast; this must not load, reorder, or mark organizer announcements.
- The mobile update panel belongs after every format action, uses a light-green treatment, and shows only the newest or deep-link-targeted update while collapsed so notification volume cannot bury the plan/Racebook choices.
- Removing the repeated multi-format helper sentence from the surrounding Courses event card changes only card density; it must not move, filter, or mark the organizer-update panel.
- The RaceBook action may warm sponsor data before navigation, but that side request must not delay, reorder, fetch, or mark organizer announcements.
- The dedicated `/api/race-events/[id]/updates` route still owns the fuller history fetch when a runner taps to view more than the preview.
- Public visibility depends on the parent event liveness, not on a separate `published` column here.
- Push delivery metadata belongs in `push_notification_events`, not in this table.
- Runner read state belongs in `race_event_update_reads`; do not mutate an announcement when one runner views it.
- Do not use `racebook_is_live` as the event-announcement visibility rule. Updates stay governed by parent event liveness and their existing optional live-format validation.
- The catalog's organizer-only unpublished Racebook CTA is membership-derived and must not change announcement visibility, preload size, or read behavior.
- Treat a missing or malformed `Content-Range` on the exact-count request as an upstream failure rather than silently displaying an incorrect follower total.

## Related Docs

- [race_events](race-events.md)
- [RLS Policies](../rls-policies.md)
- [Organizer Race Management](../../03-business-rules/organizer-race-management.md)
- [Web App](../../01-architecture/web-app.md)
