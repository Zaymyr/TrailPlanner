---
title: user_favorite_race_events Table
scope: database
last_verified: 2026-11-11
ai_priority: high
related_files:
  - supabase/migrations/20260629123858_add_race_event_favorites_and_updates.sql
  - apps/web/app/api/race-favorites/route.ts
  - apps/web/app/api/race-favorites/route.test.ts
  - apps/web/app/api/organizer/editions/[id]/analytics/route.ts
  - apps/web/app/api/organizer/editions/[id]/analytics/route.test.ts
  - apps/web/app/organizer/_components/dashboard/analytics-panel.tsx
  - apps/web/app/organizer/_components/dashboard/analytics-panel.test.ts
  - apps/mobile/app/(app)/catalog.tsx
  - apps/mobile/lib/catalogVisibility.ts
  - apps/mobile/lib/catalogVisibility.test.ts
  - apps/mobile/components/race/RaceEventSummaryCard.tsx
related_tables:
  - user_favorite_race_events
  - race_events
  - user_profiles
---

# `user_favorite_race_events`

Organizer RaceBook analytics can be opened by the Signature tier or the exact `capability.racebook_analytics` gift. This changes only server authorization for aggregate favorite metrics; favorite ownership, client RLS and stored rows remain unchanged.

Organizer analytics copy now consistently uses tutoiement. The favorite KPI remains the exact event-wide aggregate and this copy-only adjustment does not change favorite ownership or queries.

The Courses card image placeholder does not change the favorite action, its position, or favorite writes.

> Terminologie : les textes français destinés aux utilisateurs emploient **Livret coureur** et les textes anglais **Race Book**. Les identifiants techniques stables — routes, événements analytics, objets de base de données et valeurs historiques — conservent `racebook`.

## Purpose

`user_favorite_race_events` stores the runner-level "follow this race event" relationship used by the mobile catalog and organizer update notifications.

## Key Concepts

- Event favorite: one runner follows one `race_events` row.
- Owner row: favorites are readable and mutable only by the owning user.
- Catalog pinning and retention: mobile uses these rows to pin favorite events above the normal catalog sort and keep a past favorite visible through the fourteenth calendar day after its event date.
- Edition rollover is independent from favorite ownership: when a newer visible edition is online, formats from the older edition remain through day 14 after that edition's latest visible format date, then the card retains only the newest dated edition.
- Catalog feedback: for identified runners, mobile updates a card-local heart state in the same interaction frame with a reduced-motion-aware pulse, then resynchronizes it with the parent/server result while preserving the current list order and viewport. Guest hearts do not flip before the account prompt.
- The shared event card preserves favorite behavior when a format has no published D+; it labels the metric as unavailable instead of rendering a false zero.
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
- Non-favorite events disappear after their event date. A favorite remains visible on that date and for the following fourteen calendar-day boundaries, then disappears from the catalog on day 15 without deleting the favorite row.
- One user can favorite an event only once.
- Anonymous users must not create favorites through the runner API. The mobile heart remains visible to them as an account-conversion entry point, but the prompt is shown before any optimistic state or API write.
- Organizer notifications use the favorite rows as the fan-out audience source, but favorites themselves do not store notification history.
- Choosing one format changes the announcement context and title; it does not replace the parent event's favorite list as the push audience.
- The organizer Statistics KPI is the exact current event-wide row count. It is not restricted by edition, format, or analytics date range and exposes no follower identity.

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

- Rendering the event heart as a transparent secondary 44-point action changes visual weight only. Optimistic state, guest prompting, server confirmation, pinning and mutation analytics remain unchanged.

- Sticky search/filter presentation and native date entry filter the already-loaded catalog only; they do not create, delete, reorder, or rescope favorite rows.
- Showing `Ouvrir mon plan` for an existing owned format neither reads nor writes favorites. Clearing search and hiding an empty image rail are also local presentation only. The existing heart remains the only favorite mutation surface.

- Courses retry and pull-to-refresh reload the favorite snapshot and may then apply its normal sort, but neither action creates or deletes a favorite. Only the existing explicit heart interaction mutates this table.

- Moving the Courses race-request action into the shared collapsible header does not create, remove, reorder, or otherwise inspect event favorites. Header collapse is scroll presentation only.
- The Courses catalog now contains catalog event formats only; removing its former personal-race section does not change event favorite ownership, ordering, or retention.
- Clicking `Créer un plan` emits a separate catalog analytics event and does not create, remove, or reorder event favorites.

- The 2026-09-14 iOS accessibility pass changes only mobile input, gesture, and motion presentation; favorite ownership, pinning, mutation confirmation, and notification audience contracts remain unchanged.
- Preview-selected private formats can keep a visible parent event in every runner's Courses catalog, while masked formats remain absent. This does not change favorite ownership or notification membership; favorites remain runner-owned and event-scoped.
- Guided onboarding reuses the catalog without changing event-favorite ownership, pinning, or notification audience semantics.
- Guided RaceBook results require a search and hide the favorite/create-plan detours, but this presentation rule never creates or removes an event favorite.

- Keep this table tied to `race_events`, not `races`; the mobile UX follows the whole event card.
- A guest tap on the heart must route to the shared account prompt and must not create a row, reorder the catalog, or emit `race favorite updated`.
- The FK targets `user_profiles(user_id)`, so profile bootstrap must exist before creating favorites.
- Do not expose cross-user favorite lists to organizers directly; organizer UI should show only aggregate counts.
- Do not present the organizer favorite total as a period conversion metric. It is the current event-scoped stock, even when shown beside date-filtered RaceBook traffic KPIs.
- Mobile catalog sorting should treat the favorite snapshot loaded from the server as a pinning hint first, then keep the usual date/name ordering inside each group. A successful toggle does not reorder the current view; the next load or refresh uses the new snapshot.
- Adding or removing a favorite preserves the current reading position and does not show a success toast. A failed write restores the previous heart state without changing the visible order.
- Only a server-confirmed state change emits `race favorite updated`; failed or optimistic toggles must not be counted as completed favorite mutations.
- Favoriting affects ordering only; it must not change the compact organizer-update preview contract or trigger a separate history load by itself.
- Moving or expanding the post-format organizer-announcement panel, or deleting an announcement from organizer history, must not add or remove event favorites.
- Unread `NEW` badges come from `race_event_update_reads`, not from the favorite row.
- Favorites follow the catalog event independently from Racebook publication; hiding every Racebook must not delete or hide the event favorite.
- Organizer-only preview access is derived from `race_event_organizers`, not favorites; it must not pin the event or change notification audience membership.
- Hiding or deleting one edition must not remove the event favorite. The event appears in the mobile catalog only while at least one live format remains after the explicit embedded-relation filter.
- Removing an expired edition from the Courses presentation must not delete the event favorite or mutate organizer visibility; the favorite continues to follow the stable parent event and can pin its newer edition.
- The Courses card may hide its repeated multi-format helper sentence and decorative flag, align its compact action with the format/distance pills, fill the left rail with the race image, place the independent animated heart in the trailing header position, and make the remaining card surface open format selection to reduce density. Quick favorite/distance chips filter the loaded rows only; pinning persistence and event scope remain unchanged.
- Sponsor warmup from the RaceBook action is independent from favorites and must not write, reorder, or infer notification audience membership.

## Mobile feedback

Favorite writes retain the existing optimistic persistence and rollback behavior. Successful add/remove operations now show a brief shared toast; network failure rolls back and exposes a retry action without changing the table contract.

Trail signature iteration (2026-11-11): runner presentation only. In-page RaceBook Course, Profile and plan view selectors become trail tabs, map/transport links and the catalog format RaceBook action become signpost buttons, catalog format distance/D+ read as cotes, tab-bar blazes move to the left of the selected icon, the hero contours are lightened and the elevation profile gains a decorative summit flag and iso-line echo. No query, row, payload, navigation target or analytics event changes.


## Mobile presentation

The mobile catalog (`apps/mobile/app/(app)/catalog.tsx`) now shows its quick filters as kilometre-milestone `ChoiceChip`s behind a compass filter button (Favoris first, heart variant) and the race sheet favourite as a forest `HeartMark`; this is presentation only — queries, favourite writes and analytics events are unchanged.

`RaceEventSummaryCard` (catalog race card) shows the RaceBook availability as a `StatusPill` wristband, counts and distances as `Cote`s and, at its foot, the real elevation profiles of up to five formats overlaid on a shared distance axis and elevation range (one sober line colour per format, longest in forest with a light fill; brand ridge only when no format has a profile). The catalog list query is unchanged: each visible row lazily reads profiles through the existing public `/api/onboarding/race-profile` path (`fetchRaceElevationProfile`), only for formats with a non-null `gpx_storage_path` whose `organizer_details.gpxDisplay.showElevationProfile` is not false, three requests at a time, downsampled to 48 points and cached for the session (`apps/mobile/lib/catalogCourseProfiles.ts`). No column, write or migration; a stored ~48-point preview per format would be the lighter long-term source. <!-- TODO: verify with maintainer -->

## Related Docs

Private-demo format selection does not affect event favorites or catalog membership; it gates only the RaceBook action for that format.

- [race_events](race-events.md)
- [Schema Overview](../schema-overview.md)
- [Relationships](../relationships.md)
- [Mobile App](../../01-architecture/mobile-app.md)

Hiding a failed event thumbnail rail and simplifying the sticky catalog search surface do not add, remove, or reorder favorite rows.

Livret-first navigation (2026-11-09): favorites are now also read by mobile `Mes courses`, split into upcoming events (top) and past events (bottom `Courses passées` group) (`lib/raceFavorites.ts`; the shared `/api/race-favorites` read moved out of `catalog.tsx`) to list upcoming followed events without a plan, joined to public `race_events`/`races` publication flags. The catalog no longer pins a past favorite above upcoming events; favorites are pinned first inside the upcoming and past groups (`sortCatalogEvents`). No write path, retention window, RLS policy or column changes.

Catalog scroll performance (2026-11-09): the Courses list renders memoized `CatalogEventRow` rows (stable callbacks through a handler ref) over a memoized `RaceEventSummaryCard`, tunes FlatList virtualization (`initialNumToRender` 6, `maxToRenderPerBatch` 4, `windowSize` 9, `removeClippedSubviews` on Android), downsamples rail images (`resizeMethod="resize"`) and reads reduce-motion on favorite press instead of subscribing one accessibility listener per card. Presentation only: no query, payload, analytics event or favorite/update-read behavior changes.
