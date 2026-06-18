---
title: Organizer Race Management
scope: business-rule
last_verified: 2026-06-18
ai_priority: high
related_files:
  - supabase/migrations/20260528120000_add_organizer_portal.sql
  - supabase/migrations/20260618120000_add_race_aid_station_service_flags.sql
  - supabase/tests/organizer_rls_checks.sql
  - apps/web/lib/organizer.ts
  - apps/web/app/organizers/page.tsx
  - apps/web/app/organizer/page.tsx
  - apps/web/app/admin/_components/AdminOrganizerClaimsTab.tsx
  - apps/web/app/api/organizer/claims/route.ts
  - apps/web/app/api/organizer/claims/route.test.ts
  - apps/web/app/api/admin/organizer-claims/route.ts
  - apps/web/app/api/admin/organizer-claims/route.test.ts
  - apps/web/app/api/organizer/events/[id]/route.ts
  - apps/web/app/api/organizer/races/route.ts
  - apps/web/app/api/organizer/races/[id]/route.ts
  - apps/web/app/api/organizer/races/[id]/gpx/route.ts
  - apps/web/app/api/organizer/races/[id]/aid-stations/route.ts
  - apps/web/app/api/organizer/races/[id]/aid-stations/route.test.ts
  - apps/web/app/api/organizer/races/[id]/aid-station-products/route.ts
  - apps/web/app/api/plans/from-catalog/route.ts
  - apps/web/app/api/plans/from-catalog/route.test.ts
  - apps/web/app/(coach)/race-planner/RacePlannerPageContent.tsx
  - apps/web/components/race-planner/ActionPlan.tsx
related_tables:
  - race_event_claims
  - race_event_organizers
  - race_aid_station_products
  - race_events
  - races
  - products
---

# Organizer Race Management

## Purpose

This document records the v1 web-only organizer portal rules: users can request control of an existing event or submit a missing event as a draft, admins validate the claim, and approved organizers manage event formats, GPX files, aid stations, and products offered at aid stations.

## Key Concepts

- Organizer account: a normal Supabase user account.
- Claim: a user request to manage a `race_events` row, including draft non-live rows created from manual organizer submissions.
- Event membership: approved organizer access stored in `race_event_organizers`.
- Format: one `races` row under an event.
- Source data: organizer edits update `race_events`, `races`, and `race_aid_stations`.
- Runner snapshot: already-created `race_plans` stay unchanged when source race data changes.

## Claim and Approval Flow

`/organizers` lets an authenticated user search live events and create a claim with organization name, role, contact email, official site, and message. If the event is missing from the catalog, the same route can create a draft `race_events` row with `is_live = false`, then create a normal pending claim against that event id.

Admin review happens in the web admin "Organisateurs" tab:

1. Admin approves a pending claim.
2. The claim becomes `approved`.
3. A `race_event_organizers` row is created or reactivated for the claim user and event.
4. The organizer dashboard can load that event.

Rejecting a claim stores review metadata and does not grant membership. Revoking access sets `revoked_at` on the membership and blocks future organizer writes.

## Organizer Dashboard Rules

`/organizer` is web-only in v1. It shows states for no request, pending request, rejected request, and approved dashboard.

Approved organizers can:

- edit event-level name, location, date, site, image, and notes where supported by live schema;
- edit existing race formats under the event;
- add a new format as a new `races` row with `created_by = null`, `is_public = true`, and `is_live = true`;
- replace a format GPX source in `race-gpx`;
- edit source `race_aid_stations`, including `waterRefill`, `solidRefill`, and `assistanceAllowed` service flags;
- attach existing catalog products to a station from a picker that shows product brand, type, image, and nutrition characteristics;
- create non-live organizer-scoped products and attach them to a station.

Organizer access is event-scoped. A claim for one event grants access to every format under that event and no other event.

## GPX Replacement

Replacing a GPX updates the source `races` row and storage object for that format. Existing saved plans remain snapshots: their `plan_gpx_path`, `elevation_profile`, `planner_values`, and `plan_aid_stations` are not automatically rewritten.

When GPX waypoints are present and the format has no aid stations, the organizer GPX route can create source `race_aid_stations` from normalized waypoints. Existing station rows are edited through the aid station route.

Organizer aid station edits should preserve existing station ids when possible so `race_aid_station_products` links survive. New or legacy stations default all service flags to enabled unless an organizer disables water, solid food, or assistance explicitly.

## Organizer Products

Organizer-created products are stored in `products` with:

- `created_by = organizer user`;
- `is_live = false`;
- `is_archived = false`;
- `is_official = false`.

They are linked to stations through `race_aid_station_products`. They are not global catalog products and should not appear in normal product catalog responses.

The organizer ravito timeline opens a catalog-product picker for existing live products instead of relying on an inline select. Link updates may omit `notes` or send `notes = null`; the organizer API normalizes empty station-product notes to `null` before replacing the station links.

When a runner imports a catalog plan, `/api/plans/from-catalog` copies source station service flags into `planner_values.aidStations`, loads station-product links with the service role, and stores those product suggestions in `planner_values.organizerAidStationProducts`. The planner UI displays them as priority suggestions on the matching ravito.

Auto-fill must keep organizer products out of its default product pool. It may use them only after the runner favorites the product or explicitly adds it to start/aid-station supplies.

Planner `assistanceAllowed` is separate from organizer product presence: it says whether the runner's crew can hand over personal products. Organizer suggestions remain official ravito context and should not be treated as crew availability.

## Mobile Scope

No mobile organizer screen exists in v1. Mobile can keep consuming catalog races and plans normally. The schema is ready for a future mobile organizer or runner display, but no mobile UI should assume organizer edit access.

## Gotchas

- Do not use `races.created_by` to authorize claimed public race edits.
- Do not make organizer-created products live just to show them to runners; use planner import suggestions.
- Do not auto-sync existing saved plans after organizer source edits.
- Do not use `user_metadata` for admin claim approval or revocation checks.
- Verify the live `race_events` schema before adding new event-level columns; the create-table migration is not visible in this repo.
- Manual organizer claims create non-live draft events; do not treat those rows as public catalog entries until an admin or organizer publishes the event through the normal event edit flow.

## Related Docs

- [race_event_claims](../02-database/tables/race-event-claims.md)
- [race_event_organizers](../02-database/tables/race-event-organizers.md)
- [race_aid_station_products](../02-database/tables/race-aid-station-products.md)
- [Nutrition Algorithm](nutrition-algorithm.md)
- [GPX Import](gpx-import.md)
