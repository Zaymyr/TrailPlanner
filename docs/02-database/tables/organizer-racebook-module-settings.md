---
title: organizer_racebook_module_settings
scope: database
last_verified: 2026-09-11
ai_priority: high
related_files:
  - supabase/migrations/20260908093008_add_organizer_offer_modules_v2.sql
  - supabase/tests/organizer_racebook_module_settings_checks.sql
  - apps/web/lib/organizer-modules.ts
  - apps/web/lib/organizer-module-settings.ts
  - apps/web/app/api/organizer/editions/[id]/module-settings/route.ts
related_tables:
  - race_event_editions
  - races
  - organizer_edition_entitlements
---

# `organizer_racebook_module_settings`

Format-level private-demo visibility is deliberately not another module setting. It lives on `races.racebook_preview_is_visible`, can be changed without an entitlement, and excludes the entire format from both organizer preview and the next edition publication without deleting any module content.

## Purpose

Stores the organizer's durable enable/disable choice for optional RaceBook modules without storing or deleting module content.

## Columns and Scope

`edition_id`, optional `race_id`, `module_key`, `is_enabled`, `configured_by` and audit timestamps are stored. Edition keys are `equipment`, `bib_pickup`, `access`, `services`, `branding`, `sponsors`. Race keys are `aid_stations`, `start_waves`, `awards`, `relay`, `official_products`.

Partial unique indexes enforce one edition setting per edition/key and one race setting per race/key. A trigger rejects a `race_id` outside `edition_id` and maintains `updated_at`.

## Security and Effective State

RLS is enabled and all `anon`/`authenticated` table privileges are revoked. Only service-role organizer routes read or mutate settings. Public structured-content RLS calls a narrow security-definer boolean helper that combines publication, active entitlement, minimum tier and enabled setting.

The organizer UI stages switch changes locally and sends them together. After membership, edition ownership, and format parentage checks, the route performs the independent row mutations concurrently and returns one refreshed payload; no tier check blocks enabling a module as a private draft.

Authoring state is `is_enabled`; effective public state is `is_enabled AND offer allows module AND RaceBook is published`. A downgrade therefore masks content without deleting it. Mobile receives only the effective map from the RaceBook bootstrap API, never raw settings or entitlement rows.

The adjacent SQL checks also protect the bulk publication boundary: selected private formats must become catalog/RaceBook live without requiring prior catalog liveness. This does not change module scope or expose raw settings.

## Initialization and Duplication

New editions enable equipment, bib and access; new formats enable aid stations. Existing editions are backfilled with those defaults, optional modules are enabled when durable content exists, and setup is marked complete. Edition duplication copies common settings and each cloned format's settings. The optional-content backfill names its lateral `UNION` output `module_key` explicitly so the migration remains portable and deployable.

## Gotchas

- Equipment, bib and access overrides are not separate format modules.
- Never grant direct client access to this table.
- Never delete content when `is_enabled` becomes false.
- Never create an entitlement merely because an organizer enables or fills a higher-tier draft module.
- Keep batched mutation failures visible to the organizer and retain the browser draft for retry; a slow request must not look like an unresponsive switch.

## Related Docs

- [Organizer Commercial Offers](../../03-business-rules/organizer-commercial-offers.md)
- [race_event_editions](race-event-editions.md)
