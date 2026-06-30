---
title: race_event_updates Table
scope: database
last_verified: 2026-06-29
ai_priority: high
related_files:
  - supabase/migrations/20260629123858_add_race_event_favorites_and_updates.sql
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
| `message` | `text` | not null, trimmed length `1..280` | Runner-facing update message. |

## Foreign Keys

- `event_id -> public.race_events(id) on delete cascade`
- `created_by -> auth.users(id) on delete set null`

## Indexes

- `race_event_updates_event_created_idx` on `(event_id, created_at desc)`

## RLS Policies

See [../rls-policies.md](../rls-policies.md).

Summary:

- `anon` and `authenticated` can select rows only when the parent `race_events.is_live = true`.
- Authenticated organizers and admins can insert rows for events they actively manage.
- Public writes are not allowed.

## Business Invariants

- Updates are event-scoped and intentionally manual; normal organizer saves or publish toggles must not auto-create rows here.
- The same message can be reused later, but each send should create a new update row with a new id.
- Push dedupe relies on `organizer-race-update:<updateId>`, so re-sending the same stored update should not produce duplicate device logs.
- Runner-facing history should show only these manual announcements, not every organizer mutation.

## Common Queries

Fetch the latest runner-visible updates:

```sql
select id, event_id, message, created_at
from public.race_event_updates
where event_id = '<event-id>'
order by created_at desc
limit 20;
```

Insert one organizer update:

```sql
insert into public.race_event_updates (event_id, created_by, message)
values ('<event-id>', auth.uid(), 'Retrait des dossards dès 17h.');
```

## Gotchas

- Keep this table append-only in practice; editing old runner-facing announcements would make push logs misleading.
- The mobile event sheet now preloads only a short recent preview from the main catalog query so the sheet can render updates immediately; keep that embedded payload intentionally small.
- The dedicated `/api/race-events/[id]/updates` route still owns the fuller history fetch when a runner taps to view more than the preview.
- Public visibility depends on the parent event liveness, not on a separate `published` column here.
- Push delivery metadata belongs in `push_notification_events`, not in this table.

## Related Docs

- [race_events](race-events.md)
- [RLS Policies](../rls-policies.md)
- [Organizer Race Management](../../03-business-rules/organizer-race-management.md)
- [Web App](../../01-architecture/web-app.md)
