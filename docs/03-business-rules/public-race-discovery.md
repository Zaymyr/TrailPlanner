---
title: Public Race Discovery
scope: business-rule
last_verified: 2026-08-20
ai_priority: high
related_files:
  - apps/web/lib/public-races.ts
  - apps/web/lib/race-discovery.ts
  - apps/web/app/courses/page.tsx
  - apps/web/app/courses/[slug]/page.tsx
  - apps/web/app/courses/_components/PublicRaceLinks.tsx
  - apps/web/app/courses/distances/[category]/page.tsx
  - apps/web/app/courses/race-discovery.test.ts
related_tables:
  - race_events
  - races
---

# Public Race Discovery

## Purpose

This document defines which public race pages Pace Yourself may expose to search engines and how the catalog creates useful internal links without inventing missing race facts.

## Key Concepts

- Public race: a `races` row where both `is_live` and `is_public` are true.
- Event format: another public race attached to the same non-null `event_id`.
- Similar race: a race from another event ordered by distance difference, then elevation difference when both elevations exist.
- Indexable selection: a deterministic landing page based only on structured fields and containing at least five public races.
- Normalized geography: explicit country, region, department and city fields, not a region guessed from `location` or `location_text`.

## Public Race Detail Pages

Each public slug resolves to `/courses/[slug]`. The page may state only facts returned by the explicit public catalog query: name, parent event, date, display location, distance, elevation, thumbnail and official URL.

The page exposes `SportsEvent` and `BreadcrumbList` structured data. It links to:

- other published formats sharing the same `event_id`;
- up to three published races from other events with the nearest distance, using elevation only as a tie-breaker;
- the planner and carbohydrate calculator;
- the official source when one is present.

Missing distance, elevation, location or date stays visibly unconfirmed. The page must not generate course difficulty, expected duration, aid-station details, weather or nutrition claims from absent source data.

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

Existing race slugs remain canonical even when they contain generated suffixes. Renaming one requires a durable old-to-new mapping and a permanent redirect. Without that redirect contract, changing a slug would break indexed URLs and inbound links, so cosmetic slug cleanup is intentionally deferred.

## Gotchas

- Public course discovery continues to use `races.is_live` / `races.is_public` and live parent events. `races.racebook_is_live` controls only the mobile runner Racebook and must not remove an otherwise published course from SEO/catalog pages.

- Do not count races with missing distance toward a distance landing page.
- Do not present another format from the same event as a similar independent race.
- Similarity is a navigation aid, not a statement that courses have comparable terrain or difficulty.
- Do not expose a thin landing page merely because its URL pattern exists; the five-race threshold is part of the indexation contract.
- Do not derive regions or departments from display-location strings.
- Keep all public queries restricted to explicit columns and published rows.

## Related Docs

- [Web App](../01-architecture/web-app.md)
- [race_events](../02-database/tables/race-events.md)
- [Organizer Race Management](organizer-race-management.md)
