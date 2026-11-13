---
title: race_event_edition_slug_redirects
scope: database
last_verified: 2026-11-13
ai_priority: high
related_files:
  - supabase/migrations/20261113200326_add_race_event_edition_slugs.sql
  - supabase/tests/race_event_edition_slug_redirects_checks.sql
  - apps/web/lib/public-race-events.ts
  - apps/web/lib/public-race-events.test.ts
  - apps/web/app/courses/evenements/[slug]/page.tsx
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

## Related Docs

- [race_event_editions](race-event-editions.md)
- [race_slug_redirects](race-slug-redirects.md)
- [Public Race Discovery](../../03-business-rules/public-race-discovery.md)
- [RLS Checklist](../../04-auth-and-security/rls-checklist.md)
