---
title: Organizer Race Management
scope: business-rule
last_verified: 2026-08-04
ai_priority: high
related_files:
  - apps/web/components/ui/dialog.tsx
  - supabase/migrations/20260528120000_add_organizer_portal.sql
  - supabase/migrations/20260618120000_add_race_aid_station_service_flags.sql
  - supabase/migrations/20260618160000_add_organizer_dashboard_details.sql
  - supabase/migrations/20260629123858_add_race_event_favorites_and_updates.sql
  - supabase/migrations/20260720120000_add_race_edition_groups.sql
  - supabase/migrations/20260721110000_add_race_event_edition_requests.sql
  - supabase/migrations/20260729110000_add_race_event_publication_requests.sql
  - apps/mobile/app/(app)/catalog.tsx
  - apps/mobile/components/race/RaceEventSummaryCard.tsx
  - apps/mobile/components/race/RacebookLeafletMap.tsx
  - apps/mobile/app/(app)/race/[id]/racebook.tsx
  - apps/mobile/lib/racebook.ts
  - supabase/tests/organizer_rls_checks.sql
  - apps/web/lib/organizer.ts
  - apps/web/lib/organizer-aid-station-products.ts
  - apps/web/lib/organizer-dashboard-details.ts
  - apps/web/lib/push.ts
  - apps/web/app/organizers/page.tsx
  - apps/web/app/organizer/page.tsx
  - apps/web/app/organizer/_components/OrganizerDashboard.tsx
  - apps/web/app/organizer/_components/dashboard/types.ts
  - apps/web/app/organizer/_components/dashboard/constants.ts
  - apps/web/app/organizer/_components/dashboard/helpers.ts
  - apps/web/app/organizer/_components/dashboard/helpers.test.ts
  - apps/web/app/organizer/_components/dashboard/utf8-copy.test.ts
  - apps/web/app/organizer/_components/dashboard/controls.tsx
  - apps/web/app/organizer/_components/dashboard/address-autocomplete-field.tsx
  - apps/web/app/organizer/_components/dashboard/shell.tsx
  - apps/web/app/organizer/_components/dashboard/event-format-editors.tsx
  - apps/web/components/gpx/GpxRouteMap.tsx
  - apps/web/components/gpx/GpxRouteMapClient.tsx
  - apps/web/app/organizer/_components/dashboard/detail-editors.tsx
  - apps/web/app/organizer/_components/dashboard/aid-stations-editor.tsx
  - apps/web/app/organizer/_components/dashboard/products-editor.tsx
  - apps/web/app/organizer/_components/dashboard/runner-preview-dialog.tsx
  - apps/web/app/organizer/_components/completion.ts
  - apps/web/app/organizer/_components/completion.test.ts
  - apps/web/app/admin/_components/AdminOrganizerClaimsTab.tsx
  - apps/web/app/api/organizer/claims/route.ts
  - apps/web/app/api/organizer/edition-requests/route.ts
  - apps/web/app/api/organizer/claims/route.test.ts
  - apps/web/app/api/organizer/events/route.ts
  - apps/web/app/api/organizer/events/route.test.ts
  - apps/web/app/api/organizer/edition-requests/route.test.ts
  - apps/web/app/api/organizer/publication-requests/route.ts
  - apps/web/app/api/organizer/publication-requests/route.test.ts
  - apps/web/app/api/admin/event-publication-requests/route.ts
  - apps/web/app/api/admin/event-publication-requests/route.test.ts
  - apps/web/app/api/admin/organizer-claims/route.ts
  - apps/web/app/api/admin/organizer-claims/route.test.ts
  - apps/web/app/api/organizer/events/[id]/route.ts
  - apps/web/app/api/organizer/events/[id]/route.test.ts
  - apps/web/app/api/organizer/events/[id]/website-import/route.ts
  - apps/web/app/api/organizer/events/[id]/website-import/route.test.ts
  - apps/web/app/api/organizer/events/[id]/website-import/parser.test.ts
  - apps/web/app/api/organizer/events/[id]/updates/route.ts
  - apps/web/app/api/organizer/events/[id]/updates/route.test.ts
  - apps/web/app/api/organizer/events/[id]/image/route.ts
  - apps/web/app/api/organizer/events/[id]/image/route.test.ts
  - apps/web/app/api/race-favorites/route.ts
  - apps/web/app/api/race-favorites/route.test.ts
  - apps/web/app/api/race-events/[id]/updates/route.ts
  - apps/web/app/api/race-events/[id]/updates/route.test.ts
  - apps/web/app/api/organizer/races/route.ts
  - apps/web/app/api/organizer/races/route.test.ts
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
  - apps/web/lib/organizer-website-import.ts
  - apps/web/lib/organizer-publication.ts
related_tables:
  - race_event_claims
  - race_event_edition_requests
  - race_event_publication_requests
  - race_event_organizers
  - race_aid_stations
  - race_aid_station_products
  - race_events
  - race_event_updates
  - races
  - products
  - user_favorite_race_events
---

# Organizer Race Management

## Purpose

This document records the organizer portal rules: authenticated users create their own non-live event, receive immediate event-scoped organizer access, manage formats and runner-facing details on the web, and mobile consumes only the published read-only subset through the per-format Racebook screen.

## Key Concepts

- Organizer account: a normal Supabase user account.
- Legacy claim: a historical user request to manage a pre-existing `race_events` row. New event creation no longer creates claims.
- Event membership: organizer access stored in `race_event_organizers`; direct creators receive an active `owner` membership immediately.
- Format: one `races` row under an event.
- Source data: organizer edits update `race_events`, `races`, and `race_aid_stations`.
- Organizer details: nullable JSONB on `race_events`, `races`, and `race_aid_stations` for progressive dashboard fields that do not yet need normalized tables. Event details are common defaults, including `dateRange.endDate` and `officialWebsiteUrl`; event-level `mandatoryEquipment` also stores the active weather plan as `weatherPlan = normal | cold | heat`, while each equipment item can opt into `cold` and/or `heat`. Event and race details now also store structured geocoded location objects beside the existing text fields for event location, format location, bib pickup, and start/finish access. Race details keep each course's full equipment list plus format-specific overrides or additions for the other modules, while format websites continue to live on `races.external_site_url`.
- Event follower: authenticated runner who favorites one `race_events` row.
- Organizer update: manual runner-facing announcement stored in `race_event_updates` and optionally pushed to event followers.
- Runner snapshot: already-created `race_plans` stay unchanged when source race data changes, except that official ravito product suggestions are refreshed into `/api/plans` responses for plans linked to a `race_id`.

## Direct Event Creation

`/organizers` lets an authenticated user create a new `race_events` row from a name, optional location/date, and optional official website URL. `POST /api/organizer/events` always inserts the event with `is_live = false`, then creates an active `race_event_organizers` owner membership for the same user with `claim_id = null`. If membership creation fails, the route deletes the newly created event rather than leaving an inaccessible draft. The redirect bootstrap values (`eventId` and `importUrl`) are read by the `/organizer` server page and passed as plain props to the client dashboard so production prerendering does not depend on a client `useSearchParams` bailout.

The direct-creation flow deliberately does not let a user take control of an existing catalog event. Existing claims and the admin claim queue remain available only as a legacy audit/access-management path; new `/organizers` submissions do not add claim rows and do not wait for admin approval.

Revoking access still sets `revoked_at` on the membership and blocks future organizer writes. Yearly editions are created directly as drafts; admin validation now happens only when the organizer requests publication. Payment-based publication gating remains deferred and can later be added to that publication-review boundary.

## Organizer Dashboard Rules

`/organizer` is web-only in v1. It shows states for no request, pending request, rejected request, and an approved modular dashboard.

Organizers with an active event membership can:

- edit event-level name, location, date, PNG image, and common `race_events.organizer_details`, but not live state;
- edit existing race formats under the event, including format-specific `races.organizer_details`;
- add a new format as a new `races` row with `created_by = null`, `is_public = true`, `is_live = false` by default, a required format race date, optional organizer details, and an optional GPX file selected directly in the creation form;
- duplicate a format as metadata-only draft data without copying GPX, ravitos, or station-product links, creating a new `edition_group_id`;
- create a new yearly event edition directly from a selected source year and start date; source formats, GPX, ravitos, and station products are cloned as draft rows while preserving format edition groups;
- upload or replace a format thumbnail through a file picker and server-side Storage route, not by pasting a URL;
- replace a format GPX source in `race-gpx`;
- delete a format from the identity module after a confirmation step; source ravitos and linked official products follow normal FK cascades, while saved runner plans keep their snapshots and simply lose the `race_id` link;
- edit source `race_aid_stations`, including `waterRefill`, `solidRefill`, `assistanceAllowed` service flags, and station-specific `race_aid_stations.organizer_details`;
- attach existing catalog products to a station from a picker that groups products by brand and shows quick fuel-type filters, product image, type, and nutrition characteristics;
- create non-live organizer-scoped products and attach them to a station;
- preview an internal runner-facing summary before a public runner page exists.

The dashboard is organized as a compact top synthesis plus one tabbed completion surface. `OrganizerDashboard.tsx` owns session, API calls, selected event/format-series/edition-year/module, dirty state, autosave-before-navigation, and composition; route-local files under `_components/dashboard/` own reusable controls, shell sections, editors, ravito/product blocks, and runner preview. Address fields share `/api/location-search` and preserve plain text plus optional geocoded metadata. The synthesis uses an event-level year selector and a direct `Nouvelle édition` action: the organizer chooses a source year and start date, and the server clones the formats into editable draft rows without review. Event and format rows show read-only publication badges, while a single `Demander la publication` action submits the event to admin review. Completion percentages remain independent from live state and tab selection: the event detail read returns a persisted ravito count for every format, so each header bar is scored from its own source data rather than from the active editor sidecars.

Newly created years appear immediately in the event-level year selector and are editable without admin validation. Inside a format tab, the year remains driven only by the event-level selector; the format action bar does not repeat a local "Edition active" block.

The format identity editor now uses a desktop two-column layout with a flatter hierarchy: a compact information column on the left and a dedicated file side rail on the right. That right rail keeps only the GPX upload first and the image upload second, while the elevation profile now sits directly under the left-side format data and stretches to the full card width available there. In the information grid, D+ and D- each receive the same two-column desktop width as distance so four-digit values remain readable, and both accept the parser's one-decimal precision. The interactive route map then sits below as the main full-width visual focus, and repeated course metrics should not be duplicated across every preview header when the same values are already visible in the form.

The selected edition year controls which format rows are displayed and edited, but it does not impose a time-based lock. Organizers with an active event membership may update past and future editions through the same event, image, race, GPX, ravito, and product routes.

When the organizer adds a brand-new format, the creation form can now queue both the format image and the GPX file before submission. Selecting that GPX parses it immediately in the dashboard and pre-fills distance, D+, and D- from the file before submit. The same right-hand GPX panel also renders an interactive OpenStreetMap/Leaflet route map and the elevation curve from the loaded preview data. The format date is mandatory in that creation flow. The dashboard still creates the `races` row first, then uploads the pending GPX through `/api/organizer/races/[id]/gpx` so the format lands with persisted parsed stats and any eligible waypoint ravitos.

Approved organizers can also publish a manual event update from the top dashboard card through `Notifier les coureurs`. That action opens a modal, lets the organizer type one short runner-facing message, creates one `race_event_updates` row, and then sends push notifications only to users who favorited the event. This action is intentionally separate from normal save/publish flows so tiny organizer edits never notify runners automatically.

That same dashboard header now also exposes `Importer depuis un site web`. The organizer pastes the general event website URL and can add one explicit URL per format. The server detects `UTMB`, `Trace de Trail`, or falls back to a generic HTML/JSON-LD extraction, and the UI shows a review-first recap with:

- event-level facts, the detected official website, and common logistics found only on the general page (mandatory equipment, departure, shuttles, and parking);
- an editable event date, initialized from the detected date or the currently saved event date when detection is missing;
- detected formats;
- missing fields;
- mismatch warnings against the currently selected organizer event;
- explicit per-format actions: create, update, or ignore.
- an actionable quality score: only formats at or above `70/100` are shown and selectable; the expandable inventory is limited to found values and their source links.

The review import route never creates another `race_events` row, never publishes anything automatically, and never writes source data before the organizer confirms the recap. When `/organizers` supplies an official URL, it first creates the draft and membership, then opens this same review against that new event. The organizer may correct the event date in the review; the override must be a real `YYYY-MM-DD` date, is transmitted outside the hashed scraper payload, and is applied only after the server has recomputed and validated the original preview hash. The selected event date defines the target edition year: an existing format is updated only when its matching series exists in that year; otherwise the importer creates a draft `races` row in that year and reuses the existing series `edition_group_id` when available. The detected format month/day is preserved when valid, with the event date as fallback. In v1, GPX, thumbnails, and ravito hydration are applied only when the detected source is reliable enough.

The format score focuses the review rather than authorizing import by itself. It combines weighted information coverage (65%) with estimated source reliability (35%); name, date, distance, and D+ have double weight because they are required to create a usable format. Only formats scored at least `70/100` are presented for action; lower scores are automatically ignored because they commonly represent product or incidental text detections. Provider adapters and parsed GPX values are high-confidence, structured data and dedicated format/regulation sections outrank generic text. Every displayed found field keeps its source URL; required missing values still block creation for a selected format.

The generic fallback reads the general URL only for event facts and common logistics; it must not infer formats from that page or crawl its links. It fetches only the explicit format URLs supplied by the organizer, concurrently, with each fetch capped at eight seconds and oversized HTML truncated before parsing. The extractor scores dates from their surrounding copy so a race date outranks registration deadlines, recognizes format sections under headings from `h1` through `h6`, and understands named regulation prose such as `« Fleurinoise » d'une longueur de 18 km`. It rejects distance mentions that belong only to ravitos, barriers, age groups, prices, results, or analysis blocks; named formats also supersede anonymous `15 km` duplicates at the same distance.

Detections from multiple pages are merged field by field instead of replacing one another wholesale. Same-distance candidates (within 0.2 km) are one format even if a later label differs, because those later labels are often ravito names; the first page-level format name is retained. The displayed name removes generic prefixes such as `Format :` and trailing distance/D+ metadata; if that leaves only a generic label, it falls back to the parsed distance instead of inventing a course name. The consolidated candidate unions complementary ravitos by distance only when their sources have equal confidence, preserves the best GPX/source fields, and recalculates its assessment only after GPX hydration. The current edition is preferred when an older parcours page conflicts with a newer regulation, and the recap keeps an explicit warning about discarded years. Ravitos mentioned in named regulation clauses are assigned only to that format. GPX links are detected both from `.gpx` URLs and from explicit `GPX` anchor labels, which supports opaque download URLs such as Odoo `/web/content/...`; each detected format can therefore hydrate its own reliable GPX, distance, elevation, and waypoints. A parsed GPX always takes precedence over HTML D+/D- values; without a GPX, D+ remains missing rather than invented. The final preview is sorted by descending assessment score, then coverage, while preserving the prior stable order for ties.

When that review recap is present, the import dialog should expand beyond the initial compact URL-entry width and keep its own internal vertical scroll area. Its review layout has an explicit viewport-relative height, a fixed header/footer, and a `min-height: 0` flexible center panel so long event warnings, detected-format cards, and per-format action controls remain reachable with mouse, trackpad, keyboard, or touch without relying on page-level scrolling behind the modal. Because the local `cn` helper only concatenates classes, the route must explicitly prioritize its flex layout over the shared dialog's default grid layout. The shared dialog shell also keeps viewport overflow handling for smaller screens or taller modal states.

The completion shell does not repeat a local heading or helper sentence above the tabs. The active tab should be visually larger and more contrasty than inactive tabs so the current scope remains obvious, and desktop event-scope tiles should stay on a single row by shrinking before wrapping.

Equipment, bib pickup, and access are split by tab in the UI, but equipment now has a special sync rule: the event tab edits the shared subset and saving it mirrors those items into every race list; saving a race recomputes the event-level shared subset as the intersection still present across all formats. The event equipment editor also owns the active weather plan radio group (`normal`, `grand froid`, `grosse chaleur`), while each item keeps its own `cold` / `heat` toggles and required/recommended radios. Those per-item controls stay inline on the same flexible row as the label. The add-format tab can prefill a new format draft from event defaults or the previously active format. Event and format rows display read-only live/brouillon badges; organizers submit one event-level publication request instead of toggling liveness directly. The dashboard keeps unsaved-change state per module, gives short floating save/error feedback, and warns on `beforeunload` when a module is dirty. Saving the format-level Ravitos module writes both `races.organizer_details.schedule` through the race route and the station rows through the aid-station route before navigation continues.

Organizer access is event-scoped. An active membership grants access to every format under that event and no other event.

## Publication and Completion Rules

Creating a request through `/api/organizer/publication-requests` requires:

- event name;
- event location, start date (`race_events.race_date`), and end date (`race_events.organizer_details.dateRange.endDate`);
- at least one format with a non-empty name, `distance_km > 0`, and `elevation_gain_m >= 0`.

The organizer event and race mutation routes ignore/reject direct live-state-only writes. Admin approval through `/api/admin/event-publication-requests` rechecks readiness and atomically marks the event plus complete formats live. Rejection leaves all source rows in their current state.

Recommended modules improve the dashboard score but do not block publication: GPX, ravitos, equipment, bib pickup, and access/shuttles.

Optional modules also improve the score but never block publication: ravito products, supporter notes, accommodations/restaurants/recovery, partners, and last-minute messages.

Runner-facing preview resolves details as:

- equipment = common event equipment plus active-format equipment, with weather-tagged items always visible but grayed out unless the active event weather plan matches their `cold` / `heat` flags;
- bib pickup = event value only;
- access = format value when filled, otherwise event value, filtered by enabled access sections;
- schedule and runner notes = active-format details;
- services and partners = event details.
- key locations = plain text address plus optional geocoded `organizer_details` metadata for event, format, bib pickup, and start/finish access, rendered as GPS coordinates and Google Maps links when available.

The mobile Racebook view uses the same merge rules for live formats, but keeps them read-only and compact: event/format synthesis on top, merged equipment, filtered access sections, and ravitos listed from source race aid stations. The header uses the format race date plus distance, D+, D-, and start time. When the active event weather plan is `cold` or `heat`, the screen shows a dedicated compact weather alert above the last-minute message card: `Plan grand froid activé - vérifie le matériel` or `Plan grosse chaleur activé - vérifie le matériel`. Event-level `services.lastMinuteMessage`, when present, stays in its own compact alert card below that weather warning, and both alert cards render their title and message inline on the same text row; the rest of the service copy remains in the Profile tab. The `Profil` tab now starts with an interactive Leaflet map built from stored GPX points when available, and the `Ravito` tab now starts with the course elevation profile before the aid-station list. Start and bib sections render as table-like label/value rows. When a published organizer address includes geocoded metadata, the corresponding start, finish, or bib value is rendered like a tappable link so runners can launch navigation directly from the Racebook without a separate icon button. Equipment is shown as per-item rows sorted with active required items first, active recommended items second, and weather-muted inactive items last; status badges stay inline and right-aligned on the same row as the item label, rows do not show bullet dots, and weather-tagged items expose icon-only inline cold/heat markers while remaining grayed out whenever the active plan does not match.

Outside the Racebook, the mobile Courses tab is now the first runner surface for these organizer updates: favorited events are pinned to the top, the event sheet exposes a preloaded preview of the latest manual organizer announcements below the format list with an explicit affordance to open the longer history, and organizer update pushes deep-link directly into that event sheet with `/(app)/catalog?eventId=<uuid>`.

## GPX Replacement

Replacing a GPX updates the source `races` row and storage object for that format, then returns parsed stats, detected waypoint ravitos, and a transient elevation profile for the organizer dashboard preview. The dashboard immediately copies the exact returned distance, D+, and D- into the active format form and refreshes the same edition year, rather than waiting for a race-id change that may never occur. Existing saved plans remain snapshots: their `plan_gpx_path`, `elevation_profile`, `planner_values`, and `plan_aid_stations` are not automatically rewritten.

When GPX waypoints are present and the format has no aid stations, the organizer GPX route can create source `race_aid_stations` from normalized waypoints. When station rows already exist, the GPX route preserves them and reports detected waypoints without replacing rows, so station-product links survive. Existing station rows are edited through the aid station route.

Organizer aid station edits should preserve existing station ids when possible so `race_aid_station_products` links survive. New or legacy stations default all service flags to enabled unless an organizer disables water, solid food, or assistance explicitly.

Aid station `organizer_details` stores cumulative D+/D-, cutoff time, drop-bag availability, and organizer note on the station row; legacy `stationType` and `altitudeM` values may still exist in persisted JSONB, but the current organizer dashboard no longer exposes editors for them. These fields must still be saved through the organizer aid-station route so existing station ids are kept. In the current organizer UI, ravitos use the same expandable card pattern as the runner planner: the compact card keeps distance, cumulative D+/D-, cutoff, water/solid/assistance/drop-bag toggles, and product actions visible first, while the expanded panel goes directly from the main info grid to the organizer note block. When an active-format GPX preview is available, editing a ravito km now recomputes cumulative D+ / D- automatically from the GPX trace and the corresponding form fields remain read-only. The same ravito tile also owns the fixed `Départ` and `Arrivée` timing cards for the format. The mobile read-only Racebook now dedicates a right-hand metrics column on each ravito card to km, D+, D-, and cutoff time. Those D+/D- values are computed from cumulative station values, falling back to the first station's cumulative values when there is no previous published ravito.

Ravitos in the organizer editor are always ordered by ascending distance from the start, including after creating a station or changing its km manually. The organizer aid-station route persists `order_index` from that distance-based order so reloads keep the same sequence.

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
- Do not make the new route sketch or elevation-profile blocks part of the availability gate. They are best-effort visuals and must stay optional when stored GPX/elevation data is missing.
- New organizer formats start in draft (`is_live = false`) until an admin approves an event publication request.
- Do not make organizer-created products live just to show them to runners; use planner import suggestions.
- Do not auto-create `race_event_updates` rows on organizer saves, publication approval, image upload, or GPX replacement. Runner notifications stay manual.
- Do not let the mobile Courses sheet grow unbounded by default. Keep the runner-facing organizer history compact on first open and reveal the longer archive only after an explicit runner action.
- Do not add separate grants or RLS policies for organizer JSONB columns on existing source tables; route membership checks and table row policies remain the access boundary.
- Do not auto-sync existing saved plans after organizer source edits. Official ravito product links are read-time response overlays only; service flags, GPX, station distances, pacing, and runner supplies remain stored plan data.
- Do not use `user_metadata` for admin claim approval or revocation checks.
- Do not leave approved claims in the admin pending-review queue; once membership exists, the request belongs only in the active-access list.
- Verify the live `race_events` schema before adding new event-level columns; the create-table migration is not visible in this repo.
- Direct organizer creation creates non-live draft events and an immediate owner membership; do not treat those rows as public catalog entries until they are explicitly published.
- Keep organizer import bootstrap query parsing in the `/organizer` server page unless the client dashboard is explicitly wrapped in Suspense; direct `useSearchParams` usage otherwise breaks the production static build.
- Do not restore organizer-side live toggles. Publication is the admin-reviewed boundary and must recheck event/format readiness at approval time.
- Do not bulk-duplicate common event details into every existing format except for equipment, which is intentionally mirrored into each race list so one race can later remove an item and automatically shrink the event-level shared subset.
- Do not move the active weather plan to race scope without revisiting preview, mobile Racebook, sync, and documentation rules; the current contract is one event-level plan shared by every format.
- Do not reintroduce a separate schedule tile or format-level bib workflow without also changing completion, autosave routing, and runner-preview resolution.
- Start and finish times shown in the Ravitos module belong to `races.organizer_details.schedule`; saving only `race_aid_stations` silently drops those edits on tab or format navigation.
- Keep per-format header completion based on each format's persisted ravito count. Reusing only the active tab's loaded ravito state makes completion points move between formats during navigation.
- Do not bypass the organizer GPX route when a GPX is selected during format creation; the client still has to create the race first, then import the file server-side.
- Do not rely only on the event reload to refresh active-format GPX metrics: the active race id stays stable on replacement, so the form must consume the successful response and preserve the race's edition year explicitly.
- Do not let the review-stage website import create or reassign another `race_events` row. The flow enriches only the currently selected organizer event and formats that remain attached to it.
- Do not replace existing source ravitos from organizer GPX waypoints; use the ravito editor to preserve station ids and product links.
- Do not rely on manual insertion order for organizer ravitos; distance from start is the source of truth for both UI order and persisted `order_index`.
- Do not infer yearly organizer grouping from `races.name`; use explicit `races.edition_group_id` and `races.series_name`.
- Do not reintroduce a date-based organizer edit lock without a new explicit business decision; active membership currently authorizes both past and future edition maintenance.
- Do not re-open manual editing for cumulative D+ / D- in the organizer ravito form while GPX-driven interpolation is the source of truth; km edits must keep recomputing those values from the active GPX preview.
- Keep a UTF-8 regression test around route-local organizer copy when touching French labels on ravito cards or related dashboard text; mojibake should fail tests before it reaches the screen.
- Organizer event images are uploaded through the server-side PNG route, and format images through the server-side race image route; do not expose direct Storage writes from the dashboard client.
- Deleting a format must preserve saved runner plans by relying on the `race_plans.race_id` detach behavior rather than deleting plan rows.
- Keep organizer dashboard UI additions reuse-first: search existing route-local dashboard components and shared web primitives before adding another component.
- Keep website-import writes conservative. Manual confirmation is the guardrail, and v1 should not overwrite existing race thumbnails or GPX files when those source assets are already present.
- A website-imported format without a GPX is still a valid draft. Preserve `gpx_storage_path = null`, but populate the legacy required `gpx_path` with its deterministic organizer placeholder; do not upload an invented GPX file.
- Do not use the website-import quality score as authorization or automatic validation. It is only a transparent summary of coverage and heuristic source confidence for the organizer review.
- Keep candidates below `70/100` out of the actionable review and import selections. They may be retained only in transient parsing work, never surfaced as default format actions.
- Do not place organizer event-date corrections inside the preview hash or trust an arbitrary client date string. Validate the explicit override server-side and apply it only after hash and membership checks.
- Keep the generic event page and format pages separate: do not infer formats from the general page or crawl its links. Fetch only the organizer-supplied format URLs, keep each fetch size-limited and time-bounded, and leave missing formats visible for manual completion.
- Do not treat every kilometer mention as a format. Ravito distances, barriers, age categories, result archives, prices, and training-analysis blocks need a course-level signal or a named format context.
- Consolidate same-distance detections within 0.2 km as one format, retaining the earliest heading-level name and preserving a conflict warning when non-GPX metrics disagree. Do not merge meaningfully different distances merely because their labels overlap.
- During website import, scope format matching to the validated event year. A same-name format from another year is a series reference for `edition_group_id`, not the update target for the new edition.
- Do not infer missing elevation. A downloadable GPX may supply D+/D-, but without one the recap must leave D+ missing rather than create a plausible-looking value.
- Keep the website-import review panel on a definite viewport-relative height and explicitly prioritize its flex layout. A `max-height` plus conflicting `grid` / `flex` classes can clip the recap instead of making its center panel scroll.
- Do not rely on geocoded JSON alone for publication or catalog reads. Event `location`, race `location_text`, bib `location`, and access address strings remain the primary runner-facing text contract, while the geocoded objects are additive metadata.
- Keep organizer dashboard copy properly UTF-8 encoded. The event/format editor renders accented French labels directly from source strings, so mojibake like `Ã©` on tabs, dates, or image labels is a user-facing bug, not a cosmetic doc issue.
- Keep `/api/admin/organizer-claims` resilient to secondary-read failures. Missing yearly-edition rows or unavailable organizer-identity enrichment should degrade the admin tab gracefully instead of hiding the whole review queue.

## Related Docs

- [race_event_claims](../02-database/tables/race-event-claims.md)
- [race_event_organizers](../02-database/tables/race-event-organizers.md)
- [race_aid_station_products](../02-database/tables/race-aid-station-products.md)
- [Nutrition Algorithm](nutrition-algorithm.md)
- [GPX Import](gpx-import.md)

