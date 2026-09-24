---
title: race_edition_services Table
scope: database
last_verified: 2026-09-24
ai_priority: high
related_files:
  - supabase/migrations/20260907160043_add_structured_racebook_content.sql
  - supabase/migrations/20260907170842_fix_structured_racebook_rls_dependencies.sql
  - apps/web/app/api/organizer/editions/[id]/services/route.ts
  - apps/web/lib/organizer-structured-content.ts
  - apps/web/app/organizer/_components/dashboard/structured-content-editors.tsx
  - apps/web/app/organizer/_components/dashboard/structured-content-editors.test.ts
  - apps/mobile/lib/racebook.ts
  - apps/mobile/lib/fetchWithTimeout.ts
  - apps/mobile/app/(app)/race/[id]/racebook.tsx
  - apps/mobile/components/racebook/RacebookServicesSection.tsx
related_tables:
  - race_edition_services
  - race_event_editions
---

# `race_edition_services`

## Purpose

Stores ordered, structured restaurants, accommodation, recovery and other nearby services shared by every format of an annual edition.

## Contract

- `service_type` is `restaurant`, `accommodation`, `recovery` or `other`.
- `name` is always required. Restaurant and accommodation rows also require an address and a complete latitude/longitude pair.
- Website and Google Maps values are URLs; phone remains display-oriented text.
- The organizer API replaces the list atomically through `replace_race_edition_services`, preserving submitted ids.
- Deleting the edition cascades to its services. Edition duplication copies the rows with new ids.

The shared web editor file also reports SAS count and earliest time to the format schedule card. That start-wave callback does not change this edition-scoped service contract.

## Access

The Organizer section chooser lists this setting under edition-common sections, making explicit that one switch applies to every format attached to the selected canonical edition.

Service draft writes require membership plus a selected edition `services` module. Complete or Signature is required only for public/mobile visibility. Disabling or downgrading masks rows without deleting them.

Public reads follow the visible, published RaceBook edition. Authorized event organizers can preview rows. Clients cannot mutate the table directly; the service-role Organizer API checks membership and `racebook_content.manage`.

Legacy `organizer_details.services` text remains untouched. Mobile prefers structured rows per matching category and falls back to that category's legacy text only when no structured row exists. Edition accent surfaces remain decorative and do not alter service categories or content.

The structured collection is additive on mobile. A temporary Data API/table-unavailable error falls back to the preserved legacy services instead of making the complete RaceBook unavailable. Public and organizer-preview policies find the parent edition through `races`, avoiding a direct client-policy dependency on service-role-only `race_event_editions`.

The two-line clamp applied to bib-pickup address text is isolated from service-card rendering and does not change service addresses or links.

The RaceBook route keeps structured service normalization, distance approximation, link construction and analytics callbacks. `RacebookServicesSection` owns only the grouped mobile presentation and receives normalized rows, resolved theme, explicit copy and URL callbacks.

A sponsor configured for the `services` contextual placement renders after this section in the shared compact, unframed tiered-row surface. That aggregate presentation and its impression counter do not change service rows, categories, links, or visibility.

The format access override that hides saved runner information is likewise independent from edition service rows and their visibility.

The Organizer editor serializes revisioned autosaves: a response for an older revision cannot replace newer local service edits and instead queues the latest revision. Masking a format from the private demo suppresses its whole RaceBook entry without deleting edition service rows.

Published rows travel in the consolidated RaceBook CDN snapshot. A successful services replacement invalidates the edition tag after persistence.

The 2026-09-14 iOS accessibility pass changes only mobile input, gesture, and motion presentation; structured service rows, links, visibility, and API/RLS contracts remain unchanged.

When effective service content exists, Services appears directly in the RaceBook contextual bottom bar. Its filled icon and color-only active state align with the global navigation; the hero's emergency presentation, focus-time scroll reset, and route-replacing Courses exit remain independent, and the same edition-scoped visibility, fallback, and action contracts apply.

Service-category and external-action icons now use the published accent surface/graphic variants. This changes no service field, visibility rule, or URL, and personal equipment checks remain isolated in `racebook_gear_checks`.

Per-format GPX map/profile choices affect only the `Tracé` cards and do not change edition-scoped services or their conditional tab.
