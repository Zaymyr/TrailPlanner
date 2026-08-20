---
title: race_events Table
scope: database
last_verified: 2026-08-20
ai_priority: high
related_files:
  - supabase/migrations/20260331000000_add_thumbnail_to_race_events.sql
  - supabase/migrations/20260528120000_add_organizer_portal.sql
  - supabase/migrations/20260618160000_add_organizer_dashboard_details.sql
  - supabase/migrations/20260629123858_add_race_event_favorites_and_updates.sql
  - supabase/migrations/20260804152041_add_race_event_editions.sql
  - supabase/migrations/20260729110000_add_race_event_publication_requests.sql
  - apps/web/app/api/race-catalog/route.ts
  - apps/web/app/api/admin/race-catalog/route.ts
  - apps/web/app/api/admin/race-events/[id]/route.ts
  - apps/web/app/api/organizer/events/[id]/route.ts
  - apps/web/app/api/organizer/events/[id]/route.test.ts
  - apps/web/app/api/organizer/events/route.ts
  - apps/web/app/api/organizer/events/route.test.ts
  - apps/web/app/api/organizer/events/[id]/website-import/route.ts
  - apps/web/app/api/organizer/events/[id]/website-import/route.test.ts
  - apps/web/app/api/organizer/events/[id]/website-import/parser.test.ts
  - apps/web/app/api/organizer/events/[id]/updates/route.ts
  - apps/web/app/api/organizer/events/[id]/image/route.ts
  - apps/web/app/api/organizer/events/[id]/image/route.test.ts
  - apps/web/app/api/organizer/publication-requests/route.ts
  - apps/web/app/api/admin/event-publication-requests/route.ts
  - apps/web/lib/organizer-publication.ts
  - apps/web/app/api/race-favorites/route.ts
  - apps/web/app/api/race-events/[id]/updates/route.ts
  - apps/web/lib/organizer-dashboard-details.ts
  - apps/web/lib/organizer-website-import.ts
  - apps/web/lib/push.ts
  - apps/web/lib/public-races.ts
  - apps/web/app/courses/page.tsx
  - apps/web/app/courses/[slug]/page.tsx
  - apps/web/app/courses/_components/RaceCatalogFilter.tsx
  - apps/web/app/api/organizer/claims/route.ts
  - apps/web/app/api/admin/organizer-claims/route.ts
  - apps/mobile/app/(app)/catalog.tsx
  - apps/mobile/app/(app)/race/[id]/racebook.tsx
  - apps/mobile/components/race/RaceEventSummaryCard.tsx
  - apps/mobile/lib/racebook.ts
related_tables:
  - race_events
  - race_event_claims
  - race_event_organizers
  - race_event_publication_requests
  - race_event_updates
  - race_event_editions
  - races
  - user_favorite_race_events
---

# `race_events`

## Purpose

`race_events` groups races that share an event identity, location, image, and live status. Canonical yearly dates now live in `race_event_editions`; the visible migrations do not include the original `race_events` create-table migration.

## Key Concepts

- Event grouping: multiple `races` can belong to one event.
- Event image: `thumbnail_url` can be used as a shared event thumbnail; organizer uploads currently accept PNG files through a server route and store the resulting public Storage URL here.
- Event liveness: mobile and onboarding filter on event/race live state.
- Draft organizer event: a non-live event row created directly by an authenticated organizer.
- Organizer dashboard details: nullable JSONB for event end date, official website, common equipment, common bib pickup locations and dated time slots, access, services, partners, and runner notes.
- Event favorite target: runners follow the whole event, not an individual race format.
- Organizer announcement source: manual `race_event_updates` rows can be published for the event and pushed to followers.
- Mobile Racebook contract: the mobile Courses tab can now read `organizer_details` explicitly for live formats when deciding whether a runner-facing read-only Racebook page should be available.
- Public web catalog contract: `/courses` reads only explicit safe columns from live public race formats and their live parent events through the anon Data API.
- Geocoded event metadata: organizer-managed `organizer_details.eventLocation` can now mirror the plain `location` text with optional coordinates and Google Maps URL for preview/share surfaces, without changing the main event column contract.
- Website-import target: the organizer website import route enriches the selected organizer-owned `race_events` row and must never create a different event during that review flow, even when the generic importer inspects a bounded set of prioritized same-origin pages, scores candidate dates, and merges format data before building its preview.
- Missing provenance: table creation must be verified outside the visible migrations.
- Organizer creation target: direct creators receive an active owner membership and can manage all formats under their new event immediately.

## Columns Observed From Code

| Column | Type | Constraints/default | Purpose |
| --- | --- | --- | --- |
| `id` | `uuid` | inferred primary key | Event id used by `races.event_id`. |
| `name` | `text` | required by API schemas | Event display name. |
| `location` | `text` | nullable in API schemas | Event location. |
| `race_date` | `text` or date-like | nullable in API schemas | Compatibility mirror of the current edition start date for catalog/mobile reads. |
| `thumbnail_url` | `text` | nullable, added by migration | Shared event thumbnail URL. |
| `is_live` | `boolean` | nullable/boolean in API schemas | Visibility flag used by onboarding/profile routes. |
| `organizer_details` | `jsonb` | nullable, added by `20260618160000_add_organizer_dashboard_details.sql` | Organizer-managed progressive common dashboard details. |

<!-- TODO: verify with maintainer: confirm exact race_events column types, constraints, indexes, and RLS policies in the live Supabase project. -->

## Foreign Keys

Current code expects `races.event_id` to reference `race_events.id`, but the visible migrations do not show the column creation or FK declaration.

Event-scoped child tables added later include:

- `user_favorite_race_events.event_id`
- `race_event_updates.event_id`

<!-- CONFLICT: apps/web and apps/mobile query races.event_id and race_events joins; visible migrations do not create races.event_id or race_events. -->

## Indexes

No index creation for `race_events` was found in visible migrations. Admin and mobile code query by name/date, so the live schema may have indexes not represented here.

## RLS Policies

No `race_events` RLS policy migration was found in this repo. A read-only live-environment check on 2026-08-20 confirmed that the anon Data API can read the explicit public catalog columns used by `apps/web/lib/public-races.ts`; migration provenance is still missing.

Because API routes use service role for event writes, client/mobile read access must be verified against the live policies before changing catalog access.

Organizer portal writes also go through web service routes after checking `race_event_organizers`. The organizer portal migration adds RLS for claims and memberships, but it does not add a `race_events` table policy. The organizer details migration adds only a nullable JSONB column and comments; it adds no grants or new policies.

## Business Invariants

- Event rows are created by admin catalog import routes when `event_name` is supplied.
- Public web pages must require `races.is_live = true` and `races.is_public = true`; related event enrichment must also require `race_events.is_live = true`.
- Event rows can also be created by `POST /api/organizer/events`; those rows are inserted with `is_live = false`, then linked to their creator through an active owner membership.
- Admin catalog/event creation flows should also default new event rows to `is_live = false` unless the operator explicitly publishes them.
- Race rows can refer to an existing or newly created event.
- Approved organizer membership is event-scoped and grants access to all race formats linked by `races.event_id`.
- Trusted admins can select every event, including drafts, from the existing Organizer header and use the same server mutation routes. This admin catalog read is service-role-backed after `app_metadata` verification and does not create organizer memberships.
- Organizer yearly editions are normalized in `race_event_editions`. Formats attach through `races.edition_id`; `races.edition_group_id` and `series_name` continue to group the same format series across years.
- Runner favorites are event-scoped and are used by the mobile catalog to pin the whole event card above normal ordering.
- Organizer runner notifications are manual. Saves and publication review must not auto-create announcements.
- Mobile Courses now preloads only a short organizer-update preview per event from the `race_event_updates` relation so the sheet can open without a second visible loading pass; the longer history still comes from the dedicated updates route when a runner taps to see more.
- Organizer event details are saved through `/api/organizer/events/[id]` after active membership checks and should remain progressive JSON until the fields justify normalized tables. That JSON now includes structured geocoded location metadata for the event location plus `officialWebsiteUrl` in addition to the existing plain `location` text column. The website-import preview may propose that official URL after aggregating a few same-domain pages, but the row is still updated only after manual organizer confirmation.
- The organizer event detail read embeds child `race_aid_stations(id)` only to derive an `aidStationCount` per returned format. The raw nested rows are removed from the API response, and the count keeps completion scoring tied to each format rather than the selected dashboard tab.
- Generic website-import discovery may use a newer regulation to reject formats from an older linked parcours page and may consolidate duplicate format candidates by normalized business name before sorting them by final quality score, but these preview choices do not create or move an event row. Missing required format values such as D+ remain explicit instead of being inferred.
- Website-import field provenance and confidence scores are transient preview data computed by the server. They are not persisted in `race_events.organizer_details`; only organizer-confirmed event values, including `officialWebsiteUrl`, enter the row.
- During website-import review, an organizer may replace the detected edition start date with another valid ISO date. The server validates it after membership/hash checks, upserts the corresponding `race_event_editions` row, and attaches imported formats to it. Matching rows in another year are not overwritten, while a missing format series reuses its `edition_group_id` when possible.
- Organizer event writes remain edition-aware for selecting child rows, but no date-based cutoff blocks event or format maintenance.
- The canonical event start/end range is stored in `race_event_editions`. The current edition is mirrored into `race_date` and `organizer_details.dateRange.endDate` for compatibility with catalog/mobile queries.
- Event organizer details are common defaults. In the current organizer UI, bib pickup is event-only and stores `bibPickup.locations[]`, each containing one canonical/geocoded address and `slots[]` with date, start time, and end time. The legacy `location`, `locationDetails`, and free-text `schedule` fields remain compatibility fallbacks. Format-specific differences belong in `races.organizer_details` and should be merged by runner-facing code only for the modules that still support overrides.
- Mobile Racebook uses those common defaults as runner-facing event data only through an explicit read-only contract in `apps/mobile/lib/racebook.ts`; the screen must continue to gate itself on live race state plus actual non-ravito organizer content. Its top identity card exposes event/format identity, the event date range, any distinct format date, the best published location, runner information, and event services; distance, D+, D-, and start-time metric pills are omitted. Event-level bib pickup remains isolated in `Dossard`; `Course` owns the explicitly labeled start time in a light-green important-information row, the critical finish cutoff, schedule constraints, and only the available GPX map, elevation profile, and ravitos; `Accès` owns start/finish linked locations and the remaining logistics. Equipment is presented in required, recommended, and inactive weather-conditional groups with inline status and weather markers.
- Organizer event PNG uploads write to the public `race-images` bucket through a service route, then patch `thumbnail_url`; organizers should not write directly to Storage from client code.
- Mobile catalog groups event races and also displays standalone races with no event.
- Mobile catalog and onboarding share `RaceEventSummaryCard` for event-row presentation; the component consumes the same event/race shape and should not add database assumptions.
- Mobile catalog root actions are presentation-only and do not change the observed event grouping query shape.
- Mobile Racebook presentation keeps access start/finish and bib value widths responsive for readable long linked locations, groups bib pickup by location and then by day, and stacks same-day ranges beneath one localized short weekday/day/month label with locale-specific hours. It shows ravito metric labels inline beside their values and presents water, solid food, assistance, and drop-bag flags as accessible icon-only buttons with one toggled inline label bubble. Pull-to-refresh repeats the existing read-only event, format, route, profile, and ravito reads so newly published organizer data appears without restarting the app; it does not change the event query or organizer-details contract.
- Event thumbnails can be copied from the first related race by `20260331000000_add_thumbnail_to_race_events.sql`.

## Common Queries

Observed admin/mobile query shape:

```sql
select id, name, location, race_date, thumbnail_url, is_live
from public.race_events
order by name asc;
```

Observed organizer detail shape:

```sql
select id, name, location, race_date, thumbnail_url, is_live, organizer_details
from public.race_events
where id = '<event-id>';
```

The organizer service route additionally embeds `races(..., race_aid_stations(id))` and maps those ids to a per-format `aidStationCount`; it does not expose the nested station rows in its response.

Observed mobile Racebook event shape:

```sql
select id, name, location, race_date, thumbnail_url, is_live, organizer_details
from public.race_events
where is_live = true;
```

Observed race join shape:

```sql
select id, name, event_id, race_events(id, name, location, race_date, thumbnail_url, is_live)
from public.races;
```

## Gotchas

- Treat this table as live-schema-dependent until its create migration is found.
- Keep public web selects explicit. Do not expose `organizer_details`, ownership, membership, or other operational fields through the SEO catalog without a deliberate runner-facing contract.
- Do not add docs that claim exact constraints for `race_events` without verification.
- Code paths are real even though migration provenance is incomplete.
- Keep shared mobile event-row UI changes separate from race event query or schema changes.
- Do not use `races.created_by` to represent event organizer ownership for claimed public events.
- Manual organizer draft events are not public catalog rows until an admin approves a publication request.
- Keep favorites and organizer updates on `race_events`. The push deep link and mobile catalog sheet both target the event id, not a specific format id.
- Keep the event-level catalog query narrow even with update previews: mobile should embed only the short recent history needed for instant sheet rendering, not the full announcement archive for every event.
- Do not include `organizer_details` in public/mobile event queries unless the runner-facing contract is explicitly designed. The current exception is the live-format mobile Racebook flow, which still stays hidden for aid-station-only formats.
- Organizer event/race mutation routes cannot set live state. A publication request requires event name, location, start date, end date, and at least one complete format; admin approval rechecks those fields and atomically publishes the event plus complete formats.
- Do not infer organizer write authorization from edition age; `/api/organizer/events/[id]` and child mutation routes rely on active event membership for past and future editions.
- Do not store per-format equipment, dossard, or access differences on the event row.
- Do not move the canonical event location text out of `race_events.location`; geocoded location JSON is additive metadata for preview/navigation only.
- Do not edit the legacy event date fields as canonical organizer dates; update `race_event_editions` and let its trigger mirror the current range.
- Keep image upload validation in the server route; the database stores only the resulting URL.
- Keep admin organizer review tolerant of missing yearly-edition joins: a failed `race_event_edition_requests -> race_events` read should not prevent the base event-claim review data from loading.
- Keep generic website crawling bounded to prioritized same-origin pages. External registration, social, and activity-platform links are source references, not additional event pages to crawl into the `race_events` preview.

- The membership rule has one server-verified admin exception. Do not turn the complete Organizer selector into an unfiltered authenticated or public `race_events` read.

## Related Docs

- [Schema Overview](../schema-overview.md)
- [Relationships](../relationships.md)
- [GPX Import](../../03-business-rules/gpx-import.md)
- [Mobile App](../../01-architecture/mobile-app.md)
