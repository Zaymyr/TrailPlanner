---
title: Organizer Race Management
scope: business-rule
last_verified: 2026-06-25
ai_priority: high
related_files:
  - supabase/migrations/20260528120000_add_organizer_portal.sql
  - supabase/migrations/20260618120000_add_race_aid_station_service_flags.sql
  - supabase/migrations/20260618160000_add_organizer_dashboard_details.sql
  - supabase/tests/organizer_rls_checks.sql
  - apps/web/lib/organizer.ts
  - apps/web/lib/organizer-aid-station-products.ts
  - apps/web/lib/organizer-dashboard-details.ts
  - apps/web/app/organizers/page.tsx
  - apps/web/app/organizer/page.tsx
  - apps/web/app/organizer/_components/OrganizerDashboard.tsx
  - apps/web/app/organizer/_components/dashboard/types.ts
  - apps/web/app/organizer/_components/dashboard/constants.ts
  - apps/web/app/organizer/_components/dashboard/helpers.ts
  - apps/web/app/organizer/_components/dashboard/controls.tsx
  - apps/web/app/organizer/_components/dashboard/shell.tsx
  - apps/web/app/organizer/_components/dashboard/event-format-editors.tsx
  - apps/web/app/organizer/_components/dashboard/detail-editors.tsx
  - apps/web/app/organizer/_components/dashboard/aid-stations-editor.tsx
  - apps/web/app/organizer/_components/dashboard/products-editor.tsx
  - apps/web/app/organizer/_components/dashboard/runner-preview-dialog.tsx
  - apps/web/app/organizer/_components/completion.ts
  - apps/web/app/organizer/_components/completion.test.ts
  - apps/web/app/admin/_components/AdminOrganizerClaimsTab.tsx
  - apps/web/app/api/organizer/claims/route.ts
  - apps/web/app/api/organizer/claims/route.test.ts
  - apps/web/app/api/admin/organizer-claims/route.ts
  - apps/web/app/api/admin/organizer-claims/route.test.ts
  - apps/web/app/api/organizer/events/[id]/route.ts
  - apps/web/app/api/organizer/events/[id]/route.test.ts
  - apps/web/app/api/organizer/events/[id]/image/route.ts
  - apps/web/app/api/organizer/events/[id]/image/route.test.ts
  - apps/web/app/api/organizer/races/route.ts
  - apps/web/app/api/organizer/races/[id]/route.ts
  - apps/web/app/api/organizer/races/[id]/gpx/route.ts
  - apps/web/app/api/organizer/races/[id]/gpx/route.test.ts
  - apps/web/app/api/organizer/races/[id]/aid-stations/route.ts
  - apps/web/app/api/organizer/races/[id]/aid-stations/route.test.ts
  - apps/web/app/api/organizer/races/[id]/aid-station-products/route.ts
  - apps/web/app/api/plans/route.ts
  - apps/web/app/api/plans/from-catalog/route.ts
  - apps/web/app/api/plans/from-catalog/route.test.ts
  - apps/web/app/(planner)/race-planner/RacePlannerPageContent.tsx
  - apps/web/components/race-planner/ActionPlan.tsx
related_tables:
  - race_event_claims
  - race_event_organizers
  - race_aid_stations
  - race_aid_station_products
  - race_events
  - races
  - products
---

# Organizer Race Management

## Purpose

This document records the v1 web-only organizer portal rules: users can request control of an existing event or submit a missing event as a draft, admins validate the claim, and approved organizers manage event formats, GPX files, aid stations, products offered at aid stations, and progressive runner-facing organizer details.

## Key Concepts

- Organizer account: a normal Supabase user account.
- Claim: a user request to manage a `race_events` row, including draft non-live rows created from manual organizer submissions.
- Event membership: approved organizer access stored in `race_event_organizers`.
- Format: one `races` row under an event.
- Source data: organizer edits update `race_events`, `races`, and `race_aid_stations`.
- Organizer details: nullable JSONB on `race_events`, `races`, and `race_aid_stations` for progressive dashboard fields that do not yet need normalized tables. Event details are common defaults, including `dateRange.endDate`; race details keep each course's full equipment list plus format-specific overrides or additions for the other modules.
- Runner snapshot: already-created `race_plans` stay unchanged when source race data changes, except that official ravito product suggestions are refreshed into `/api/plans` responses for plans linked to a `race_id`.

## Claim and Approval Flow

`/organizers` lets an authenticated user search live events and create a claim with organization name, role, contact email, official site, and message. If the event is missing from the catalog, the same route can create a draft `race_events` row with `is_live = false`, then create a normal pending claim against that event id.

Admin review happens in the web admin "Organisateurs" tab:

1. Admin approves a pending claim.
2. The claim becomes `approved`.
3. A `race_event_organizers` row is created or reactivated for the claim user and event.
4. The organizer dashboard can load that event.

Rejecting a claim stores review metadata and does not grant membership. Revoking access sets `revoked_at` on the membership and blocks future organizer writes.

## Organizer Dashboard Rules

`/organizer` is web-only in v1. It shows states for no request, pending request, rejected request, and an approved modular dashboard.

Approved organizers can:

- edit event-level name, location, date, PNG image, live state, and common `race_events.organizer_details`;
- edit existing race formats under the event, including format-specific `races.organizer_details`;
- add a new format as a new `races` row with `created_by = null`, `is_public = true`, `is_live = true`, and optional organizer details;
- duplicate a format as metadata-only draft data without copying GPX, ravitos, or station-product links;
- replace a format GPX source in `race-gpx`;
- edit source `race_aid_stations`, including `waterRefill`, `solidRefill`, `assistanceAllowed` service flags, and station-specific `race_aid_stations.organizer_details`;
- attach existing catalog products to a station from a picker that groups products by brand and shows quick fuel-type filters, product image, type, and nutrition characteristics;
- create non-live organizer-scoped products and attach them to a station;
- preview an internal runner-facing summary before a public runner page exists.

The dashboard is organized as a compact top synthesis plus one tabbed completion surface. `OrganizerDashboard.tsx` owns session, API calls, selected event/race/module, dirty state, autosave-before-navigation, and composition; route-local files under `_components/dashboard/` own reusable controls, shell sections, editors, ravito/product blocks, and runner preview. The synthesis uses inline event facts, a small live/brouillon indicator, a publish toggle, and an event completion progress bar with the percentage inside the bar rather than metric cards. The first completion tab is the event scope and shows only fillable event tiles: information, equipment, bib pickup, access, and services. The following tabs are race formats; each format tab shows that format's progress bar and only fillable race tiles: identity/GPX, equipment, access, and ravitos. The old schedule tile is gone: the ravito tile now owns the fixed `Départ` and `Arrivée` cards for `startTime` and `finishCutoffTime`, while `Horaires navettes` lives only in access. Official ravito products are managed inside that ravito module rather than through a separate products tile. Labels stay short because the active tab already provides the scope. Completed tiles get a green outline only when not selected, active tiles use the brand border/fill so the selection remains visible, incomplete tiles list the compact labels of missing fields, tiles stay compact with status, level, title, and count/action only, and changing tabs or modules now attempts an autosave first and blocks the navigation when the save fails.

Equipment, bib pickup, and access are split by tab in the UI, but equipment now has a special sync rule: the event tab edits the shared subset and saving it mirrors those items into every race list; saving a race recomputes the event-level shared subset as the intersection still present across all formats. Bib pickup is now event-only in the UI and runner preview; format-level bib JSON may still exist for compatibility reads, but the dashboard no longer edits or scores it. Access keeps the event-default / format-override model and format access now includes explicit `enabledSections` toggles for parkings, navettes, route restrictions, map link, and runner-specific info. Disabled access sections are treated as intentionally complete in the dashboard score and hidden from the runner preview. The editor must not stack event and race forms in the same tab. The add-format tab can prefill a new format draft from event defaults or the previously active format, but those values become format data only when the organizer creates the new race. Event publishing and format liveness use compact live/brouillon toggles instead of duplicate checkboxes. The dashboard keeps unsaved-change state per module, gives short floating save/error feedback, and warns on `beforeunload` when a module is dirty.

Organizer access is event-scoped. A claim for one event grants access to every format under that event and no other event.

## Publication and Completion Rules

Publishing an event through `/api/organizer/events/[id]` requires:

- event name;
- event location, start date (`race_events.race_date`), and end date (`race_events.organizer_details.dateRange.endDate`);
- at least one live format with a non-empty name, `distance_km > 0`, and `elevation_gain_m >= 0`.

Recommended modules improve the dashboard score but do not block publication: GPX, ravitos, equipment, bib pickup, and access/shuttles.

Optional modules also improve the score but never block publication: ravito products, supporter notes, accommodations/restaurants/recovery, partners, and last-minute messages.

Runner-facing preview resolves details as:

- equipment = common event equipment plus active-format equipment;
- bib pickup = event value only;
- access = format value when filled, otherwise event value, filtered by enabled access sections;
- schedule and runner notes = active-format details;
- services and partners = event details.

## GPX Replacement

Replacing a GPX updates the source `races` row and storage object for that format, then returns parsed stats, detected waypoint ravitos, and a transient elevation profile for the organizer dashboard preview. Existing saved plans remain snapshots: their `plan_gpx_path`, `elevation_profile`, `planner_values`, and `plan_aid_stations` are not automatically rewritten.

When GPX waypoints are present and the format has no aid stations, the organizer GPX route can create source `race_aid_stations` from normalized waypoints. When station rows already exist, the GPX route preserves them and reports detected waypoints without replacing rows, so station-product links survive. Existing station rows are edited through the aid station route.

Organizer aid station edits should preserve existing station ids when possible so `race_aid_station_products` links survive. New or legacy stations default all service flags to enabled unless an organizer disables water, solid food, or assistance explicitly.

Aid station `organizer_details` stores cumulative D+/D-, cutoff time, drop-bag availability, and organizer note on the station row; legacy `stationType` and `altitudeM` values may still exist in persisted JSONB, but the current organizer dashboard no longer exposes editors for them. These fields must still be saved through the organizer aid-station route so existing station ids are kept. In the current organizer UI, ravitos use the same expandable card pattern as the runner planner: the compact card keeps distance, cumulative D+/D-, cutoff, water/solid/assistance/drop-bag toggles, and product actions visible first, while the expanded panel goes directly from the main info grid to the organizer note block. The same ravito tile also owns the fixed `Départ` and `Arrivée` timing cards for the format.

## Organizer Products

Organizer-created products are stored in `products` with:

- `created_by = organizer user`;
- `is_live = false`;
- `is_archived = false`;
- `is_official = false`.

They are linked to stations through `race_aid_station_products`. They are not global catalog products and should not appear in normal product catalog responses.

The organizer ravito cards open a catalog-product picker for existing live products instead of relying on an inline select or a separate products module. The picker groups results by `products.brand`, keeps unbranded items in a "Sans marque" group, and offers quick filters such as gels, bars, liquids, capsules, real food, and other products. Link updates may omit `notes` or send `notes = null`; the organizer API normalizes empty station-product notes to `null` before replacing the station links.

When a runner imports a catalog plan, `/api/plans/from-catalog` copies source station service flags into `planner_values.aidStations`, stores `sourceAidStationId` when available, loads station-product links with the service role, and stores those product suggestions in `planner_values.organizerAidStationProducts` as a fallback snapshot. On saved-plan read, `/api/plans` reloads current station-product links for plans with `race_id` and injects them into the response without rewriting the plan row. The planner UI displays them as priority suggestions on the matching ravito, and the manual product picker for that ravito includes those official products alongside the normal product pool. Selected official products are saved as station supplies with `source: "organizer"`.

Auto-fill must keep organizer products out of its default product pool. On web, the runner can opt in with the "Produits ravito" toggle; when enabled, auto-fill may use the official products for the target ravito in addition to the runner's favorites/candidates. Without that opt-in, organizer products may be used only after the runner favorites the product or explicitly adds it to start/aid-station supplies. When an official product is used at a no-assistance ravito, it remains available at that ravito while personal top-ups still come from the previous assistance point.

Planner `assistanceAllowed` is separate from organizer product presence: it says whether the runner's crew can hand over personal products. Organizer suggestions remain official ravito context and should not be treated as crew availability.

## Mobile Scope

No mobile organizer screen exists in v1. Mobile can keep consuming catalog races and plans normally. The schema is ready for a future mobile organizer or runner display, but no mobile UI should assume organizer edit access.

## Gotchas

- Do not use `races.created_by` to authorize claimed public race edits.
- Do not expose organizer JSONB fields through public/mobile broad selects accidentally; public surfaces should keep explicit column selection.
- Do not make organizer-created products live just to show them to runners; use planner import suggestions.
- Do not add separate grants or RLS policies for organizer JSONB columns on existing source tables; route membership checks and table row policies remain the access boundary.
- Do not auto-sync existing saved plans after organizer source edits. Official ravito product links are read-time response overlays only; service flags, GPX, station distances, pacing, and runner supplies remain stored plan data.
- Do not use `user_metadata` for admin claim approval or revocation checks.
- Verify the live `race_events` schema before adding new event-level columns; the create-table migration is not visible in this repo.
- Manual organizer claims create non-live draft events; do not treat those rows as public catalog entries until an admin or organizer publishes the event through the normal event edit flow.
- Do not publish an event with no live, publishable format; the organizer event route rejects that state even when the event-level fields are valid.
- Do not bulk-duplicate common event details into every existing format except for equipment, which is intentionally mirrored into each race list so one race can later remove an item and automatically shrink the event-level shared subset.
- Do not reintroduce a separate schedule tile or format-level bib workflow without also changing completion, autosave routing, and runner-preview resolution.
- Do not replace existing source ravitos from organizer GPX waypoints; use the ravito editor to preserve station ids and product links.
- Organizer event images are uploaded through the server-side PNG route; do not expose direct Storage writes from the dashboard client.
- Keep organizer dashboard UI additions reuse-first: search existing route-local dashboard components and shared web primitives before adding another component.

## Related Docs

- [race_event_claims](../02-database/tables/race-event-claims.md)
- [race_event_organizers](../02-database/tables/race-event-organizers.md)
- [race_aid_station_products](../02-database/tables/race-aid-station-products.md)
- [Nutrition Algorithm](nutrition-algorithm.md)
- [GPX Import](gpx-import.md)
