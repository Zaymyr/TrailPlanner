---
title: Organizer Race Management
scope: business-rule
last_verified: 2026-06-26
ai_priority: high
related_files:
  - supabase/migrations/20260528120000_add_organizer_portal.sql
  - supabase/migrations/20260618120000_add_race_aid_station_service_flags.sql
  - supabase/migrations/20260618160000_add_organizer_dashboard_details.sql
  - apps/mobile/app/(app)/race/[id]/racebook.tsx
  - apps/mobile/lib/racebook.ts
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
  - apps/web/app/organizer/_components/dashboard/address-autocomplete-field.tsx
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
  - apps/web/app/api/organizer/races/[id]/route.test.ts
  - apps/web/app/api/organizer/races/[id]/image/route.ts
  - apps/web/app/api/organizer/races/[id]/image/route.test.ts
  - apps/web/app/api/organizer/races/[id]/gpx/route.ts
  - apps/web/app/api/organizer/races/[id]/gpx/route.test.ts
  - apps/web/app/api/organizer/races/[id]/aid-stations/route.ts
  - apps/web/app/api/organizer/races/[id]/aid-stations/route.test.ts
  - apps/web/app/api/organizer/races/[id]/aid-station-products/route.ts
  - apps/web/app/api/location-search/route.ts
  - apps/web/app/api/plans/route.ts
  - apps/web/app/api/plans/from-catalog/route.ts
  - apps/web/app/api/plans/from-catalog/route.test.ts
  - apps/web/app/(planner)/race-planner/RacePlannerPageContent.tsx
  - apps/web/components/race-planner/ActionPlan.tsx
  - apps/web/lib/location-utils.ts
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

This document records the organizer portal rules: users can request control of an existing event or submit a missing event as a draft, admins validate the claim, approved organizers manage formats and runner-facing details on the web, and mobile consumes only the published read-only subset through the per-format Racebook screen.

## Key Concepts

- Organizer account: a normal Supabase user account.
- Claim: a user request to manage a `race_events` row, including draft non-live rows created from manual organizer submissions.
- Event membership: approved organizer access stored in `race_event_organizers`.
- Format: one `races` row under an event.
- Source data: organizer edits update `race_events`, `races`, and `race_aid_stations`.
- Organizer details: nullable JSONB on `race_events`, `races`, and `race_aid_stations` for progressive dashboard fields that do not yet need normalized tables. Event details are common defaults, including `dateRange.endDate`; event-level `mandatoryEquipment` also stores the active weather plan as `weatherPlan = normal | cold | heat`, while each equipment item can opt into `cold` and/or `heat`. Event and race details now also store structured geocoded location objects beside the existing text fields for event location, format location, bib pickup, and start/finish access. Race details keep each course's full equipment list plus format-specific overrides or additions for the other modules.
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
- add a new format as a new `races` row with `created_by = null`, `is_public = true`, `is_live = false` by default, and optional organizer details;
- duplicate a format as metadata-only draft data without copying GPX, ravitos, or station-product links;
- upload or replace a format thumbnail through a file picker and server-side Storage route, not by pasting a URL;
- replace a format GPX source in `race-gpx`;
- delete a format from the identity module after a confirmation step; source ravitos and linked official products follow normal FK cascades, while saved runner plans keep their snapshots and simply lose the `race_id` link;
- edit source `race_aid_stations`, including `waterRefill`, `solidRefill`, `assistanceAllowed` service flags, and station-specific `race_aid_stations.organizer_details`;
- attach existing catalog products to a station from a picker that groups products by brand and shows quick fuel-type filters, product image, type, and nutrition characteristics;
- create non-live organizer-scoped products and attach them to a station;
- preview an internal runner-facing summary before a public runner page exists.

The dashboard is organized as a compact top synthesis plus one tabbed completion surface. `OrganizerDashboard.tsx` owns session, API calls, selected event/race/module, dirty state, autosave-before-navigation, and composition; route-local files under `_components/dashboard/` own reusable controls, shell sections, editors, ravito/product blocks, and runner preview. Address fields on those editors now share a route-local autocomplete component backed by `/api/location-search`; selecting a suggestion keeps the original text field filled for publication checks while also storing `lat/lng` plus a Google Maps URL in `organizer_details`. When a field or its surrounding event/format scope already has coordinates, the dashboard sends them as a proximity bias so nearby suggestions rank before distant but textually similar addresses. The synthesis uses inline event facts, a small live/brouillon indicator, and one publish row per scope: each event/race row shows the label first in a shared fixed-width column, then a progress bar that stretches across the available space, and finally the publish toggle. Those percentages are derived only from organizer completion fields and must not increase or decrease when an organizer flips event/race publication. The old ravito count and "a jour" status chip are no longer displayed in that top card. The first completion tab is the event scope and shows only fillable event tiles: information, equipment, bib pickup, access, and services. The following tabs are race formats and show only fillable race tiles: identity/GPX, equipment, access, and ravitos, without an extra progress bar under the tab strip because progress already lives in the top synthesis rows. The old schedule tile is gone: the ravito tile now owns the fixed `Départ` and `Arrivée` cards for `startTime` and `finishCutoffTime`, while `Horaires navettes` lives only in access. Official ravito products are managed inside that ravito module rather than through a separate products tile. Labels stay short because the active tab already provides the scope. Completed tiles get a green outline only when not selected, active tiles use the brand border/fill so the selection remains visible, incomplete tiles list the compact labels of missing fields, tiles stay compact with status, level, title, and count/action only, and changing tabs or modules now attempts an autosave first and blocks the navigation when the save fails.

The completion shell does not repeat a local heading or helper sentence above the tabs. The active tab should be visually larger and more contrasty than inactive tabs so the current scope remains obvious, and desktop event-scope tiles should stay on a single row by shrinking before wrapping.

Equipment, bib pickup, and access are split by tab in the UI, but equipment now has a special sync rule: the event tab edits the shared subset and saving it mirrors those items into every race list; saving a race recomputes the event-level shared subset as the intersection still present across all formats. The event equipment editor also owns the active weather plan radio group (`normal`, `grand froid`, `grosse chaleur`), while each item keeps its own `cold` / `heat` toggles and required/recommended radios. Those per-item controls stay inline on the same flexible row as the label: weather toggles sit immediately to the right of the material name, the required/recommended radios stay input-height beside them whenever width allows, and removal uses a compact red close icon instead of a text button. Format equipment stays list-only: it shows the event weather plan read-only and can add/remove or retag items, but it must not redefine the active plan per format. Bib pickup is now event-only in the UI and runner preview; format-level bib JSON may still exist for compatibility reads, but the dashboard no longer edits or scores it. Access keeps the event-default / format-override model and both event access and format access now include explicit `enabledSections` toggles for parkings, navettes, route restrictions, and map link; the format tab adds the runner-specific info toggle on top. Disabled access sections are treated as intentionally complete in the dashboard score and hidden from the runner preview. The editor must not stack event and race forms in the same tab. The add-format tab can prefill a new format draft from event defaults or the previously active format, but those values become format data only when the organizer creates the new race. Event publishing and format liveness use compact live/brouillon toggles in the synthesis rows instead of duplicate checkboxes or identity-form toggles. The dashboard keeps unsaved-change state per module, gives short floating save/error feedback, and warns on `beforeunload` when a module is dirty.

Organizer access is event-scoped. A claim for one event grants access to every format under that event and no other event.

## Publication and Completion Rules

Publishing an event through `/api/organizer/events/[id]` requires:

- event name;
- event location, start date (`race_events.race_date`), and end date (`race_events.organizer_details.dateRange.endDate`);
- at least one live format with a non-empty name, `distance_km > 0`, and `elevation_gain_m >= 0`.

Recommended modules improve the dashboard score but do not block publication: GPX, ravitos, equipment, bib pickup, and access/shuttles.

Optional modules also improve the score but never block publication: ravito products, supporter notes, accommodations/restaurants/recovery, partners, and last-minute messages.

Runner-facing preview resolves details as:

- equipment = common event equipment plus active-format equipment, with weather-tagged items always visible but grayed out unless the active event weather plan matches their `cold` / `heat` flags;
- bib pickup = event value only;
- access = format value when filled, otherwise event value, filtered by enabled access sections;
- schedule and runner notes = active-format details;
- services and partners = event details.
- key locations = plain text address plus optional geocoded `organizer_details` metadata for event, format, bib pickup, and start/finish access, rendered as GPS coordinates and Google Maps links when available.

The mobile Racebook view uses the same merge rules for live formats, but keeps them read-only and compact: event/format synthesis on top, merged equipment, filtered access sections, and ravitos listed from source race aid stations. The header uses the format race date plus distance, D+, D-, and start time. When the active event weather plan is `cold` or `heat`, the screen shows a dedicated compact weather alert above the last-minute message card: `Plan grand froid activé - vérifie le matériel` or `Plan grosse chaleur activé - vérifie le matériel`. Event-level `services.lastMinuteMessage`, when present, stays in its own compact alert card below that weather warning, and both alert cards render their title and message inline on the same text row; the rest of the service copy remains in the Profile tab. Start and bib sections render as table-like label/value rows. When a published organizer address includes geocoded metadata, the corresponding start, finish, or bib row also exposes an inline Google Maps action so runners can launch navigation directly from the Racebook. Equipment is shown as per-item rows sorted with active required items first, active recommended items second, and weather-muted inactive items last; status badges stay inline and right-aligned on the same row as the item label, rows do not show bullet dots, and weather-tagged items expose icon-only inline cold/heat markers while remaining grayed out whenever the active plan does not match.

## GPX Replacement

Replacing a GPX updates the source `races` row and storage object for that format, then returns parsed stats, detected waypoint ravitos, and a transient elevation profile for the organizer dashboard preview. Existing saved plans remain snapshots: their `plan_gpx_path`, `elevation_profile`, `planner_values`, and `plan_aid_stations` are not automatically rewritten.

When GPX waypoints are present and the format has no aid stations, the organizer GPX route can create source `race_aid_stations` from normalized waypoints. When station rows already exist, the GPX route preserves them and reports detected waypoints without replacing rows, so station-product links survive. Existing station rows are edited through the aid station route.

Organizer aid station edits should preserve existing station ids when possible so `race_aid_station_products` links survive. New or legacy stations default all service flags to enabled unless an organizer disables water, solid food, or assistance explicitly.

Aid station `organizer_details` stores cumulative D+/D-, cutoff time, drop-bag availability, and organizer note on the station row; legacy `stationType` and `altitudeM` values may still exist in persisted JSONB, but the current organizer dashboard no longer exposes editors for them. These fields must still be saved through the organizer aid-station route so existing station ids are kept. In the current organizer UI, ravitos use the same expandable card pattern as the runner planner: the compact card keeps distance, cumulative D+/D-, cutoff, water/solid/assistance/drop-bag toggles, and product actions visible first, while the expanded panel goes directly from the main info grid to the organizer note block. The same ravito tile also owns the fixed `Départ` and `Arrivée` timing cards for the format. The mobile read-only Racebook now dedicates a right-hand metrics column on each ravito card to km, D+, D-, and cutoff time. Those D+/D- values are computed from cumulative station values, falling back to the first station's cumulative values when there is no previous published ravito.

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

No mobile organizer editor exists in v1. Mobile can now consume published organizer details through the read-only `race/[id]/racebook` screen for live formats when there is meaningful non-ravito organizer content. Aid stations by themselves must not surface the Racebook entry point. The screen must stay runner-facing only: no mobile UI should assume organizer edit access, draft visibility, or admin powers.

## Gotchas

- Do not use `races.created_by` to authorize claimed public race edits.
- Do not expose organizer JSONB fields through public/mobile broad selects accidentally; public surfaces should keep explicit column selection.
- Do not let the mobile Racebook bypass its live/content gate. Direct links for non-live, aid-station-only, or otherwise empty formats should fall back to an unavailable state instead of showing empty organizer shells.
- New organizer formats should start in draft (`is_live = false`) until someone publishes them deliberately.
- Do not make organizer-created products live just to show them to runners; use planner import suggestions.
- Do not add separate grants or RLS policies for organizer JSONB columns on existing source tables; route membership checks and table row policies remain the access boundary.
- Do not auto-sync existing saved plans after organizer source edits. Official ravito product links are read-time response overlays only; service flags, GPX, station distances, pacing, and runner supplies remain stored plan data.
- Do not use `user_metadata` for admin claim approval or revocation checks.
- Verify the live `race_events` schema before adding new event-level columns; the create-table migration is not visible in this repo.
- Manual organizer claims create non-live draft events; do not treat those rows as public catalog entries until an admin or organizer publishes the event through the normal event edit flow.
- Do not publish an event with no live, publishable format; the organizer event route rejects that state even when the event-level fields are valid.
- Do not bulk-duplicate common event details into every existing format except for equipment, which is intentionally mirrored into each race list so one race can later remove an item and automatically shrink the event-level shared subset.
- Do not move the active weather plan to race scope without revisiting preview, mobile Racebook, sync, and documentation rules; the current contract is one event-level plan shared by every format.
- Do not reintroduce a separate schedule tile or format-level bib workflow without also changing completion, autosave routing, and runner-preview resolution.
- Do not replace existing source ravitos from organizer GPX waypoints; use the ravito editor to preserve station ids and product links.
- Organizer event images are uploaded through the server-side PNG route, and format images through the server-side race image route; do not expose direct Storage writes from the dashboard client.
- Deleting a format must preserve saved runner plans by relying on the `race_plans.race_id` detach behavior rather than deleting plan rows.
- Keep organizer dashboard UI additions reuse-first: search existing route-local dashboard components and shared web primitives before adding another component.
- Do not rely on geocoded JSON alone for publication or catalog reads. Event `location`, race `location_text`, bib `location`, and access address strings remain the primary runner-facing text contract, while the geocoded objects are additive metadata.

## Related Docs

- [race_event_claims](../02-database/tables/race-event-claims.md)
- [race_event_organizers](../02-database/tables/race-event-organizers.md)
- [race_aid_station_products](../02-database/tables/race-aid-station-products.md)
- [Nutrition Algorithm](nutrition-algorithm.md)
- [GPX Import](gpx-import.md)
