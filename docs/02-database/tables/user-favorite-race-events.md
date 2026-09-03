---
title: user_favorite_race_events Table
scope: database
last_verified: 2026-09-03
ai_priority: high
related_files:
  - supabase/migrations/20260629123858_add_race_event_favorites_and_updates.sql
  - apps/web/app/api/race-favorites/route.ts
  - apps/web/app/api/race-favorites/route.test.ts
  - apps/mobile/app/(app)/catalog.tsx
  - apps/mobile/components/race/RaceEventSummaryCard.tsx
related_tables:
  - user_favorite_race_events
  - race_events
  - user_profiles
---

# `user_favorite_race_events`

## Purpose

`user_favorite_race_events` stores the runner-level "follow this race event" relationship used by the mobile catalog and organizer update notifications.

## Key Concepts

- Event favorite: one runner follows one `race_events` row.
- Owner row: favorites are readable and mutable only by the owning user.
- Catalog pinning: mobile uses these rows to pin favorite events above the normal catalog sort.
- Catalog feedback: after the API confirms a new favorite, mobile shows a brief localized success toast and scrolls to the event's pinned position.
- Notification audience: organizer update pushes target users who favorited the event.

## Columns

| Column | Type | Constraints/default | Purpose |
| --- | --- | --- | --- |
| `id` | `uuid` | primary key, default `gen_random_uuid()` | Favorite row id. |
| `created_at` | `timestamptz` | not null, default UTC `now()` | Creation time. |
| `user_id` | `uuid` | not null, references `user_profiles(user_id)` on delete cascade | Owning runner. |
| `event_id` | `uuid` | not null, references `race_events(id)` on delete cascade | Favorited event. |

## Foreign Keys

- `user_id -> public.user_profiles(user_id) on delete cascade`
- `event_id -> public.race_events(id) on delete cascade`

## Indexes

- unique `user_favorite_race_events_user_event_key` on `(user_id, event_id)`
- `user_favorite_race_events_user_idx` on `(user_id, created_at desc)`
- `user_favorite_race_events_event_idx` on `(event_id, created_at desc)`

## RLS Policies

See [../rls-policies.md](../rls-policies.md).

Summary:

- Authenticated users can select their own favorites.
- Authenticated users can insert favorites only for their own `user_id`.
- Authenticated users can delete only their own favorites.

## Business Invariants

- Favorites are event-scoped, not format-scoped and not plan-scoped.
- One user can favorite an event only once.
- Anonymous users must not create favorites through the runner API.
- Organizer notifications use the favorite rows as the fan-out audience source, but favorites themselves do not store notification history.
- Choosing one format changes the announcement context and title; it does not replace the parent event's favorite list as the push audience.

## Common Queries

Fetch the current runner favorites:

```sql
select event_id
from public.user_favorite_race_events
where user_id = auth.uid()
order by created_at asc;
```

Count followers for one event:

```sql
select count(distinct user_id)
from public.user_favorite_race_events
where event_id = '<event-id>';
```

## Gotchas

- Guided onboarding reuses the catalog without changing event-favorite ownership, pinning, or notification audience semantics.
- Guided RaceBook results require a search and hide the favorite/create-plan detours, but this presentation rule never creates or removes an event favorite.

- Keep this table tied to `race_events`, not `races`; the mobile UX follows the whole event card.
- The FK targets `user_profiles(user_id)`, so profile bootstrap must exist before creating favorites.
- Do not expose cross-user favorite lists to organizers directly; organizer UI should show only aggregate counts.
- Mobile catalog sorting should treat favorites as a pinning hint first, then keep the usual date/name ordering inside each group.
- Only a confirmed addition should trigger the success toast and automatic scroll. Removing a favorite should preserve the current reading position, while a failed write restores the previous favorite order.
- Only a server-confirmed state change emits `race favorite updated`; failed or optimistic toggles must not be counted as completed favorite mutations.
- Favoriting affects ordering only; it must not change the compact organizer-update preview contract or trigger a separate history load by itself.
- Moving or expanding the post-format organizer-announcement panel, or deleting an announcement from organizer history, must not add or remove event favorites.
- Unread `NEW` badges come from `race_event_update_reads`, not from the favorite row.
- Favorites follow the catalog event independently from Racebook publication; hiding every Racebook must not delete or hide the event favorite.
- Organizer-only preview access is derived from `race_event_organizers`, not favorites; it must not pin the event or change notification audience membership.
- Hiding or deleting one edition must not remove the event favorite. The event appears in the mobile catalog only while at least one live format remains after the explicit embedded-relation filter.
- The Courses card may hide its repeated multi-format helper sentence to reduce density; the favorite control, pinning order, and event scope remain unchanged.
- Sponsor warmup from the RaceBook action is independent from favorites and must not write, reorder, or infer notification audience membership.

## Related Docs

- [race_events](race-events.md)
- [Schema Overview](../schema-overview.md)
- [Relationships](../relationships.md)
- [Mobile App](../../01-architecture/mobile-app.md)
