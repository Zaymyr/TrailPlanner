---
title: Public Race Discovery
scope: business-rule
last_verified: 2026-09-03
ai_priority: high
related_files:
  - supabase/migrations/20260824164101_manage_organizer_edition_visibility_and_deletion.sql
  - supabase/migrations/20260828161008_add_race_slug_redirects.sql
  - supabase/tests/race_slug_redirects_checks.sql
  - apps/web/lib/public-races.ts
  - apps/web/lib/public-race-detail.ts
  - apps/web/lib/public-race-detail.test.ts
  - apps/web/lib/race-discovery.ts
  - apps/web/app/courses/page.tsx
  - apps/web/app/courses/[slug]/page.tsx
  - apps/web/app/courses/_components/RaceCatalogFilter.tsx
  - apps/web/app/courses/_components/PublicRaceLinks.tsx
  - apps/web/app/courses/_components/PublicRaceShare.tsx
  - apps/web/app/courses/_components/PublicElevationProfile.tsx
  - apps/web/app/courses/_components/RaceHeroSummary.tsx
  - apps/web/app/courses/_components/RaceMetricsDetails.tsx
  - apps/web/app/courses/_components/RaceRouteExplorer.tsx
  - apps/web/app/courses/_components/RaceAidStationsTimeline.tsx
  - apps/web/components/ui/accordion.tsx
  - apps/web/app/courses/PublicRaceShare.test.ts
  - apps/web/app/courses/distances/[category]/page.tsx
  - apps/web/app/courses/race-discovery.test.ts
  - apps/web/lib/public-races.test.ts
  - apps/web/app/courses/[slug]/page.test.ts
  - apps/web/app/courses/[slug]/race-metadata.ts
  - scripts/audit-public-race-slugs.mjs
  - scripts/audit-public-race-slugs.test.mjs
related_tables:
  - race_events
  - races
  - race_slug_redirects
---

# Public Race Discovery

## Purpose

This document defines which public race pages Pace Yourself may expose to search engines and how the catalog creates useful internal links without inventing missing race facts.

## Key Concepts

- Public race: a `races` row where both `is_live` and `is_public` are true.
- Visible edition: a `race_event_editions` row whose `is_visible` flag permits its complete formats to keep `races.is_live = true`.
- Event edition format: another public race attached to the same non-null `event_id + edition_id`; legacy rows without an edition fall back to `event_id`.
- Similar race: a race from another event ordered by distance difference, then elevation difference when both elevations exist.
- Indexable selection: a deterministic landing page based only on structured fields and containing at least five public races.
- Normalized geography: explicit country, region, department and city fields, not a region guessed from `location` or `location_text`.
- Former slug: a durable `race_slug_redirects.old_slug` mapping to the stable race id.

## Public Race Detail Pages

Each current public slug resolves to `/courses/[slug]`. A known former slug reloads the target through the same current visibility checks, emits canonical metadata for the current URL, then returns a permanent redirect. Unknown mappings and targets that are no longer public remain not found and noindex.

The lightweight `PublicRace` catalog contract contains identity, `eventId`, `editionId`, format/event image URLs, date, location, distance, D+, slug and format official URL. The separate server-only `PublicRaceDetail` read rechecks `races.is_live`, `races.is_public`, the optional parent `race_events.is_live`, and the optional `race_event_editions.is_visible` before reading organizer details, ravitos, or the private GPX. It maps only the runner-facing fields required by the page and never serializes either raw organizer JSON object. In particular, the event emergency contact and `services.lastMinuteMessage` are excluded from the DTO even when present in the stored event data.

The detail page applies the established event/format inheritance parser for schedule, equipment, bib pickup, access, runner information and services. It exposes only available values, D+/D-, altitude bounds, participation mode, ravitos, format then event official websites, and event social profiles. It must not generate course difficulty, expected duration, weather, aid-station values, or other claims from absent source data.

When a private GPX object exists, the server downloads and parses it only after every visibility gate succeeds. The browser receives a bounded route/elevation preview of about 600 points, never the GPX file or Storage path. Invalid or absent GPX degrades to a detail page without map/profile, and the public page offers no GPX download action.

The page exposes `SportsEvent` and `BreadcrumbList` structured data using only confirmed facts. Open Graph and Twitter use the format image first, the event image second, and the shared Pace Yourself social image last. SEO titles are capped at 60 characters and include the confirmed race year when it is not already present; descriptions are capped at 160 characters. It links to:

- other published formats sharing the same event edition, with the legacy event-only fallback when `edition_id` is absent;
- up to three published races from other events with the nearest distance, using elevation only as a tie-breaker;
- the planner at `/race-planner?catalogRaceId=<race-id>` and the carbohydrate calculator;
- distinct format/event official sources and available official event social profiles.

Sharing uses the native Web Share sheet when available, which lets installed mobile apps such as Instagram participate. Facebook remains a direct action, copy is always explicit, and the main action falls back to copy when Web Share is unavailable. Native cancellation does not trigger a surprise copy. Missing Clipboard support falls back to the browser copy command and reports success/failure through an accessible live status.

## Catalog Event Grouping

The `/courses` catalog groups published formats by stable non-null `event_id + edition_id`. Historical rows with an event but no edition fall back to `event_id`; a display name is never an identity and two homonymous events remain separate. Each standalone race with no event id stays in its own card. Formats are ordered by numeric distance with unknown values last.

The default temporal filter contains upcoming/current formats followed by undated formats. Past formats are available separately and sorted newest first; the `Toutes` view keeps upcoming, undated, then past. Search is accent-insensitive and combines with distance and temporal filters. Visible result counters and a reset action describe the active state.

Filtering happens before grouping, so an event-edition card disappears when none of its formats matches. Every visible format remains a normal HTML link to `/courses/[slug]`. Event-edition cards use the shared event image and year/date where available; standalone formats use their own image. A format image remains the first detail-page image choice. Missing images reserve no empty visual area. The responsive card layout stacks at narrow widths, keeps controls at least 44 px high and avoids horizontal tables.

The catalog emits an `ItemList` for all published format URLs. Client filters do not create crawlable combinations and do not change canonical URLs.

## Prefiltered Landing Pages

Distance pages use three mutually exclusive structured ranges:

- `trail-court`: less than 30 km;
- `trail-30-79-km`: at least 30 km and less than 80 km;
- `ultra-trail`: at least 80 km.

A page is generated and indexable only while at least five public races have a numeric distance in its range. Below that threshold it is omitted from generated parameters, navigation and metadata indexation, and the route returns not found.

## Geographic Landing-Page Guardrail

The current public race contract exposes only free-text `location` and `location_text`. Repository migrations do not define normalized race country, region or department columns. Therefore no indexable regional or departmental landing page may be generated from the current data.

Before regional pages are enabled, the schema and publication workflow must provide explicit normalized geographic fields. Each geographic landing page must then apply the same minimum-content threshold and include only races whose normalized value exactly matches the page key. Text parsing, postal-code guesses and city-to-region lookup at render time are not acceptable sources of truth.

## Slug Stability

Existing race slugs remain canonical until a rename is explicitly approved. The durable mapping and permanent redirect contract now exists: the database trigger records every former slug against the stable race id, and the web route resolves directly to the current canonical slug without redirect chains.

`scripts/audit-public-race-slugs.mjs` is the review-only preparation step. It reads published catalog data with an anon/publishable key, refuses elevated keys, reports technical slugs and deterministic French-readable proposals, resolves candidate collisions with location then a stable id suffix, and performs zero writes. A proposal is not authorization to rename; approved changes must use the service-only atomic RPC after the migration is deployed.

## Gotchas

- Public course discovery continues to use `races.is_live` / `races.is_public` and live parent events. `races.racebook_is_live` controls only the mobile runner Racebook and must not remove an otherwise published course from SEO/catalog pages.
- Hiding an edition is the deliberate exception: the database forces every attached `races.is_live` and `racebook_is_live` flag false, so that year's course pages disappear without hiding other editions of the event. Re-showing restores only complete course rows and not their Racebook flags.

- Do not count races with missing distance toward a distance landing page.
- Do not present another format from the same event as a similar independent race.
- Do not group catalog rows by `eventName`, course name, or location; only stable `eventId + editionId`, with the documented legacy `eventId` fallback, may merge formats.
- Do not serialize raw organizer JSON, emergency phone data, `lastMinuteMessage`, GPX Storage paths, or full GPX content into public client components.
- Similarity is a navigation aid, not a statement that courses have comparable terrain or difficulty.
- Do not expose a thin landing page merely because its URL pattern exists; the five-race threshold is part of the indexation contract.
- Do not derive regions or departments from display-location strings.
- Keep all public queries restricted to explicit columns and published rows.
- Never reuse a former slug for another race. It remains reserved in `race_slug_redirects` while the target race exists.
- Do not run a slug migration from the dry-run script; it deliberately has no write path.

## Related Docs

- [Web App](../01-architecture/web-app.md)
- [race_events](../02-database/tables/race-events.md)
- [race_slug_redirects](../02-database/tables/race-slug-redirects.md)
- [Organizer Race Management](organizer-race-management.md)
