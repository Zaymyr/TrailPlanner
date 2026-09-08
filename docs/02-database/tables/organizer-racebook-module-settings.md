---
title: organizer_racebook_module_settings
scope: database
last_verified: 2026-09-08
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

## Purpose

Stores the organizer's durable enable/disable choice for optional RaceBook modules without storing or deleting module content.

## Columns and Scope

`edition_id`, optional `race_id`, `module_key`, `is_enabled`, `configured_by` and audit timestamps are stored. Edition keys are `equipment`, `bib_pickup`, `access`, `services`, `branding`, `sponsors`. Race keys are `aid_stations`, `start_waves`, `awards`, `relay`, `official_products`.

Partial unique indexes enforce one edition setting per edition/key and one race setting per race/key. A trigger rejects a `race_id` outside `edition_id` and maintains `updated_at`.

## Security and Effective State

RLS is enabled and all `anon`/`authenticated` table privileges are revoked. Only service-role organizer routes read or mutate settings. Public structured-content RLS calls a narrow security-definer boolean helper that combines publication, active entitlement, minimum tier and enabled setting.

The effective state is `is_enabled AND offer allows module`. A downgrade therefore masks content without deleting it. Mobile receives only the effective map from the RaceBook bootstrap API, never raw settings or entitlement rows.

## Initialization and Duplication

New editions enable equipment, bib and access; new formats enable aid stations. Existing editions are backfilled with those defaults, optional modules are enabled when durable content exists, and setup is marked complete. Edition duplication copies common settings and each cloned format's settings.

## Gotchas

- Equipment, bib and access overrides are not separate format modules.
- Never grant direct client access to this table.
- Never delete content when `is_enabled` becomes false.

## Related Docs

- [Organizer Commercial Offers](../../03-business-rules/organizer-commercial-offers.md)
- [race_event_editions](race-event-editions.md)
