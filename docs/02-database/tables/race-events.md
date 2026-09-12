---
title: race_events Table
scope: database
last_verified: 2026-09-12
ai_priority: high
related_files:
  - supabase/migrations/20260331000000_add_thumbnail_to_race_events.sql
  - supabase/migrations/20260528120000_add_organizer_portal.sql
  - supabase/migrations/20260618160000_add_organizer_dashboard_details.sql
  - supabase/migrations/20260629123858_add_race_event_favorites_and_updates.sql
  - supabase/migrations/20260820130930_add_format_targeted_race_updates.sql
  - supabase/migrations/20260804152041_add_race_event_editions.sql
  - supabase/migrations/20260729110000_add_race_event_publication_requests.sql
  - supabase/migrations/20260820135823_add_racebook_publication_control.sql
  - supabase/migrations/20260820164141_target_racebook_publication_requests.sql
  - supabase/migrations/20260824114439_add_organizer_import_sessions_and_drafts.sql
  - supabase/migrations/20260824164101_manage_organizer_edition_visibility_and_deletion.sql
  - supabase/migrations/20260828161008_add_race_slug_redirects.sql
  - supabase/migrations/20260829080943_update_amazeaunes_2026_final_roadbook.sql
  - supabase/migrations/20260907111600_integrate_la_tourun_2026.sql
  - supabase/migrations/20260909192326_seed_verified_seo_races_2026_2027.sql
  - supabase/migrations/20260909200153_enrich_verified_seo_races_batch_2.sql
  - supabase/migrations/20260910061433_import_utmb_world_series_catalog_2026_2027.sql
  - supabase/migrations/20260910074418_add_normalized_race_event_geography.sql
  - supabase/migrations/20260910082051_backfill_catalog_race_event_geography.sql
  - supabase/migrations/20260910103118_enrich_catalog_through_may_2027.sql
  - supabase/migrations/20260911114106_expose_private_formats_in_visible_catalog.sql
  - supabase/migrations/20260910083131_correct_translantau_country_code.sql
  - supabase/tests/organizer_import_sessions_checks.sql
  - supabase/tests/race_slug_redirects_checks.sql
  - apps/web/app/api/race-catalog/route.ts
  - apps/web/app/api/admin/race-catalog/route.ts
  - apps/web/app/api/admin/race-events/[id]/route.ts
  - apps/web/app/api/organizer/events/[id]/route.ts
  - apps/web/app/api/organizer/events/[id]/route.test.ts
  - apps/web/app/api/organizer/editions/[id]/route.ts
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
  - apps/web/lib/organizer-import-engine.ts
  - apps/web/lib/organizer-import-proposals.ts
  - apps/web/lib/push.ts
  - apps/web/lib/public-races.ts
  - apps/web/lib/public-race-detail.ts
  - apps/web/lib/public-race-detail.test.ts
  - apps/web/app/courses/page.tsx
  - apps/web/app/courses/catalog-query.ts
  - apps/web/app/courses/catalog-query.test.ts
  - apps/web/app/courses/[slug]/page.tsx
  - apps/web/app/courses/[slug]/race-metadata.ts
  - apps/web/app/courses/_components/RaceCatalogFilter.tsx
  - apps/web/app/courses/_components/PublicRaceLinks.tsx
  - apps/web/app/courses/distances/[category]/page.tsx
  - apps/web/app/courses/race-discovery.test.ts
  - apps/web/lib/race-discovery.ts
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
  - race_event_update_reads
  - race_event_editions
  - races
  - organizer_import_sessions
  - user_favorite_race_events
  - race_slug_redirects
---

# `race_events`

## Purpose

`race_events` groups races that share an event identity, location, image, and live status. Canonical yearly dates now live in `race_event_editions`; the visible migrations do not include the original `race_events` create-table migration.

## Key Concepts

- Event grouping: multiple `races` can belong to one event.
- Event image: `thumbnail_url` can be used as a shared event thumbnail; organizer uploads currently accept PNG files through a server route and store the resulting public Storage URL here.
- Event liveness: mobile and onboarding use event/race live state for course catalog visibility; it no longer determines Racebook visibility.
- Edition liveness: `race_event_editions.is_visible` can hide one year by forcing only that edition's formats and Racebooks off while leaving the parent event and other years unchanged.
- Organizer event: created catalog-visible, while its Racebook formats remain hidden until approved.
- Organizer dashboard details: nullable JSONB for event end date, official website, Instagram URL, Facebook URL, structured emergency contact name/phone, common equipment, common bib pickup locations and dated time slots, access, services, partners, and runner notes.
- Event favorite target: runners follow the whole event, not an individual race format.
- Organizer announcement source: manual `race_event_updates` rows can concern the whole event or one child format and are pushed to event followers.
- Mobile Racebook contract: the mobile Courses tab reads `organizer_details`, `races.racebook_preview_is_visible`, and `races.racebook_is_live`. Ordinary runners require a live format plus RaceBook publication. Active `race_event_organizers` membership keeps managed private formats in Courses, grants an unpublished preview only when preview selection is true, and dims that private RaceBook action. Masked formats are removed from the mobile catalog for every role.
- Public web catalog contract: `/courses` reads only explicit safe columns from live public race formats and their live parent events through the anon Data API. Its server search projection includes public format/event locations plus normalized city, department, region, and country names, but excludes codes, coordinates, organizer JSON, and operational fields; each response serializes at most 12 grouped event editions plus any formats inside those groups. The richer server-only detail read rechecks race/event/edition visibility before loading organizer JSON or private GPX, then returns only allowlisted runner-facing values. Its metadata helper limits titles to 60 characters and descriptions to 160, reserves a distance/year suffix, preserves the distinguishing end of long format names, and uses the shared social image only when neither format nor event supplies one.
- Public web grouping: `/courses` groups current formats by stable `races.event_id + races.edition_id`, with an `event_id` fallback only for historical rows without an edition; event names are presentation labels and never grouping keys.
- Curated SEO seeds create or refresh a canonical visible edition per verified upcoming event, publish only source-backed formats, and may enrich existing event rows without duplicating their formats.
- The second curated batch adds four verified event identities, refreshes the existing Foulée des Ducs edition, and enriches Nice UTMB and Terres de Saône event provenance while preserving existing format metrics.
- The official UTMB World Series import creates or refreshes 55 event identities from their tenant-specific official domains. It stores the UTMB tenant in `organizer_details.catalogSource`, rejects ambiguous legacy matches, and keeps each event linked to one canonical upcoming edition.
- The organizer-source March–May 2027 batch creates the Trail du Petit Ballon and Grand Trail des Cadourques events, reuses and canonicalizes the existing Volvic Volcanic Experience event, and leaves all three with verified French commune-level geography and visible 2027 editions.
- Geocoded event metadata: organizer-managed `organizer_details.eventLocation` can now mirror the plain `location` text with optional coordinates and Google Maps URL for preview/share surfaces, without changing the main event column contract.
- Normalized catalog geography: explicit city, department, region and country names/codes plus an anchor-city coordinate pair support reliable search and future exact geographic filters without parsing `location`. The first backfill covers eight Search Console-priority events and refreshes eleven format location labels; the catalog-wide backfill adds 36 complete French anchors and country-level coverage for 50 international events; the March–May 2027 batch brings complete French anchors to 46.
- Website-import target: the admin-only organizer information import enriches only the selected `race_events` row and must never create a different event. It first confirms the number and identity of child formats, then reviews field-level source claims. Candidate existence is independent from completeness, distance alone never merges or binds formats, and OpenAI can only choose an already extracted applicable claim or abstain. Roadbooks remain temporary analysis sources and never become event-row data.
- Two-pass import scope: `organizer_import_sessions.event_id` binds discovery, format confirmation, and field application to this exact event; the session trigger also requires its edition to belong here.
- Missing provenance: table creation must be verified outside the visible migrations.
- Organizer creation target: direct creators receive an active owner membership and can manage all formats under their new event immediately.
- Admin delegation target: the admin Organizer tab lists event ids/names after trusted admin verification so an existing Auth account can receive an event-scoped `organizer` membership without changing the event row.

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
| `location_city`, `location_city_code` | nullable `text` | city code is a stable locality identifier; French rows use INSEE | Normalized anchor city for exact city filters. |
| `location_department`, `location_department_code` | nullable `text` | paired curated values | Normalized French department or equivalent second-level area. |
| `location_region`, `location_region_code` | nullable `text` | paired curated values | Normalized French region or equivalent first-level area. |
| `location_country`, `location_country_code` | nullable `text` | country code is checked as two uppercase letters | Normalized country identity. |
| `location_latitude`, `location_longitude` | nullable `double precision` | valid ranges; both null or both present | Approximate event anchor used for nearby-city discovery. |

<!-- TODO: verify with maintainer: confirm exact race_events column types, constraints, indexes, and RLS policies in the live Supabase project. -->

## Foreign Keys

Current code expects `races.event_id` to reference `race_events.id`, but the visible migrations do not show the column creation or FK declaration.

Event-scoped child tables added later include:

- `user_favorite_race_events.event_id`
- `race_event_updates.event_id`
- `race_event_update_reads` reaches the event through its parent update

<!-- CONFLICT: apps/web and apps/mobile query races.event_id and race_events joins; visible migrations do not create races.event_id or race_events. -->

## Indexes

The original event-table indexes remain unproven. `20260910074418_add_normalized_race_event_geography.sql` adds partial B-tree indexes for non-null region, department and city codes, plus a partial coordinate-pair index for bounded nearby-city queries.

## RLS Policies

No `race_events` RLS policy migration was found in this repo. A read-only live-environment check on 2026-08-20 confirmed that the anon Data API can read the explicit public catalog columns used by `apps/web/lib/public-races.ts`; migration provenance is still missing.

Because API routes use service role for event writes, client/mobile read access must be verified against the live policies before changing catalog access.

Organizer portal writes also go through web service routes after checking `race_event_organizers`. The organizer portal migration adds RLS for claims and memberships, but it does not add a `race_events` table policy. The organizer details migration adds only a nullable JSONB column and comments; it adds no grants or new policies.

## Business Invariants

- Event rows are created by admin catalog import routes when `event_name` is supplied.
- Geographic catalog filtering must use the explicit normalized columns. The plain `location` label remains display text and `organizer_details.eventLocation` remains runner-navigation metadata.
- Latitude/longitude identify an event anchor city, not every point crossed by a route. Multi-city formats keep their sourced departure-arrival wording in `races.location_text`.
- Changing `race_events.location` without updating the normalized geography in the same statement clears all normalized fields through `clear_stale_race_event_geography()`, preventing stale regional filters.
- Public web pages must require `races.is_live = true` and `races.is_public = true`; related event enrichment must also require `race_events.is_live = true`.
- Public web details deliberately exclude `organizer_details.emergencyContact`, `services.lastMinuteMessage`, and both raw organizer JSON objects even though the mobile Racebook contract may expose emergency calling.
- Former course slugs use the same rule: `race_slug_redirects` is readable and the canonical race is returned only while the optional parent event remains live.
- Event rows can also be created by `POST /api/organizer/events`; those rows are inserted with `is_live = true`, then linked to their creator through an active owner membership. Their Racebooks stay separately hidden.
- Admin catalog/event creation flows should also default new event rows to `is_live = false` unless the operator explicitly publishes them.
- Race rows can refer to an existing or newly created event.
- Approved organizer membership is event-scoped and grants access to all race formats linked by `races.event_id`.
- Trusted admins can select every event, including drafts, from the existing Organizer header and use the same server mutation routes. This admin catalog read is service-role-backed after `app_metadata` verification and does not create organizer memberships.
- The separate `Accès organisateurs` admin sub-tab also reads the complete event list only after the same trusted admin check. Submitting an existing e-mail creates/reactivates membership. If the account is absent, only explicit confirmation creates and invites it before membership insertion. Both paths leave every `race_events` field, including `is_live`, unchanged.
- Organizer yearly editions are normalized in `race_event_editions`. Formats attach through `races.edition_id`; `races.edition_group_id` and `series_name` continue to group the same format series across years.
- Runner favorites are event-scoped and are used by the mobile catalog to pin the whole event card above normal ordering.
- Organizer history reads expose only the aggregate follower total, obtained from Supabase with `count=exact` and a one-row range; individual follower ids are not part of that response contract.
- Organizer runner notifications are manual. Saves and publication review must not auto-create announcements.
- Mobile Courses now preloads only a short organizer-update preview per event from the `race_event_updates` relation so the sheet can open without a second visible loading pass. After every format row, one light-green panel shows only the newest or targeted announcement while collapsed; tapping `View more` reveals the other messages and loads the longer history from the dedicated updates route when needed.
- Organizer event details are saved through `/api/organizer/events/[id]` after active membership checks and selected-module checks, not paid-tier checks. This permits private drafts for services and other higher-tier sections; public/mobile serializers still apply the effective entitlement. The JSON includes structured geocoded location metadata, official/social links, emergency contact, and the progressive module subtrees.
- The organizer bootstrap/event detail reads embed only child ids or narrow status columns needed to derive completion summaries: per-format ravito/SAS/podium counts and per-edition service/sponsor/branding state. Raw nested rows are removed from the API response, so opening a lazy editor is not required to refresh a tile and editable collection payloads remain module-scoped.
- Those authorized reads also attach one sanitized effective-purchase summary per edition. Whole-event deletion gathers manual invoice paths before the database cascade and removes their private Storage objects only after the event deletion succeeds.
- Generic discovery may use a newer regulation to reject old-edition candidates and may consolidate detections only from compatible normalized identity evidence. Explicit format headings on the main page are eligible candidates, including KMS-style event-prefixed labels; repeated registration links do not demote a page that exposes several named distances. Up to two same-origin PDF links explicitly identified as PDFs may join the evidence set after bounded text extraction, without becoming database writes by themselves. Additional official URLs are classified by role and remain evidence sources rather than asserted formats; ambiguous event JSON-LD cannot collapse named page-specific identities. Anonymous same-distance detections stay separate for admin confirmation. Missing values such as D+ remain explicit and do not invalidate confirmed format existence.
- Import field provenance and confidence are represented as transient source claims. Current values and previous-edition context are claims too, but historical claims remain reference-only. Only explicitly selected applicable claim ids, including an optional `officialWebsiteUrl`, may enter the row.
- During website-import review, an organizer may replace the detected edition start date with another valid ISO date. The server validates it after membership/hash checks, upserts the corresponding `race_event_editions` row, and attaches imported formats to it. Matching rows in another year are not overwritten, while a missing format series reuses its `edition_group_id` when possible.
- Two-pass import confirmation persists every admin-confirmed new format immediately, even when distance or D+ is unknown. Those child rows remain hidden drafts until the allowlisted field RPC clears their explicit missing-field list; the parent event itself is never created, moved, or published by that confirmation.
- Organizer event writes remain edition-aware for selecting child rows, but no date-based cutoff blocks event or format maintenance.
- The canonical event start/end range is stored in `race_event_editions`. The current edition is mirrored into `race_date` and `organizer_details.dateRange.endDate` for compatibility with catalog/mobile queries.
- The Les Amaz’Eaunes 2026 final-roadbook migration keeps that mirror aligned to the single race day, 13 September 2026, and updates only organizer details explicitly supported by the supplied roadbook; absent GPX, D+, and ravito-location facts remain untouched.
- The La Tou’Run 2026 integration enriches the existing event in place from its KMS page and official regulation, attaches all five announced formats to the existing edition, and preserves unknown geometry, GPX, exact ravito distance, and the 6 km walk D+ as explicit gaps instead of inferred values.
- Event organizer details are common defaults. Bib pickup stores `bibPickup.locations[]`, each containing one canonical/geocoded address and `slots[]` with date, start time, and end time; the legacy `location`, `locationDetails`, and free-text `schedule` fields remain compatibility fallbacks. Bib pickup, equipment, and access are inherited until a format enables the corresponding complete override in `races.organizer_details`.
- Event equipment is inherited unless race JSON explicitly sets `mandatoryEquipment.overrideEnabled = true`. An explicit `false` wins over stale race items; only historical JSON where the flag is absent may infer an override from those differences.
- Mobile Racebook uses those common defaults as runner-facing event data only through an explicit read-only contract in `apps/mobile/lib/racebook.ts`; `racebook_preview_is_visible = true` is always required, ordinary access additionally requires live course state and `racebook_is_live = true`, and active event membership may bypass only the publication flag. Actual non-ravito organizer content remains mandatory. An emergency phone satisfies that content gate and opens through `tel:`; the official website, Instagram, Facebook, and emergency contact are exposed only as conditional actions inside the identity card. Social links alone do not unlock an otherwise empty Racebook.
- Mobile RaceBook product analytics attach the stable public `race_events.id` and `races.id` to successful open and engagement events so internal reporting can compare formats and same-format return visits. These client events add no table, RLS policy, organizer-visible counter, or new public database field.
- Organizer event PNG uploads write to the public `race-images` bucket through a service route, then patch `thumbnail_url`; organizers should not write directly to Storage from client code.
- Mobile catalog groups event races and also displays standalone races with no event. Its nested event relation is explicitly inner-filtered to live formats, so hidden editions do not leak rows and events with no visible format do not render empty cards. After a confirmed favorite mutation, it emits `race favorite updated`; additions also scroll to the event's new pinned position and show a short success toast.
- Web catalog grouping is edition-aware: one event-edition card contains its currently filtered formats, legacy rows without an edition fall back to an event-only group, standalone race rows remain independent, and every format retains its canonical detail link.
- Guided Plan and RaceBook onboarding reuse the ordinary mobile catalog route and its `RaceEventSummaryCard`. RaceBook guidance requires a two-character in-memory search, keeps only child formats that pass the ordinary runner `canShowRacebook` gate, and removes plan creation from that sheet; it adds no database assumption or visibility exception.
- Mobile catalog root actions are presentation-only and do not change the observed event grouping query shape.
- Mobile Racebook presentation keeps access locations and bib values responsive, groups bib pickup by location and then by day, shows each pickup address without a redundant numbered location heading, and caps its visible text at two lines with a trailing ellipsis while preserving the complete stored address and accessible Maps-link label. It stacks same-day ranges beneath one localized short weekday/day/month label with locale-specific hours. In `Accès`, the existing JSON contract is only reorganized: notes and enabled restrictions appear first, equal start/finish labels collapse into one location, map URLs become labeled actions, and parking/navette rows start collapsed with shuttle schedules separated on expansion. Organizer edits the same fields in matching visual groups, so no database migration is required. The identity card's flexible metadata row uses calendar/location icons, dot separators, and compact `Solo` and/or `Relais` badges, with two badges for mixed formats. A format date distinct from `race_events.race_date` is emphasized as a localized `Jour de course :` / `Race day:` calendar row in the identity card. Saved parking, shuttle, road-restriction, and map values remain hidden unless their corresponding format-level access flags are enabled, while populated event services move into a fifth tab that is absent when no service detail exists. The `Course` tab keeps schedule essentials above `Tracé`, `Ravitos`, and conditional `Relais` sub-tabs; its ravito list uses one-open-at-a-time rows whose collapsed summaries retain distance, services, segment D+/D-, and optional cutoff before revealing products, notes, and labeled details. This presentation split changes no event query or storage contract. The identity conditionally exposes official website, Instagram, and Facebook links as accessible icon-only outlined actions beside the race name and the emergency phone below a divider; the emergency row keeps `Urgence - nom - téléphone` on one line beside a localized outlined call action. Pull-to-refresh repeats the existing read-only event, format, route, profile, and ravito reads so newly published organizer data appears without restarting the app.
- Each populated event service field is displayed as plain text in its own localized titled card inside the conditional mobile Racebook `Services` tab; this is presentation-only and does not change `organizer_details` storage.
- The compact mobile RaceBook loader, its animated runner trail, unified two-slot sponsor panel, temporary navigation chrome hiding, and pre-navigation sponsor warmup are presentation-only; they do not change the event read, visibility gate, or `organizer_details` contract. The warmup reuses the same authorized sponsor API result through an ephemeral account/race key and adds no event query field.
- That loader waits for the lightweight edition response before revealing content, so a slow request cannot freeze one format on default module visibility or colors while sibling formats use the published edition settings.
- The post-load automatic sponsor carousel is also presentation-only: viewport-sized slides rotate edition-scoped sponsors without changing event grouping, queries, or visibility.
- Relay display is format-scoped: the Racebook reads `races.participation_mode` and published `race_relay_points`, then derives legs inside the conditional `Relais` course sub-tab without changing event or nutrition data.
- Visual identity is edition-scoped rather than event-scoped. Mobile resolves the published colors through the format's edition while keeping the event name/content contract unchanged; edition-logo data is retained but currently masked by the shared presentation flag.
- Event thumbnails can be copied from the first related race by `20260331000000_add_thumbnail_to_race_events.sql`.

## Racebook Identity Presentation

For the read-only mobile Racebook, render `races.race_date` as the compact calendar metadata beneath the race name rather than the event date range. Keep that metadata compact with calendar/location icons, dot separators, and participation badges. The emergency contact phone remains a normalized `tel:` action value: the card displays only the emergency label and optional name beside the localized outlined call action.

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

The organizer service routes additionally embed narrow child projections and map them to per-format/edition completion summaries; they do not expose the nested editable rows in their response.

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

Future geographic catalog reads should select only the required safe fields and filter by stable codes:

```sql
select id, name, location, location_city, location_department,
       location_region, location_country_code,
       location_latitude, location_longitude
from public.race_events
where is_live = true
  and location_country_code = 'FR'
  and location_region_code = '84';
```

## Gotchas

- Publication origin is edition-scoped rather than event-scoped. Admin, Offert, Stripe, and virement changes must target the selected canonical edition and do not rewrite the parent event.

- Organizer bootstrap and event-detail reads must include all three nested format visibility flags. Masked/private formats use `is_live = false`; preview false/true distinguishes a format absent from the mobile app from a runner-visible course format. Private formats support plan creation for runners, while only active organizers receive the dimmed functional RaceBook preview. Both remain editable in the authorized web workspace.
- Organizer payment invalidation must hide attached RaceBooks through edition rights without setting `race_events.is_live = false`; the event remains in free catalog discovery.
- Public RaceBook snapshots are tagged by event as well as race and edition. Event metadata/image/live-state changes invalidate that event tag after the write, while private organizer previews remain uncached.

- Keep event bib pickup as the default source. A format-level pickup is active only when `overrideEnabled` is explicitly true; absent/false values preserve the event fallback, and the format variant does not require geocoded metadata.

- Treat this table as live-schema-dependent until its create migration is found.
- Keep public web selects explicit. Do not expose `organizer_details`, ownership, membership, or other operational fields through the SEO catalog without a deliberate runner-facing contract.
- The deliberate public detail exception must stay server-only and sanitize parsed organizer details before rendering; never forward raw JSON, emergency contacts, last-minute messages, or private GPX identifiers.
- Never let a slug redirect bypass event visibility. A mapping under a hidden parent must resolve as not found until that event is public again.
- Do not add docs that claim exact constraints for `race_events` without verification.
- Code paths are real even though migration provenance is incomplete.
- Keep shared mobile event-row UI changes separate from race event query or schema changes.
- Do not group web catalog formats by `race_events.name`; two different event ids may legitimately share a display name, and different editions of one event must stay separate when `edition_id` exists.
- Do not use `races.created_by` to represent event organizer ownership for claimed public events.
- Organizer events remain public catalog rows independently from the admin Racebook publication review.
- Do not set `race_events.is_live = false` to hide one edition; that would hide every year. Use the edition visibility route, which scopes changes to attached formats.
- Keep favorites event-scoped. Organizer updates always retain an event id and may additionally carry a child format id for title and navigation context.
- Keep the event-level catalog query narrow even with update previews: mobile should embed only the short recent history needed for instant sheet rendering, not the full announcement archive for every event.
- Deleting a manual announcement is an organizer-history action scoped by event membership; it must not mutate the parent event, its formats, or its favorite audience.
- Do not include `organizer_details` in public/mobile event queries unless the runner-facing contract is explicitly designed. The current exception is the live-format mobile Racebook flow, which still stays hidden for aid-station-only formats.
- Treat the emergency contact phone as published operational information: keep it inside the Racebook contract, normalize French values to `+33 X XX XX XX XX` on web parsing and mobile compatibility reads, and remove separators from the `tel:` action value.
- The organizer phone preview can render a local event/format draft but has no call, social, website, Maps, analytics, or public-route adapter. It therefore does not broaden the published event/RaceBook contract.
- Keep website and social fields as validated HTTP(S) URLs. The shared parser may add `https://` only when the entered value is already a valid domain link; it must not turn arbitrary text into a URL.
- Organizer event/race mutation routes cannot set catalog live state. Organizer checkout requires event name/location, the selected edition range, and at least one complete format; an active edition RaceBook or Pro entitlement then permits publishing each complete Racebook without admin review.
- Organizer format visibility is an explicit three-state exception to independent catalog/RaceBook flags: masked is false/false/false, private is false/true/false, and public is true/true/true for `is_live` / preview / RaceBook live. Other code must not infer one flag from another outside this transition contract.
- Do not infer organizer write authorization from edition age; `/api/organizer/events/[id]` and child mutation routes rely on active event membership for past and future editions.
- Event deletion must collect edition sponsor logo paths before the edition cascade, then remove those `race-images` objects after the database delete succeeds.
- Event deletion must also collect draft and published edition-branding logo paths before the cascade and remove each distinct unreferenced object afterward.
- Do not store per-format equipment, dossard, or access differences on the event row; keep them in `races.organizer_details` behind their explicit override flags.
- Stored format `runnerInfo` values remain in `races.organizer_details`, but mobile exposes them only while the format access override and runner-info section flag are both enabled.
- Do not move the canonical event location text out of `race_events.location`; geocoded location JSON is additive metadata for preview/navigation only.
- Do not infer city, department or region from `location` at read time. Unnormalized rows stay outside exact geographic filters until a trusted source populates their explicit fields.
- A country-only international row is intentional partial enrichment, not a failed commune lookup. Do not expose it in city/region/nearby filters until its anchor and stable locality identifiers are verified.
- Use territory-specific ISO country keys where they exist; TransLantau is catalogued under Hong Kong (`HK`), not mainland China (`CN`).
- Do not treat an anchor-city coordinate as course geometry or exact road distance. Nearby-city discovery is approximate until a dedicated geospatial route model exists.
- Do not edit the legacy event date fields as canonical organizer dates; update `race_event_editions` and let its trigger mirror the current range.
- Keep image upload validation in the server route; the database stores only the resulting URL.
- Keep admin organizer review tolerant of missing yearly-edition joins: a failed `race_event_edition_requests -> race_events` read should not prevent the base event-claim review data from loading.
- Keep the full event list used by direct organizer assignment behind the admin service route; do not expose draft events through a public or ordinary authenticated selector.
- Keep generic website crawling bounded to prioritized same-origin pages. External registration, social, and activity-platform links are source references, not additional event pages to crawl into the `race_events` preview.
- Treat organizer-supplied `additionalUrls` as sources to classify, not authoritative candidates. Registration, results/archive, other, and unusable roles may appear in the audit but cannot create a format or event-field claim. Legacy one-pass `formatUrls` input remains a compatibility exception inside the parser.
- Expired import sessions cascade with event deletion, but normal cleanup must remove their temporary Storage objects before deleting session rows.

- The membership rule has one server-verified admin exception. Do not turn the complete Organizer selector into an unfiltered authenticated or public `race_events` read.

## Related Docs

- [Schema Overview](../schema-overview.md)
- [Relationships](../relationships.md)
- [race_slug_redirects](race-slug-redirects.md)
- [GPX Import](../../03-business-rules/gpx-import.md)
- [Mobile App](../../01-architecture/mobile-app.md)
