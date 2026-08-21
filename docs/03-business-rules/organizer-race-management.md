---
title: Organizer Race Management
scope: business-rule
last_verified: 2026-08-21
ai_priority: high
related_files:
  - apps/web/components/ui/dialog.tsx
  - supabase/migrations/20260528120000_add_organizer_portal.sql
  - supabase/migrations/20260618120000_add_race_aid_station_service_flags.sql
  - supabase/migrations/20260618160000_add_organizer_dashboard_details.sql
  - supabase/migrations/20260629123858_add_race_event_favorites_and_updates.sql
  - supabase/migrations/20260820130930_add_format_targeted_race_updates.sql
  - supabase/migrations/20260720120000_add_race_edition_groups.sql
  - supabase/migrations/20260721110000_add_race_event_edition_requests.sql
  - supabase/migrations/20260804152041_add_race_event_editions.sql
  - supabase/migrations/20260729110000_add_race_event_publication_requests.sql
  - supabase/migrations/20260820135823_add_racebook_publication_control.sql
  - supabase/migrations/20260820164141_target_racebook_publication_requests.sql
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
  - apps/web/app/api/organizer/publication-requests/readiness.test.ts
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
  - race_event_editions
  - race_event_publication_requests
  - race_event_organizers
  - race_aid_stations
  - race_aid_station_products
  - race_events
  - race_event_updates
  - race_event_update_reads
  - races
  - products
  - user_favorite_race_events
---

# Organizer Race Management

## Purpose

This document records the organizer portal rules: authenticated users create a catalog-visible event, receive immediate event-scoped organizer access, manage formats and runner-facing details on the web, and mobile exposes a per-format Racebook only after its separate admin approval and publication flag are active.

## Key Concepts

- Organizer account: a normal Supabase user account.
- Legacy claim: a historical user request to manage a pre-existing `race_events` row. New event creation no longer creates claims.
- Event membership: organizer access stored in `race_event_organizers`; direct creators receive an active `owner` membership immediately.
- Format: one `races` row under an event.
- Source data: organizer edits update `race_events`, `races`, and `race_aid_stations`.
- Organizer details: nullable JSONB on `race_events`, `races`, and `race_aid_stations` for progressive dashboard fields that do not yet need normalized tables. Edition start/end dates are normalized in `race_event_editions`; the current range is mirrored into legacy event fields for mobile/catalog compatibility. Event details keep fields such as `officialWebsiteUrl`, equipment and geocoded location metadata, while format websites remain on `races.external_site_url`.
- Event follower: authenticated runner who favorites one `race_events` row.
- Organizer update: manual runner-facing announcement stored in `race_event_updates`, optionally scoped to one format, and pushed to event followers.
- Runner snapshot: already-created `race_plans` stay unchanged when source race data changes, except that official ravito product suggestions are refreshed into `/api/plans` responses for plans linked to a `race_id`.

## Direct Event Creation

`/organizers` lets an authenticated user create an event from a name, optional location and official website URL, plus a required initial edition start/end range. `POST /api/organizer/events` inserts the catalog-visible event, creates its initial current `race_event_editions` row, then creates the active owner membership. Its Racebook formats remain hidden by default. Failure cleanup removes an event whose membership could not be created. Redirect bootstrap values remain passed from the `/organizer` server page as plain props.

The direct-creation flow deliberately does not let a user take control of an existing catalog event. Existing claims and the admin claim queue remain available only as a legacy audit/access-management path; new `/organizers` submissions do not add claim rows and do not wait for admin approval.

The admin Organizer tab can also delegate an existing event directly to an existing Supabase Auth account. The admin selects the event and enters the account e-mail; the protected server route resolves an exact case-insensitive Auth e-mail match, creates an active `organizer` membership (or reactivates a revoked membership), and leaves event/format publication state unchanged. The delegated organizer can edit every edition and format under the event, but only an `owner` or trusted admin can permanently delete the event.

Revoking access still sets `revoked_at` on the membership and blocks future organizer writes without removing the course from the catalog. Yearly editions and formats are catalog-visible, but each new Racebook starts hidden. Admin validation happens only after the organizer requests Racebook publication. Payment-based publication gating remains deferred and can later be added to that publication-review boundary.

## Organizer Dashboard Rules

`/organizer` is web-only in v1. It shows states for no request, pending request, rejected request, and an approved modular dashboard.

Organizers with an active event membership can:

- edit event-level name, location, selected-edition dates, PNG image, and common organizer details, but not catalog visibility;
- edit existing race formats under the event, including format-specific `races.organizer_details`;
- add a draft format attached to the selected edition, inheriting its start date unless an explicit in-range format date is enabled;
- create a yearly edition from a new start/end range, either empty or by duplicating the selected source edition; when duplication is enabled, formats, GPX, ravitos, and station products are cloned as draft rows attached to it while preserving format edition groups;
- upload or replace a format thumbnail through a file picker and server-side Storage route, not by pasting a URL;
- replace a format GPX source in `race-gpx`;
- delete a format from the `Course` module after a confirmation step; the button is aligned at the far right of the `Formats & GPX` title row, source ravitos and linked official products follow normal FK cascades, while saved runner plans keep their snapshots and simply lose the `race_id` link;
- see whether the selected event has all publication-required information through a compact status badge beside the event selector;
- permanently delete the selected event from the red cross placed immediately before that selector, but only after typing the exact word `Supprimer` in the confirmation dialog; the server restricts this destructive action to the active owner membership (or a trusted admin), removes event-owned formats and Storage assets, and leaves saved runner plans detached from their deleted source formats;
- edit source `race_aid_stations`, including `waterRefill`, `solidRefill`, `assistanceAllowed` service flags, and station-specific `race_aid_stations.organizer_details`;
- attach existing catalog products to a station from a picker that groups products by brand and shows quick fuel-type filters, product image, type, and nutrition characteristics;
- create non-live organizer-scoped products and attach them to a station;

The dashboard is organized as a compact top synthesis plus one tabbed completion surface. The event-level year selector stays on the left of a compact edition card and `Créer une nouvelle édition` stays on the right. The button opens a dialog for the start/end dates and a default-enabled `Dupliquer depuis l’édition précédente` checkbox; disabling it creates an empty edition. The edition supplies the default format date; the format date field appears only when the organizer enables a different date. Each selected-edition format has a Racebook switch: before approval it creates a publication request carrying that exact `race_id`; while that format's request is pending only its switch is disabled; after admin approval it directly controls `races.racebook_is_live`. A switch saves first only when it belongs to the currently edited format, so unsaved or incomplete work on another format cannot block publication of the chosen one. Completion remains independent from catalog and Racebook visibility.

Newly created years appear immediately in the event-level year selector and are editable without admin validation. Inside a format tab, the year remains driven only by the event-level selector; the format action bar does not repeat a local "Edition active" block.

The format `Course` editor now uses a desktop two-column layout with a flatter hierarchy: a compact information column on the left and a dedicated file side rail on the right. That right rail keeps only the GPX upload first and the image upload second, while the elevation profile now sits directly under the left-side format data and stretches to the full card width available there. In the information grid, one `Nom du format` field writes both `races.name` and `races.series_name`, because Organizer formats use the same value for their displayed name and cross-edition series label. D+ and D- each receive the same two-column desktop width as distance so four-digit values remain readable, and both accept the parser's one-decimal precision. Date and location use parallel opt-in overrides: without `Date différente de l'édition`, the edition start date is used; without `Lieu différent de l'événement`, `races.location_text` and `organizer_details.raceLocation` stay empty so runner-facing resolution inherits the event location. Disabling the location override clears both the format text and normalized geocoded object. The interactive route map then sits below as the main full-width visual focus. The editor is always expanded: the former show/hide toggle, single-format duplication button, and organizer-side runner preview are removed. `Formats & GPX` has no helper sentence beneath its title.

The selected edition year controls its canonical range and attached format rows, but imposes no time-based lock. Event-range edits are rejected if an attached format date would fall outside the new range.

When the organizer adds a format, the creation form can queue its image and GPX before submission. GPX parsing still pre-fills course metrics and visuals. The format inherits the edition start date unless a different in-range date is enabled; after row creation, the existing image and GPX routes persist the pending files.

Approved organizers can also publish a manual update from the top dashboard card through `Notifier les coureurs`. The modal requires a scope (`Tout l’événement` or one live format from the selected edition) and one short message. It creates one `race_event_updates` row, then sends push notifications only to users who favorited the event. Event-wide pushes use the event name in the title; format-specific pushes use the format name and carry both event and format ids. Recent messages in the same modal expose a small delete cross; after confirmation, the membership-checked route removes that event-scoped history row and its read receipts, without attempting to recall an already delivered push. This action is intentionally separate from normal save/publish flows so tiny organizer edits never notify runners automatically.

That same dashboard header now also exposes `Importer depuis un site web`. The organizer pastes the general event website URL and can add one explicit URL per format. The server detects `UTMB`, `Trace de Trail`, or falls back to a generic HTML/JSON-LD extraction, and the UI shows a review-first recap with:

- event-level facts, the detected official website, and common logistics found only on the general page (mandatory equipment, departure, shuttles, and parking);
- an editable edition start date, initialized from the detected date or selected edition start;
- detected formats;
- missing fields;
- mismatch warnings against the currently selected organizer event;
- explicit per-format actions: create, update, or ignore.
- an actionable quality score: only formats at or above `70/100` are shown and selectable; each distance-first card always separates found values with their source links from fields that still need manual entry.

The review import route never creates another `race_events` row, publishes automatically, or writes before confirmation. When a submitted official website cannot be analyzed but roadbook documents are present, the server keeps the document review available and reports a website warning instead of failing the entire preview. When `/organizers` supplies an official URL, it first creates the draft, initial edition, and membership. The organizer may correct the edition start date; the server validates the ISO override outside the scraper hash, upserts the matching `race_event_editions` row, and attaches imported formats through `edition_id`. Only matching series inside that edition are updated; a missing format reuses its cross-year `edition_group_id` when available. Detected format month/day is preserved only when valid inside the edition range, otherwise the edition start is used.

The format score focuses the review rather than authorizing import by itself. It combines weighted information coverage (65%) with estimated source reliability (35%); name, date, distance, and D+ have double weight because they are required to create a usable format. Only formats scored at least `70/100` are presented for action; lower scores are automatically ignored because they commonly represent product or incidental text detections. Provider adapters and parsed GPX values are high-confidence, structured data and dedicated format/regulation sections outrank generic text. Every displayed found field keeps its source URL; every absent assessment field is listed separately as required or optional manual input. Each format also has an always-visible GPX status that distinguishes an importable GPX from reliable metrics without a recoverable file and from a fully missing route.

The generic fallback keeps event facts and common logistics on the general URL, but it can also extract strongly structured format blocks exposed as accessible tabs on that same page. When the organizer supplies no explicit format URL, it follows at most six same-origin links whose labels or paths identify likely race sources such as regulations, courses, formats, schedules, or roadbooks; explicit URLs disable this discovery and remain authoritative. If the pasted page already embeds one complete route, sibling format pages are excluded and supplemental detections from regulation/program pages are retained only when their name or distance matches that route. All secondary pages are fetched concurrently, with each fetch capped at eight seconds and oversized HTML truncated before parsing. The extractor scores dates from their surrounding copy so a race date outranks registration deadlines, recognizes format sections under headings from `h1` through `h6`, and understands named regulation prose such as `« Fleurinoise » d'une longueur de 18 km`. It rejects distance mentions that belong only to ravitos, barriers, age groups, prices, results, or analysis blocks; named formats also supersede anonymous `15 km` duplicates at the same distance. Accessible tab panels may expose consecutive distance, D+, and D- metrics plus a format-specific GPX link; parsed GPX measurements still override those HTML values.

Detections from multiple pages are merged field by field instead of replacing one another wholesale. Distance is the primary grouping signal: values separated by at most 1.5 km are treated as one format even when their labels differ, because an event does not expose two genuine formats at such close distances and official rounded distances can differ from GPX calculations. The first page-level format name is retained. The displayed name removes generic prefixes such as `Format :` and trailing distance/D+ metadata; if that leaves only a generic label, it falls back to the parsed distance instead of inventing a course name. The consolidated candidate unions complementary ravitos by distance only when their sources have equal confidence, preserves the best GPX/source fields, and recalculates its assessment only after GPX hydration. The current edition is preferred when an older parcours page conflicts with a newer regulation, and the recap keeps an explicit warning about discarded years. Ravitos mentioned in named regulation clauses are assigned only to that format. GPX links are detected both from `.gpx` URLs and from explicit `GPX` anchor labels, which supports opaque download URLs such as Odoo `/web/content/...`; each detected format can therefore hydrate its own reliable GPX, distance, elevation, and waypoints. Public Waymark-style GeoJSON `FeatureCollection` data embedded directly in a page is also converted into an in-memory GPX, including LineString or MultiLineString coordinates and elevations. That reconstructed GPX is passed through the same parser as a downloaded file, and a year from its public metadata may complete a yearless event date visible on the same page. A parsed or reconstructed GPX always takes precedence over HTML D+/D- values; without either source, D+ remains missing rather than invented. The server ranks candidates by assessment, while the browser review orders actionable cards by distance.

When that review recap is present, the import dialog should expand beyond the initial compact URL-entry width and keep its own internal vertical scroll area. Its review layout has an explicit viewport-relative height, a fixed header/footer, and a `min-height: 0` flexible center panel so long event warnings, detected-format cards, and per-format action controls remain reachable with mouse, trackpad, keyboard, or touch without relying on page-level scrolling behind the modal. Because the local `cn` helper only concatenates classes, the route must explicitly prioritize its flex layout over the shared dialog's default grid layout. The shared dialog shell also keeps viewport overflow handling for smaller screens or taller modal states.

The completion shell does not repeat a local heading or helper sentence above the tabs. The active tab should be visually larger and more contrasty than inactive tabs so the current scope remains obvious, and desktop event-scope tiles should stay on a single row by shrinking before wrapping.

Equipment, bib pickup, and access are split by tab in the UI. Bib pickup accepts several event-level pickup locations and can be overridden for an individual format with the `Retrait différent pour ce format` toggle; each location owns its geocoded address and any number of structured date/start/end slots. The first address remains mirrored into the legacy single-location fields, and historical free-text schedules remain editable as compatibility information until replaced by structured slots. Equipment is inherited from the event by default. Each format has an explicit `mandatoryEquipment.overrideEnabled` checkbox, initially unchecked; checking it reveals a copy of the event equipment that can be edited and makes that full list the format's runner-facing equipment. Unchecked formats ignore any stored format list and always use the event list. The event equipment editor owns the active weather plan radio group (`normal`, `grand froid`, `grosse chaleur`), while each item keeps its own `cold` / `heat` toggles and required/recommended radios. Those per-item controls stay inline on the same flexible row as the label. Existing legacy format differences are promoted to checked overrides when the dashboard loads. The add-format tab can prefill a new format draft from event defaults or the previously active format. Event and format rows display read-only live/brouillon badges; organizers submit one event-level publication request instead of toggling liveness directly. Dirty state is scoped per event or race. Changing event, edition, format tab, or module updates the UI immediately and queues the previous scope's save in the background without a success toast or visible saving state; saves for the same scope are serialized, `beforeunload` remains armed while any scope is dirty, and failures remain visible. Saving the format-level Ravitos module writes both `races.organizer_details.schedule` through the race route and the station rows through the aid-station route.

Organizer access is event-scoped. An active membership grants access to every format under that event and no other event.

Admins are the explicit exception to the membership boundary: trusted `app_metadata` admin status lets the existing Organizer routes read and mutate any event. For admins, `/api/organizer/claims` supplies every `race_events` row, live or draft and ordered by name, to the existing event selector; ordinary users still receive only their active memberships.

## Publication and Completion Rules

Creating a request through `/api/organizer/publication-requests` requires:

- event name;
- event location plus the selected `race_event_editions.start_date` / `end_date` range;
- at least one format with a non-empty name, `distance_km > 0`, and `elevation_gain_m >= 0`.

The organizer event and race mutation routes ignore/reject direct live-state-only writes. Admin approval through `/api/admin/event-publication-requests` rechecks readiness and atomically marks the event plus complete formats live. Rejection leaves all source rows in their current state.

Recommended modules improve the dashboard score but do not block publication: GPX, ravitos, equipment, bib pickup, and access/shuttles.

Optional modules also improve the score but never block publication: ravito products, supporter notes, accommodations/restaurants/recovery, partners, and last-minute messages.

Published runner-facing surfaces resolve details as:

- equipment = common event equipment plus active-format equipment, with weather-tagged items always visible but grayed out unless the active event weather plan matches their `cold` / `heat` flags;
- bib pickup = event value only, with every structured pickup location and its dated start/end slots preserved; legacy single-location/free-text schedules remain fallbacks;
- access = format value when filled, otherwise event value, filtered by enabled access sections;
- schedule and runner notes = active-format details;
- services and partners = event details.
- key locations = plain text address plus optional geocoded `organizer_details` metadata for event, format, bib pickup, and start/finish access, rendered as GPS coordinates and Google Maps links when available.

The mobile Racebook view uses the same merge rules for live formats, but keeps them read-only and compact. Its top identity card contains event/format identity, the event date range, an optional distinct format date, the best published location, runner information, and event services, while distance, D+, D-, and start-time metric pills are omitted from this synthesis. Weather and last-minute messages remain dedicated compact alert cards immediately below it. The redundant general tab is removed: the route-local tabs are `Matériel`, `Dossard`, `Course`, and `Accès`. Equipment is split into active required, active recommended, and weather-conditional inactive groups; `Dossard` groups every pickup location first, then groups its slots by day so same-day ranges share one localized short weekday/day/month label and use locale-specific hour formatting before documents and notes. `Course` owns the explicitly labeled start time as the first light-green important-information row, keeps the finish cutoff critical, and contains the remaining schedule constraints plus the stored GPX map, elevation profile, and source aid stations without rendering separate empty cards for missing course blocks. `Accès` begins with start/finish linked locations, then parking, shuttles, road restrictions, the published map URL, and access notes. Published geocoded event, start, finish, or bib values remain tappable so runners can launch navigation directly. Equipment status badges stay inline and right-aligned, and weather-tagged items retain icon-only cold/heat markers while remaining muted whenever the active plan does not match. A native pull-to-refresh re-queries the complete published Racebook snapshot, profile, and route so organizer changes can appear without restarting the app; a failed refresh keeps the last successful snapshot visible.

Outside the Racebook, the mobile Courses tab is now the first runner surface for these organizer updates: favorited events are pinned to the top, a confirmed favorite addition shows a brief localized toast and scrolls to the newly pinned event, and unread previews add a `NEW` badge. In the event sheet, every format stays ahead of one light-green organizer-update panel; that panel initially shows only the newest (or deep-link-targeted) announcement, then reveals the other messages and longer history through `View more`. Pushes deep-link with event, optional format, and update ids so the sheet opens directly on the targeted message and highlights the concerned format. Identified runners persist read receipts only for messages displayed in the panel.

## GPX Replacement

Replacing a GPX updates the source `races` row and storage object for that format, then returns parsed stats, detected waypoint ravitos, and a transient elevation profile for the organizer dashboard preview. The dashboard immediately copies the exact returned distance, D+, and D- into the active format form and refreshes the same edition year, rather than waiting for a race-id change that may never occur. Existing saved plans remain snapshots: their `plan_gpx_path`, `elevation_profile`, `planner_values`, and `plan_aid_stations` are not automatically rewritten.

When GPX waypoints are present and the format has no aid stations, the organizer GPX route can create source `race_aid_stations` from normalized waypoints. When station rows already exist, the GPX route preserves them and reports detected waypoints without replacing rows, so station-product links survive. Existing station rows are edited through the aid station route.

Organizer aid station edits should preserve existing station ids when possible so `race_aid_station_products` links survive. New or legacy stations default all service flags to enabled unless an organizer disables water, solid food, or assistance explicitly.

Aid station `organizer_details` stores cumulative D+/D-, cutoff time, drop-bag availability, and organizer note on the station row; legacy `stationType` and `altitudeM` values may still exist in persisted JSONB, but the current organizer dashboard no longer exposes editors for them. These fields must still be saved through the organizer aid-station route so existing station ids are kept. In the current organizer UI, ravitos use the same expandable card pattern as the runner planner: the compact card keeps distance, cumulative D+/D-, cutoff, water/solid/assistance/drop-bag toggles, and product actions visible first, while the expanded panel goes directly from the main info grid to the organizer note block. When an active-format GPX preview is available, editing a ravito km now recomputes cumulative D+ / D- automatically from the GPX trace and the corresponding form fields remain read-only. The same ravito tile also owns the fixed `Départ` and `Arrivée` timing cards for the format. The mobile read-only Racebook now dedicates a right-hand metrics column on each ravito card to km, D+, D-, and cutoff time. Those D+/D- values are computed from cumulative station values, falling back to the first station's cumulative values when there is no previous published ravito.

On mobile, the Racebook keeps those ravito metrics in a compact right-hand column with each label inline beside its value. Water, solid food, assistance, and drop-bag services are icon-only buttons in the main ravito column; tapping one toggles a single inline information bubble with the service label, leaving more width and height for published products. Its access and bib information rows also size the value from its content: short values let the divider run to the value, while long linked locations keep a bounded width and wrap cleanly.

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

No mobile organizer editor exists in v1. Mobile can consume published organizer details through the read-only `race/[id]/racebook` screen only when the catalog format is live, `races.racebook_is_live = true`, and there is meaningful non-ravito organizer content. Aid stations by themselves must not surface the Racebook entry point. The screen must stay runner-facing only: no mobile UI should assume organizer edit access, hidden Racebook visibility, or admin powers.

## Gotchas

- L'action `Importer les informations` accepte la sélection de plusieurs PDF/images dans l'interface. L'extraction PDF texte est disponible temporairement pour le preview, mais les images et PDF sans texte nécessitent encore un OCR ; aucune donnée de course n'est attribuée automatiquement au document à ce stade.
- Les documents sélectionnés par `Importer les informations` sont limités à 25 Mo par fichier et transférés directement depuis le navigateur vers le bucket privé temporaire `organizer-imports`, afin de ne pas traverser la limite de charge utile Vercel. Un PDF seul peut lancer la revue sans URL principale. L'API télécharge les objets avec le service role, les extrait, puis les supprime systématiquement à la fin de l'analyse; le navigateur supprime aussi les objets déjà envoyés si la requête d'analyse ne peut pas démarrer. Les PDF contenant du texte produisent des observations à confirmer pour les métriques, départs, dossards, barrières, ravitos, matériel, secours et suivi live ; elles sont rattachées à un format connu seulement par nom ou distance compatible, puis comparées aux données actuelles du format. Les résultats indiquent un champ à remplir, une valeur identique ou une différence à valider avant écrasement ; les images et PDF sans texte restent en `ocr-pending`, et aucune observation n'est écrite automatiquement dans une course.

- Format-specific bib pickup is an explicit opt-in override. When `races.organizer_details.bibPickup.overrideEnabled` is false or absent, runner-facing reads use the event pickup; the format editor keeps GPS/autocomplete fields hidden.

- Keep automatic generic discovery same-origin, hint-filtered, and capped. Do not turn it into an unrestricted site crawl; explicit format URLs must remain authoritative when supplied.
- Reconstruct GPX only from complete public GeoJSON line geometry embedded in the fetched HTML. Do not infer a route from map tiles, screenshots, private endpoints, or isolated markers.
- Do not use `races.created_by` to authorize claimed public race edits.
- Do not expose organizer JSONB fields through public/mobile broad selects accidentally; public surfaces should keep explicit column selection.
- Do not let the mobile Racebook bypass its three-part gate: catalog-live format, `racebook_is_live = true`, and meaningful organizer content. Direct links that fail any part must show the unavailable state.
- Do not make the new route sketch or elevation-profile blocks part of the availability gate. They are best-effort visuals and must stay optional when stored GPX/elevation data is missing.
- New organizer formats remain visible as courses (`is_live = true`) but start with `racebook_is_live = false` and no approval timestamp.
- Do not make organizer-created products live just to show them to runners; use planner import suggestions.
- Do not auto-create `race_event_updates` rows on organizer saves, publication approval, image upload, or GPX replacement. Runner notifications stay manual.
- Format scope changes the title and in-app context, not the follower source: delivery still targets users who favorited the parent event.
- Deleting an organizer update removes it from runner history but cannot retract a notification already displayed by the operating system; keep the confirmation explicit and retain push delivery logs.
- Do not let the mobile Courses sheet grow unbounded by default. Keep one announcement visible in the post-format light-green panel on first open and reveal the other messages plus longer archive only after an explicit runner action.
- Do not add separate grants or RLS policies for organizer JSONB columns on existing source tables; route membership checks and table row policies remain the access boundary.
- Do not auto-sync existing saved plans after organizer source edits. Official ravito product links are read-time response overlays only; service flags, GPX, station distances, pacing, and runner supplies remain stored plan data.
- Do not use `user_metadata` for admin claim approval or revocation checks.
- Do not leave approved claims in the admin pending-review queue; once membership exists, the request belongs only in the active-access list.
- Verify the live `race_events` schema before adding new event-level columns; the create-table migration is not visible in this repo.
- Direct organizer creation creates catalog-visible events and an immediate owner membership; this does not publish any Racebook.
- Keep organizer import bootstrap query parsing in the `/organizer` server page unless the client dashboard is explicitly wrapped in Suspense; direct `useSearchParams` usage otherwise breaks the production static build.
- Do not let organizer switches grant approval. Before `racebook_publication_approved_at` exists they may only request review; after approval they may freely toggle `racebook_is_live` without changing catalog visibility.
- Keep publication-switch persistence format-scoped. An incomplete dirty format may remain open without blocking the switch for another complete format; only the format whose switch is used must finish its foreground save first.
- Keep first-publication readiness tied to the clicked `race_id` and that race's `edition_id`. The event's `is_current` edition may differ from the year selected in the dashboard and must not redirect or reject the request.
- Do not bulk-duplicate common event details into every existing format. Equipment is inherited while `mandatoryEquipment.overrideEnabled` is false; only an explicitly checked format stores and uses its own full equipment list.
- Do not move the active weather plan to race scope without revisiting preview, mobile Racebook, sync, and documentation rules; the current contract is one event-level plan shared by every format.
- Do not move bib pickup to format scope. Its event-level `locations[]` and nested `slots[]` must stay aligned across completion, autosave routing, web preview, and mobile Racebook parsing; preserve the legacy single-location/free-text fallback when reading historical rows.
- Start and finish times shown in the Ravitos module belong to `races.organizer_details.schedule`; saving only `race_aid_stations` silently drops those edits on tab or format navigation.
- Background navigation must keep dirty revisions and save queues scoped by event/race. A completed save from one format must not clear newer edits from another format or reload the previous tab over the current one.
- Ignore late ravito/product/GPX responses when their race id is no longer active; immediate tab navigation otherwise lets stale sidecars overwrite the newly selected course.
- Keep per-format header completion based on each format's persisted ravito count. Reusing only the active tab's loaded ravito state makes completion points move between formats during navigation.
- Do not bypass the organizer GPX route when a GPX is selected during format creation; the client still has to create the race first, then import the file server-side.
- Do not rely only on the event reload to refresh active-format GPX metrics: the active race id stays stable on replacement, so the form must consume the successful response and preserve the race's edition year explicitly.
- Do not let the review-stage website import create or reassign another `race_events` row. The flow enriches only the currently selected organizer event and formats that remain attached to it.
- Do not replace existing source ravitos from organizer GPX waypoints; use the ravito editor to preserve station ids and product links.
- Do not rely on manual insertion order for organizer ravitos; distance from start is the source of truth for both UI order and persisted `order_index`.
- Do not infer yearly organizer grouping from `races.name`; use explicit `races.edition_group_id` and `races.series_name`.
- Keep the Organizer's single format-name field synchronized to both `races.name` and `races.series_name`; `edition_group_id` remains the stable cross-edition identity.
- Do not reintroduce a date-based organizer edit lock without a new explicit business decision; active membership currently authorizes both past and future edition maintenance.
- Do not re-open manual editing for cumulative D+ / D- in the organizer ravito form while GPX-driven interpolation is the source of truth; km edits must keep recomputing those values from the active GPX preview.
- Keep a UTF-8 regression test around route-local organizer copy when touching French labels on ravito cards or related dashboard text; mojibake should fail tests before it reaches the screen.
- Organizer event images are uploaded through the server-side PNG route, and format images through the server-side race image route; do not expose direct Storage writes from the dashboard client.
- Deleting a format must preserve saved runner plans by relying on the `race_plans.race_id` detach behavior rather than deleting plan rows.
- Keep organizer dashboard UI additions reuse-first: search existing route-local dashboard components and shared web primitives before adding another component.
- Keep the `Course` module free of duplicate/preview/show-hide action clutter; only the format delete action belongs in the `Formats & GPX` title row.
- Keep format-location inheritance explicit: an unchecked `Lieu différent de l'événement` must clear both `location_text` and `raceLocation`, while the event location remains the displayed fallback.
- Keep new-edition dates and the optional duplication control inside the shared dialog; the compact header card should contain only the edition selector and creation button.
- Keep website-import writes conservative. Manual confirmation is the guardrail, and v1 should not overwrite existing race thumbnails or GPX files when those source assets are already present.
- A website-imported format without a GPX is still a valid draft. Preserve `gpx_storage_path = null`, but populate the legacy required `gpx_path` with its deterministic organizer placeholder; do not upload an invented GPX file.
- Do not use the website-import quality score as authorization or automatic validation. It is only a transparent summary of coverage and heuristic source confidence for the organizer review.
- Keep candidates below `70/100` out of the actionable review and import selections. They may be retained only in transient parsing work, never surfaced as default format actions.
- Do not place organizer edition-date corrections inside the preview hash or trust arbitrary client dates. Validate the override server-side, then update the canonical edition only after hash and membership checks.
- Keep the generic event page and format pages separate: do not infer formats from the general page or crawl its links. Fetch only the organizer-supplied format URLs, keep each fetch size-limited and time-bounded, and leave missing formats visible for manual completion.
- Do not treat every kilometer mention as a format. Ravito distances, barriers, age categories, result archives, prices, and training-analysis blocks need a course-level signal or a named format context.
- Consolidate detections separated by at most 1.5 km, regardless of their labels. Retain the earliest heading-level name and preserve a conflict warning when non-GPX metrics disagree. Do not merge distances farther apart merely because their labels overlap.
- During website import, scope format matching to the validated event year. A same-name format from another year is a series reference for `edition_group_id`, not the update target for the new edition.
- Do not infer missing elevation. A downloadable GPX may supply D+/D-, but without one the recap must leave D+ missing rather than create a plausible-looking value.
- Keep the website-import review panel on a definite viewport-relative height and explicitly prioritize its flex layout. A `max-height` plus conflicting `grid` / `flex` classes can clip the recap instead of making its center panel scroll.
- Do not rely on geocoded JSON alone for publication or catalog reads. Event `location`, race `location_text`, bib `location`, and access address strings remain the primary runner-facing text contract, while the geocoded objects are additive metadata.
- Keep organizer dashboard copy properly UTF-8 encoded. The event/format editor renders accented French labels directly from source strings, so mojibake like `Ã©` on tabs, dates, or image labels is a user-facing bug, not a cosmetic doc issue.
- Keep `/api/admin/organizer-claims` resilient to secondary-read failures. Missing yearly-edition rows or unavailable organizer-identity enrichment should degrade the admin tab gracefully instead of hiding the whole review queue.
- Keep direct organizer assignment admin-only and server-side. The browser must never receive the Supabase service credential or the complete Auth user list, and assignment must not implicitly publish or unpublish the event or its Racebook formats.
- The admin Organizer switch controls all complete Racebooks in the current edition. Turning it on grants durable per-format approval and publishes them; turning it off hides them while preserving approval so the organizer can publish them again later.
- Migration `20260820135823_add_racebook_publication_control.sql` intentionally resets organizer-managed Racebooks to hidden/unapproved for one safe revalidation pass; it keeps their courses visible in the catalog.

- The complete Organizer event list must remain admin-only. It may be returned only after the server verifies trusted `app_metadata`; non-admin users remain limited to active `race_event_organizers` memberships.

## Related Docs

- [race_event_claims](../02-database/tables/race-event-claims.md)
- [race_event_organizers](../02-database/tables/race-event-organizers.md)
- [race_aid_station_products](../02-database/tables/race-aid-station-products.md)
- [Nutrition Algorithm](nutrition-algorithm.md)
- [GPX Import](gpx-import.md)

