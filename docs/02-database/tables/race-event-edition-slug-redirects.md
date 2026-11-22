---
title: race_event_edition_slug_redirects
scope: database
last_verified: 2026-11-22
# Event hubs (2026-11-22): edition pages canonicalize to the permanent event hub; edition and event slugs are kept disjoint by the triggers. Redirect resolution unchanged.
# Livret supporter note (2026-11-16): the public name of the supporter_guide surface is now "Livret supporter" (formerly "Livret accompagnateur"); aid-station access wording ("Accompagnateurs autorisés") is unchanged; no data, contract or offer change.
ai_priority: high
related_files:
  - supabase/migrations/20261113200326_add_race_event_edition_slugs.sql
  - supabase/tests/race_event_edition_slug_redirects_checks.sql
  - apps/web/lib/public-race-events.ts
  - apps/web/lib/public-race-events.test.ts
  - apps/web/app/courses/evenements/[slug]/page.tsx
  - apps/web/app/courses/evenements/[slug]/event-edition-status.ts
  - apps/web/app/courses/evenements/[slug]/event-edition-status.test.ts
  - supabase/migrations/20261122210000_add_race_event_slugs_and_region_codes.sql
related_tables:
  - race_event_edition_slug_redirects
  - race_event_editions
  - race_events
  - races
---

# `race_event_edition_slug_redirects`

## Purpose

This table preserves former public event-edition slugs so inbound links can permanently redirect to the current `/courses/evenements/[slug]` URL without redirect chains.

## Contract

- `old_slug` is the lowercase, hyphen-separated primary key and remains reserved.
- `edition_id` targets the stable `race_event_editions.id` with `on delete cascade`.
- The edition update trigger records the previous slug in the same transaction.
- `rename_race_event_edition_slug(uuid, text)` normalizes and validates the new value, locks the edition, and relies on the trigger to create the redirect.
- Repeated renames retain every old slug against the edition id, so resolution jumps directly to the current canonical slug.

## Access

RLS is enabled with no `anon` or `authenticated` policy or table privilege. Only `service_role` may select or mutate rows and execute the `SECURITY INVOKER` rename function. The server route exposes no redirect row: it reloads the current edition, requires a live parent event and at least one web-public format, then returns a permanent redirect.

## Gotchas

- Do not reuse this table for format URLs; `race_slug_redirects` owns that independent namespace.
- Do not grant client reads merely because the route is public. The service resolver is the reviewed boundary.
- Do not update an edition slug from a browser or bypass the atomic rename function.
- Event-edition resolution participates in the shared tagged public cache. Successful source, publication, visibility, image, and ravito writes invalidate that cache; the redirect table contract itself is unchanged.
- The 2026-11-16 event-page redesign (shared hero, distance-sorted format list, `@id`-only `subEvent` references) is presentation and JSON-LD only: slug resolution, redirect-before-render and visibility rechecks are unchanged.
- Event hubs (2026-11-22): `/courses/evenements/<event-slug>` (`race_events.slug`) shares this route. The route resolves the current edition slug, then a former edition slug (301 to the current edition slug, never to the hub), then the event hub. `20261122210000` replaced `record_race_event_edition_slug_redirect` with the same logic plus a check that an edition slug never equals an event slug (generated slugs get the id suffix, explicit renames fail with 23505). Edition pages now canonicalize to the hub when the event has one; they still return 200, so no existing URL breaks.
- Past edition pages may link to the next public edition. Only the Trail TST demo editions are `noindex,follow` and absent from the sitemap (2026-11-22); they still resolve through the same slug and redirect rules. The current demo edition keeps its durable slug `trail-tst-2027` even though its `edition_year` follows today's date: renaming it would only add a redirect row. This navigation uses the current canonical slug of each edition and never creates a redirect chain.

## Related Docs

- [race_event_editions](race-event-editions.md)
- [race_slug_redirects](race-slug-redirects.md)
- [Public Race Discovery](../../03-business-rules/public-race-discovery.md)
- [RLS Checklist](../../04-auth-and-security/rls-checklist.md)

Follow-page loading (2026-11-16): the event page now reads the public Livret supporter through the cached public endpoint (see public-race-discovery); slug resolution and redirects are unchanged.

The canonical event-edition page title is built by `buildEventEditionMetadataTitle` (`Event Year` plus the longest suffix fitting 60 characters). Redirect resolution is unchanged.
