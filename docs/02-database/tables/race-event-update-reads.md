---
title: race_event_update_reads Table
scope: database
last_verified: 2026-08-20
ai_priority: high
related_files:
  - supabase/migrations/20260820130930_add_format_targeted_race_updates.sql
  - supabase/tests/organizer_rls_checks.sql
  - apps/mobile/app/(app)/catalog.tsx
related_tables:
  - race_event_update_reads
  - race_event_updates
  - race_events
  - user_profiles
---

# `race_event_update_reads`

## Purpose

`race_event_update_reads` records when an identified runner has seen an organizer announcement in the mobile app. The Courses tab uses it to keep a `NEW` badge on an event and its unread messages until the event sheet displays them.

## Columns

| Column | Type | Constraints/default | Purpose |
| --- | --- | --- | --- |
| `update_id` | `uuid` | primary-key part, references `race_event_updates(id)` on delete cascade | Announcement that was read. |
| `user_id` | `uuid` | primary-key part, references `user_profiles(user_id)` on delete cascade | Runner who read it. |
| `read_at` | `timestamptz` | not null, UTC `now()` | First recorded read time. |

## RLS Policies

- Authenticated users can select only their own receipts.
- Authenticated users can insert only their own receipts, and only for an announcement whose parent event is live.
- Receipts are append-only. The composite primary key makes repeated marking idempotent.

## Business Invariants

- Read state is per user and synchronized across devices; it is not derived from push-delivery logs.
- Opening an event sheet marks only the announcement displayed in its collapsed post-format panel as read. Expanding the panel marks the newly displayed history as read; a push deep link includes the update id so the targeted message is loaded and placed first before its receipt is persisted.
- Anonymous sessions do not write read receipts.

## Gotchas

- `push_notification_events` proves delivery attempts, not whether a runner saw the message; do not use it as read state.
- Deleting an announcement through the membership-checked organizer route cascades its receipts; no orphan read state should remain.
- The mobile catalog keeps message bodies to a short preview but may fetch lightweight update id/event references so an older unread message still keeps the event-level badge visible.
- The toast and list scroll after a confirmed favorite addition are independent of announcement visibility and must not create read receipts.
- Racebook visibility has no effect on read receipts: announcements remain event-scoped and use parent event liveness, even when a particular format's Racebook is hidden.

## Related Docs

- [race_event_updates](race-event-updates.md)
- [RLS Policies](../rls-policies.md)
- [Mobile App](../../01-architecture/mobile-app.md)
