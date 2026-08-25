---
title: Organizer Race Management
scope: business-rule
last_verified: 2026-08-25
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
  - supabase/migrations/20260824114439_add_organizer_import_sessions_and_drafts.sql
  - supabase/migrations/20260824152859_add_relay_course_points.sql
  - supabase/migrations/20260824164101_manage_organizer_edition_visibility_and_deletion.sql
  - supabase/migrations/20260824170652_restrict_delete_race_event_edition_rpc.sql
  - supabase/tests/organizer_import_sessions_checks.sql
  - apps/mobile/app/(app)/catalog.tsx
  - apps/mobile/components/race/RaceEventSummaryCard.tsx
  - apps/mobile/components/race/RacebookLeafletMap.tsx
  - apps/mobile/app/(app)/race/[id]/racebook.tsx
  - apps/mobile/lib/racebook.ts
  - supabase/tests/organizer_rls_checks.sql
  - apps/web/lib/organizer.ts
  - apps/web/lib/organizer-aid-station-products.ts
  - apps/web/lib/organizer-dashboard-details.ts
  - apps/web/lib/organizer-dashboard-details.test.ts
  - apps/web/lib/push.ts
  - apps/web/app/organizers/page.tsx
  - apps/web/app/organizer/page.tsx
  - apps/web/app/organizer/_components/OrganizerDashboard.tsx
  - apps/web/app/organizer/_components/dashboard/types.ts
  - apps/web/app/organizer/_components/dashboard/constants.ts
  - apps/web/app/organizer/_components/dashboard/helpers.ts
  - apps/web/app/organizer/_components/dashboard/helpers.test.ts
  - apps/web/app/organizer/_components/dashboard/utf8-copy.test.ts
  - apps/web/app/organizer/_components/dashboard/website-import-review-details.tsx
  - apps/web/app/organizer/_components/dashboard/website-import-review-details.test.ts
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
  - apps/web/app/api/organizer/editions/[id]/route.ts
  - apps/web/app/api/organizer/editions/[id]/route.test.ts
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
  - apps/web/app/api/organizer/races/[id]/relay-points/route.ts
  - apps/web/app/api/organizer/races/[id]/relay-points/route.test.ts
  - apps/web/app/api/organizer/races/[id]/aid-station-products/route.ts
  - apps/web/app/api/location-search/route.ts
  - apps/web/app/api/plans/route.ts
  - apps/web/app/api/plans/from-catalog/route.ts
  - apps/web/app/api/plans/from-catalog/route.test.ts
  - apps/web/app/(planner)/race-planner/RacePlannerPageContent.tsx
  - apps/web/components/race-planner/ActionPlan.tsx
  - apps/web/lib/location-utils.ts
  - apps/web/lib/organizer-website-import.ts
  - apps/web/lib/organizer-document-import.ts
  - apps/web/lib/organizer-document-import.test.ts
  - apps/web/lib/organizer-import-engine.ts
  - apps/web/lib/organizer-import-engine.test.ts
  - apps/web/lib/organizer-import-reconciliation.ts
  - apps/web/lib/organizer-source-intelligence.ts
  - apps/web/lib/organizer-source-intelligence.test.ts
  - apps/web/lib/organizer-import-proposals.ts
  - apps/web/lib/organizer-publication.ts
related_tables:
  - race_event_claims
  - race_event_edition_requests
  - race_event_editions
  - race_event_publication_requests
  - race_event_organizers
  - race_aid_stations
  - race_relay_points
  - race_aid_station_products
  - race_events
  - race_event_updates
  - race_event_update_reads
  - races
  - organizer_import_sessions
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
- Organizer details: nullable JSONB on `race_events`, `races`, and `race_aid_stations` for progressive dashboard fields that do not yet need normalized tables. Edition start/end dates are normalized in `race_event_editions`; the current range is mirrored into legacy event fields for mobile/catalog compatibility. Event details keep fields such as `officialWebsiteUrl`, the structured `emergencyContact` name/phone, equipment, and geocoded location metadata, while format websites remain on `races.external_site_url`.
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
- enter an optional event emergency contact name and phone from the `Informations` tab; both values are saved in event-level `organizer_details` alongside the official website;
- edit existing race formats under the event, including format-specific `races.organizer_details`;
- add a draft format attached to the selected edition, inheriting its start date unless an explicit in-range format date is enabled;
- create a yearly edition from a new start/end range, either empty or by duplicating the selected source edition; when duplication is enabled, formats, GPX, ravitos, and station products are cloned as draft rows attached to it while preserving format edition groups;
- publish or hide the selected edition as one unit; hiding it removes every attached format from course discovery and forces every associated Racebook off, while showing it restores only complete course formats and leaves Racebook republication explicit;
- permanently delete a selected edition after typing its exact four-digit year; the database deletes its formats and dependent source data atomically, Storage cleanup removes their GPX/images, saved plans keep their snapshots with a null source link, and the only remaining edition cannot be deleted through this action;
- upload or replace a format thumbnail through a file picker and server-side Storage route, not by pasting a URL;
- replace a format GPX source in `race-gpx`;
- delete a format from the `Course` module after a confirmation step; the button is aligned at the far right of the `Formats & GPX` title row, source ravitos and linked official products follow normal FK cascades, while saved runner plans keep their snapshots and simply lose the `race_id` link;
- see whether the selected event has all publication-required information through a compact status badge beside the event selector;
- permanently delete the selected event from the red cross placed immediately before that selector, but only after typing the exact word `Supprimer` in the confirmation dialog; the server restricts this destructive action to the active owner membership (or a trusted admin), removes event-owned formats and Storage assets, and leaves saved runner plans detached from their deleted source formats;
- edit source `race_aid_stations`, including `waterRefill`, `solidRefill`, `assistanceAllowed` service flags, and station-specific `race_aid_stations.organizer_details`;
- classify formats as solo, relay, or both, then create standalone handover points or mark saved ravitos as handover locations;
- attach existing catalog products to a station from a picker that groups products by brand and shows quick fuel-type filters, product image, type, and nutrition characteristics;
- create non-live organizer-scoped products and attach them to a station;

The dashboard is organized as a compact top synthesis plus one tabbed completion surface. The event-level year selector stays on the left of a compact edition card, with a small destructive cross immediately beside it, and `Créer une nouvelle édition` stays on the right. The cross opens a dialog that enables deletion only after the organizer retypes the selected year. The button opens a dialog for the start/end dates and a default-enabled `Dupliquer depuis l’édition précédente` checkbox; disabling it creates an empty edition. The edition card has its own visibility switch. The edition supplies the default format date; the format date field appears only when the organizer enables a different date. Each selected-edition format has a Racebook switch: before approval it creates a publication request carrying that exact `race_id`; while that format's request is pending only its switch is disabled; after admin approval it directly controls `races.racebook_is_live`. A hidden edition disables those format switches and guarantees their Racebook flags stay false. A switch saves first only when it belongs to the currently edited format, so unsaved or incomplete work on another format cannot block publication of the chosen one. Completion remains independent from catalog and Racebook visibility.

Newly created years appear immediately in the event-level year selector and are editable without admin validation. Inside a format tab, the year remains driven only by the event-level selector; the format action bar does not repeat a local "Edition active" block.

The format `Course` editor now uses a desktop two-column layout with a flatter hierarchy: a compact information column on the left and a dedicated file side rail on the right. That right rail keeps only the GPX upload first and the image upload second, while the elevation profile now sits directly under the left-side format data and stretches to the full card width available there. In the information grid, one `Nom du format` field writes both `races.name` and `races.series_name`, because Organizer formats use the same value for their displayed name and cross-edition series label. D+ and D- each receive the same two-column desktop width as distance so four-digit values remain readable, and both accept the parser's one-decimal precision. Date and location use parallel opt-in overrides: without `Date différente de l'édition`, the edition start date is used; without `Lieu différent de l'événement`, `races.location_text` and `organizer_details.raceLocation` stay empty so runner-facing resolution inherits the event location. Disabling the location override clears both the format text and normalized geocoded object. The interactive route map then sits below as the main full-width visual focus. The editor is always expanded: the former show/hide toggle, single-format duplication button, and organizer-side runner preview are removed. `Formats & GPX` has no helper sentence beneath its title.

The selected edition year controls its canonical range and attached format rows, but imposes no time-based lock. Event-range edits are rejected if an attached format date would fall outside the new range.

When the organizer adds a format, the creation form can queue its image and GPX before submission. GPX parsing still pre-fills course metrics and visuals. The format inherits the edition start date unless a different in-range date is enabled; after row creation, the existing image and GPX routes persist the pending files.

Approved organizers can also publish a manual update from the top dashboard card through `Notifier les coureurs`. The modal requires a scope (`Tout l’événement` or one live format from the selected edition) and one short message. It creates one `race_event_updates` row, then sends push notifications only to users who favorited the event. Event-wide pushes use the event name in the title; format-specific pushes use the format name and carry both event and format ids. Recent messages in the same modal expose a small delete cross; after confirmation, the membership-checked route removes that event-scoped history row and its read receipts, without attempting to recall an already delivered push. This action is intentionally separate from normal save/publish flows so tiny organizer edits never notify runners automatically.

That same dashboard header now also exposes `Importer les informations`. The admin supplies an optional general event URL, additional official URLs, and/or official documents. Those additional URLs may point to an event overview, one or several formats, a regulation, program, logistics, registration, or archive; they are evidence sources and not asserted format identities. The server detects `UTMB`, `Trace de Trail`, or falls back to bounded generic HTML/JSON-LD extraction plus source classification. The first review shows every candidate with its edition, existence evidence/confidence, and missing required fields. It keeps a live final count while the admin corrects names, merges or separates detections, binds an existing format, adds a forgotten format, or ignores a false positive. The second review groups the event and every confirmed format, shows safe/review/conflict/missing counters, and offers exactly one choice per field: keep current, select a sourced claim, or leave missing.

The review import route never creates another `race_events` row or publishes automatically. It is reserved for trusted admins and uses two confirmations. The first review confirms the final format count, lets the admin merge/split/ignore/add candidates or bind one to an existing format, then creates the confirmed new rows as hidden drafts even when course fields are missing. The second review enriches those confirmed formats field by field.

The two confirmations share one service-only `organizer_import_sessions` row bound to the event, edition, initiating admin, source manifest, and a two-hour expiry. Format confirmation is one atomic invoker-security RPC: every confirmed new format is created, or none are. New drafts inherit the edition date, use zero sentinels only for explicitly missing distance/D+, keep `gpx_storage_path = null`, and stay course/Racebook-hidden. Field apply is a second atomic allowlisted RPC. Clearing the last required missing field marks the course complete and live while keeping its Racebook hidden for the normal publication review.

Deterministic extraction represents every value as a typed source claim carrying its URL or document/page, edition, evidence, confidence, and role. Current Organizer values are claims, and values from the previous edition are reference-only claims. Field resolutions show current value, applicable alternatives, historical context, and one of `resolved`, `conflict`, or `missing`. Apply accepts claim ids rather than raw client values; unselected or missing fields remain untouched. A document-only review remains useful when its findings can be scoped to a confirmed format.

Ravitos are also an explicit field choice. Omitting them preserves all station ids and product links. Selecting them replaces the complete source station set atomically; the review must warn that replacement changes ids and cascades existing station-product links. Missing water/solid/assistance flags keep the historical enabled defaults and must never be converted to `false` merely because a source omitted them.

Coverage and reliability scores help order evidence but are not a candidate-visibility or creation threshold. Provider adapters and parsed GPX values are high-confidence, structured data and dedicated format/regulation sections outrank generic text, and weak detections remain explicit for the admin to ignore instead of disappearing automatically. Only a high-confidence, conflict-free claim that fills a missing current value may be preselected. Replacements and medium/low-confidence claims always require explicit review.

The generic fallback keeps event facts and common logistics on the general URL, but it can also extract strongly structured format blocks exposed as accessible tabs on that same page. It follows up to six same-origin hint-matched links when that capacity is not already occupied by the twelve explicitly supplied additional official URLs. All secondary pages are fetched concurrently, with each fetch capped at eight seconds and oversized HTML truncated before parsing. Deterministic classification identifies event, single-format, multi-format, regulation, schedule, logistics, registration, results/archive, other, or unusable sources. OpenAI is called only for sources whose role or assertions remain ambiguous/incomplete. Up to 21 inputs keep the main page, twelve explicit additions, and eight documents representable while sharing one 48,000-character prompt budget; one source receives at most 12,000 characters and long text is sampled at the beginning, middle, and end. Every returned evidence excerpt, value, list item, and named format must occur in that source; invalid output falls back to deterministic results. The same bounded pass accepts text already extracted from PDFs, while scanned PDFs/images remain `ocr-pending`.

Only a named candidate from a compatible event/format/regulation source can establish format existence. Registration, results/archive, other, and unusable roles remain visible in the report but cannot create formats or field claims; unnamed kilometer observations remain unscoped. Event-level JSON-LD repeated on a format page is ignored as a format candidate when the same page exposes a more precise visible course identity. The extractor scores dates from their surrounding copy so a race date outranks registration deadlines, recognizes format sections under headings from `h1` through `h6`, and understands named regulation prose such as `« Fleurinoise » d'une longueur de 18 km`. It rejects distances belonging only to ravitos, barriers, age groups, prices, results, or analysis blocks. Parsed GPX measurements still override HTML values after an unambiguous format association. A content/model hash caches a successful LLM source analysis for 30 minutes, and the signed discovery claims are reused after format confirmation without a second source-model call.

Detections from multiple pages are consolidated only when their normalized identity evidence is compatible. An anonymous/distance-only detection remains a separate candidate, even when its distance exactly or approximately matches a named format; the admin can merge it during format confirmation. The displayed name removes generic prefixes and trailing distance/D+ metadata, and a distance remains a transparent fallback label rather than invented identity. The current edition is preferred when an older page conflicts with a newer regulation. GPX links and embedded public GeoJSON remain importable evidence, but a GPX is attached automatically only when its format identity is unambiguous.

After confirmation, claims are concordant when normalized text/list values agree, distance differs by at most `max(0.5 km, 2%)`, or D+/D- differs by at most `max(100 m, 8%)`. Only incompatible applicable claims trigger OpenAI. Its strict output can select an already supplied current/candidate `claimId` or answer `uncertain`; it cannot output a value or select an old-edition reference claim.

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
- access = format value when filled, otherwise event value, with parking, shuttles, road restrictions, and map content filtered by their format-level enabled access sections;
- schedule and runner notes = active-format details;
- services and partners = event details.
- key locations = plain text address plus optional geocoded `organizer_details` metadata for event, format, bib pickup, and start/finish access, rendered as GPS coordinates and Google Maps links when available.

The mobile Racebook view uses the same merge rules for live formats, but keeps them read-only and compact. Its top identity card contains event/format identity, the event date range, the best published location, compact `Solo` and/or `Relais` participation badges immediately before the optional distinct format date, and runner information, while distance, D+, D-, and start-time metric pills are omitted from this synthesis. Mixed participation uses two separate badges rather than one combined label. When the format date differs from the event start date, it is emphasized in a bordered calendar row labeled `Jour de course :` / `Race day:`. Weather and last-minute messages remain dedicated compact alert cards immediately below it. The route-local tabs remain `Matériel`, `Dossard`, `Course`, and `Accès`, with a fifth `Services` tab only when event service details are populated. A published `officialWebsiteUrl` occupies a content-sized action tile beside the race name without imposing a forced header height. The emergency phone uses a compact full-width action row immediately below the identity header and presents `Urgence - nom - téléphone` on one line; the native header retains only feedback. Tapping the emergency row opens the platform phone application through a normalized `tel:` URL, and the optional contact name stays visible without the narrow side-panel constraint. French phone values are normalized to `+33 X XX XX XX XX` both when organizer details are saved and when older JSON is read. The emergency phone counts as meaningful non-ravito organizer content for the Racebook availability gate. Equipment is split into active required, active recommended, and weather-conditional inactive groups; `Dossard` groups every pickup location first, renders its address directly without a redundant numbered location heading, then groups its slots by day so same-day ranges share one localized short weekday/day/month label and use locale-specific hour formatting before documents and notes. `Course` owns the explicitly labeled start time as the first light-green important-information row, keeps the finish cutoff critical, and contains the remaining schedule constraints plus the stored GPX map, elevation profile, and source aid stations without rendering separate empty cards for missing course blocks. `Accès` begins with start/finish linked locations, then parking, shuttles, road restrictions, the published map URL, and access notes; each of those four optional blocks is omitted when its format-level flag is disabled, regardless of a previously saved value. Published geocoded event, start, finish, or bib values remain tappable so runners can launch navigation directly. Equipment status badges stay inline and right-aligned, and weather-tagged items retain icon-only cold/heat markers while remaining muted whenever the active plan does not match. A native pull-to-refresh re-queries the complete published Racebook snapshot, profile, and route so organizer changes can appear without restarting the app; a failed refresh keeps the last successful snapshot visible.

Within the conditional `Services` tab, every populated event service category uses its own localized titled card. The organizer value is rendered as plain text rather than an unlabeled bullet.

Outside the Racebook, the mobile Courses tab is now the first runner surface for these organizer updates: favorited events are pinned to the top, a confirmed favorite addition shows a brief localized toast and scrolls to the newly pinned event, and unread previews add a `NEW` badge. In the event sheet, every format stays ahead of one light-green organizer-update panel; that panel initially shows only the newest (or deep-link-targeted) announcement, then reveals the other messages and longer history through `View more`. Pushes deep-link with event, optional format, and update ids so the sheet opens directly on the targeted message and highlights the concerned format. Identified runners persist read receipts only for messages displayed in the panel.

## GPX Replacement

Replacing a GPX updates the source `races` row and storage object for that format, then returns parsed stats, detected waypoint ravitos, and a transient elevation profile for the organizer dashboard preview. The dashboard immediately copies the exact returned distance, D+, and D- into the active format form and refreshes the same edition year, rather than waiting for a race-id change that may never occur. Existing saved plans remain snapshots: their `plan_gpx_path`, `elevation_profile`, `planner_values`, and `plan_aid_stations` are not automatically rewritten.

When GPX waypoints are present and the format has no aid stations, the organizer GPX route can create source `race_aid_stations` from normalized waypoints. When station rows already exist, the GPX route preserves them and reports detected waypoints without replacing rows, so station-product links survive. Existing station rows are edited through the aid station route.

Organizer aid station edits should preserve existing station ids when possible so `race_aid_station_products` links survive. New or legacy stations default all service flags to enabled unless an organizer disables water, solid food, or assistance explicitly.

Aid station `organizer_details` stores cumulative D+/D-, cutoff time, drop-bag availability, and organizer note on the station row; legacy `stationType` and `altitudeM` values may still exist in persisted JSONB, but the current organizer dashboard no longer exposes editors for them. These fields must still be saved through the organizer aid-station route so existing station ids are kept. In the current organizer UI, ravitos use the same expandable card pattern as the runner planner: the compact card keeps distance, cumulative D+/D-, cutoff, water/solid/assistance/drop-bag toggles, and product actions visible first, while the expanded panel goes directly from the main info grid to the organizer note block. When an active-format GPX preview is available, editing a ravito km now recomputes cumulative D+ / D- automatically from the GPX trace and the corresponding form fields remain read-only. The same ravito tile also owns the fixed `Départ` and `Arrivée` timing cards for the format. The mobile read-only Racebook now dedicates a right-hand metrics column on each ravito card to km, D+, D-, and cutoff time. Those D+/D- values are computed from cumulative station values, falling back to the first station's cumulative values when there is no previous published ravito.

On mobile, the Racebook keeps those ravito metrics in a compact right-hand column with each label inline beside its value. Water, solid food, assistance, and drop-bag services are icon-only buttons in the main ravito column; tapping one toggles a single inline information bubble with the service label, leaving more width and height for published products. Its access and bib information rows also size the value from its content: short values let the divider run to the value, while long linked locations keep a bounded width and wrap cleanly.

Ravitos in the organizer editor are always ordered by ascending distance from the start, including after creating a station or changing its km manually. The organizer aid-station route persists `order_index` from that distance-based order so reloads keep the same sequence.

Relay metadata is edited in the Ravitos module without changing nutrition semantics. A point may reference a saved ravito or stand alone. The dashboard derives legs from start, distance-sorted points, and finish. It saves ravitos before relay points, and switching a format to `solo` clears the relay collection. V1 exposes relay data only in the mobile Racebook; planner and nutrition calculations remain unchanged.

For relay-capable formats, the module separates its content into local `Ravitos` and `Relais` tabs. The ravito view is always the initial view after changing format or participation mode and contains the start card, ordered ravito cards, and finish card; the relay view contains only handover points and derived legs. Solo formats do not show a relay tab. The tab choice is local presentation state and does not alter dirty tracking or save payloads.

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

- L'action `Importer les informations` accepte la sélection de plusieurs PDF/images dans l'interface. L'extraction PDF texte conserve le numéro de page lorsque le parseur le fournit. Une très longue ligne garde un extrait centré sur la donnée détectée, borné à 2 000 caractères pour la preuve et 500 pour la valeur; les claims documentaires équivalents sont dédupliqués et limités à huit par scope et champ pour chaque document afin qu'un roadbook verbeux ne rejette pas la découverte. Les images et PDF sans texte nécessitent encore un OCR ; aucune donnée n'est inventée en son absence.
- Les documents sélectionnés par `Importer les informations` sont limités à 25 Mo par fichier et transférés directement depuis le navigateur vers le bucket privé temporaire `organizer-imports`, afin de ne pas traverser la limite de charge utile Vercel. Un PDF seul peut lancer la découverte sans URL principale. La session conserve uniquement les chemins nécessaires aux deux passes; apply, annulation ou nettoyage d'expiration supprime les objets. Le navigateur supprime aussi les objets déjà envoyés si la découverte ne peut pas démarrer. Les PDF texte produisent des claims paginés à confirmer; les images et PDF sans texte restent signalés `ocr-pending` tant qu'aucun OCR n'est disponible.

- Format-specific bib pickup is an explicit opt-in override. When `races.organizer_details.bibPickup.overrideEnabled` is false or absent, runner-facing reads use the event pickup; the format editor keeps GPS/autocomplete fields hidden.

- Keep automatic generic discovery same-origin, hint-filtered, and capped. Explicitly supplied additional official URLs may be cross-origin because the admin selected them, but they must still be classified and evidence-grounded before contributing claims.
- Do not interpret each `additionalUrls` entry as one format. A registration, result, logistics, or unusable page stays auditable without becoming a candidate. The legacy parser-only `formatUrls` option retains its former authoritative behavior for old one-pass callers.
- Reconstruct GPX only from complete public GeoJSON line geometry embedded in the fetched HTML. Do not infer a route from map tiles, screenshots, private endpoints, or isolated markers.
- Do not use `races.created_by` to authorize claimed public race edits.
- Do not expose organizer JSONB fields through public/mobile broad selects accidentally; public surfaces should keep explicit column selection.
- Keep emergency contact data event-scoped in `race_events.organizer_details`; do not copy it into every format or expose it outside the deliberate published Racebook read.
- Do not let the mobile Racebook bypass its three-part gate: catalog-live format, `racebook_is_live = true`, and meaningful organizer content. Direct links that fail any part must show the unavailable state.
- Do not make the new route sketch or elevation-profile blocks part of the availability gate. They are best-effort visuals and must stay optional when stored GPX/elevation data is missing.
- New organizer formats remain visible as courses (`is_live = true`) but start with `racebook_is_live = false` and no approval timestamp.
- The two-pass import is the incomplete-format exception: a newly confirmed import format remains `data_status = draft` and `is_live = false` until date, distance, and D+ are known; completion restores course visibility only.
- The normal Organizer format editor participates in the same lifecycle. Explicitly saving a missing date, distance, or D+ removes that key from `missing_required_fields`; the last required value changes the imported row to `complete`, restores `is_live`, and leaves `racebook_is_live = false`. Clearing a required date makes the row a hidden draft again. The dashboard exposes the draft state and the remaining required fields after reload.
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
- Treat the equipment override as tri-state while parsing historical JSON: explicit `true` replaces the full list, explicit `false` inherits the event list even if stale race items remain, and only an absent flag may infer a legacy override from stored differences.
- Do not move the active weather plan to race scope without revisiting preview, mobile Racebook, sync, and documentation rules; the current contract is one event-level plan shared by every format.
- Keep event-level bib pickup as the inherited default. A checked format override stores its own `locations[]` and nested `slots[]` in `races.organizer_details`; its dirty module must be saved and cleared with the other race-detail modules during navigation autosave. Preserve the legacy single-location/free-text fallback when reading historical rows.
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
- Keep new-edition dates and the optional duplication control inside the shared dialog; the compact header card should contain the edition selector, its adjacent delete cross, the edition visibility switch, and the creation button.
- Keep edition visibility and deletion membership-checked on the server. Deletion must use the database transaction boundary, must not detach orphan formats, and must retain at least one edition for an event.
- Re-showing an edition may restore complete course rows, but must never silently republish its Racebooks after they were hidden.
- Keep website-import writes conservative. Manual confirmation is the guardrail, and v1 should not overwrite existing race thumbnails or GPX files when those source assets are already present.
- A website-imported format without a GPX is still a valid draft. Preserve `gpx_storage_path = null`, but populate the legacy required `gpx_path` with its deterministic organizer placeholder; do not upload an invented GPX file.
- Do not purge expired import sessions directly in SQL. The hourly web cleanup removes every manifest Storage object before deleting the row.
- Do not use the website-import quality score as authorization or automatic validation. It is only a transparent summary of coverage and heuristic source confidence for the organizer review.
- Keep existence and completeness separate. A credible incomplete candidate must remain confirmable, and confirmation may create a hidden draft with missing fields.
- Bind discovery to the selected canonical edition id. A date found in a source is a claim to review, never authority to retarget the session silently.
- Do not accept raw review values on apply. Only decisions and claim ids from the unexpired event/edition/session-bound signed field snapshot may be selected, with one decision per scoped field.
- Keep automatic generic exploration same-origin, hint-filtered, size/time-limited, and bounded. Additional official URLs are classified sources, while missing formats stay addable manually in the first review.
- Do not treat every kilometer mention as a format. Ravito distances, barriers, age categories, result archives, prices, and training-analysis blocks need a course-level signal or a named format context.
- Never consolidate candidates or bind an existing format from distance alone. Anonymous detections remain separate until the admin supplies or confirms identity evidence.
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
- [race_relay_points](../02-database/tables/race-relay-points.md)
- [Nutrition Algorithm](nutrition-algorithm.md)
- [GPX Import](gpx-import.md)

