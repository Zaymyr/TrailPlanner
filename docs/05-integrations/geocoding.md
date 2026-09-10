---
title: Geocoding
scope: integration
last_verified: 2026-09-10
ai_priority: medium
related_files:
  - supabase/migrations/20260910074418_add_normalized_race_event_geography.sql
  - supabase/migrations/20260910082051_backfill_catalog_race_event_geography.sql
  - supabase/migrations/20260910103118_enrich_catalog_through_may_2027.sql
  - supabase/migrations/20260910083131_correct_translantau_country_code.sql
  - apps/web/app/organizer/_components/dashboard/structured-content-editors.tsx
  - apps/mobile/lib/racebook.ts
  - apps/web/app/api/location-search/route.ts
  - apps/web/lib/location-utils.ts
  - apps/web/app/organizer/_components/dashboard/address-autocomplete-field.tsx
  - apps/web/app/organizer/_components/dashboard/event-format-editors.tsx
  - apps/web/app/organizer/_components/dashboard/detail-editors.tsx
  - apps/web/lib/organizer-dashboard-details.ts
related_tables:
  - race_events
---

# Geocoding

## Purpose

This document describes the web geocoding/autocomplete integration used by the organizer dashboard to enrich location-like fields with optional coordinates and Google Maps links.

Structured restaurant and accommodation cards reuse the organizer address autocomplete and require a geocoded address. Mobile derives a display-only great-circle distance from the best available race start coordinate; it does not claim routing distance. The Maps URL opens the external provider for directions.

The structured-editor SAS summary contains only the format id, wave count, and earliest departure time. It drives the common schedule card above the Organizer tabs and does not alter or duplicate any geocoded start/finish location.

## Key Concepts

- Address autocomplete: server-backed search suggestions for typed addresses/places.
- Geocoded metadata: additive `lat/lng` and Google Maps URL stored next to the existing plain text fields.
- Canonical text field: the existing event/race/bib/access string that still drives publication checks and normal display.
- Runner-facing GPS affordance: coordinates and map links shown on published runner surfaces when geocoding data exists.
- Catalog geography: explicit normalized event columns used for exact city/department/region/country filtering and approximate nearby-city preselection.

## Current Flow

The current organizer flow is:

1. The user types into a route-local `AddressAutocompleteField`.
2. After 3+ characters and a short debounce, the component calls `GET /api/location-search?q=...`.
3. The route proxies the lookup to OpenStreetMap Nominatim server-side.
4. When the field or its parent scope already has coordinates, the component also sends a proximity bias so nearby suggestions rank first.
5. The user can keep typing free text normally; the component keeps the raw input locally and only syncs a manual location object on blur when no autocomplete suggestion was chosen.
6. The selected suggestion keeps the text input filled and also stores a structured location object in `organizer_details`.
7. Published runner surfaces read that structured object to display GPS coordinates and an "Ouvrir dans Google Maps" link for live formats only. The organizer dashboard no longer exposes an internal runner-preview dialog.
8. Bib pickup can repeat this flow for every entry in `bibPickup.locations[]`; each location keeps its own geocoded object and independent dated time slots.
9. The mobile Racebook can reuse every stored Google Maps URL for bib pickup plus start/finish rows.

The web field exposes the suggestion popup as an ARIA combobox/listbox, supports arrow-key navigation, Enter selection and Escape dismissal, and connects its visible label to the input. Bias coordinates participate in the debounced request dependencies so moving to another event or format cannot reuse a query with stale proximity context.

Manual free text is still allowed. In that case the helper stores the label plus a Google Maps search URL, but no coordinates.

The add-format editor can queue a GPX before the format exists, but that upload remains separate from geocoding. Address autocomplete still owns only the canonical location string plus structured metadata. Edition start/end dates come from `race_event_editions`; switching year changes the selected edition and attached `races` rows without changing location ownership or duplicating the event location into format addresses.

Format location follows the same opt-in pattern as its date. `Lieu différent de l'événement` is unchecked by default; when the format is saved, the current event label and structured location are persisted as its publication-ready location snapshot. Enabling it reveals `AddressAutocompleteField`; disabling it restores that event location snapshot.

The format-level `Accès - <format>` context and `Accès différents pour ce format` toggle live in the main module header. The address fields render directly in the module content only when that override is enabled; enabling it starts from the event access value and preserves the same `AddressAutocompleteField` instances, canonical strings, structured start/finish locations, and proximity bias.

## Provider Contract

`apps/web/app/api/location-search/route.ts` currently uses:

- provider: OpenStreetMap Nominatim search endpoint;
- server-side fetch only;
- per-IP in-memory rate limiting with `checkRateLimit`;
- `Accept-Language` forwarding from the incoming request when available;
- a France-neighbor country filter (`fr`, `mc`, `be`, `ch`, `lu`);
- optional `biasLat` / `biasLng` query params to favor suggestions near a known event or format location;
- a wider upstream fetch window plus local relevance scoring and deduplication before returning the final shortlist.

The route returns a narrow payload:

- `label`
- `lat`
- `lng`
- `googleMapsUrl`
- `subtitle`

## Stored Shape

Structured location objects use the organizer-details schema and may appear on:

- `organizer_details.eventLocation`
- `organizer_details.raceLocation`
- `organizer_details.bibPickup.locations[].locationDetails` (with legacy `bibPickup.locationDetails` retained as a fallback)
- `organizer_details.access.startLocation`
- `organizer_details.access.finishLocation`

Each object stores:

- `label`
- `lat`
- `lng`
- `googleMapsUrl`
- `source` = `manual | autocomplete`

## Normalized Catalog Geography

`race_events.location_city`, `location_department`, `location_region`, and `location_country` have stable companion codes. French events use INSEE commune, department and region codes, while `location_country_code` uses ISO alpha-2. `location_latitude` and `location_longitude` store the commune-centre anchor used for approximate nearby-city discovery.

These columns are separate from `organizer_details.eventLocation`: the normalized columns drive catalog filtering, while the JSON object drives labels and external Maps actions. A trusted enrichment may populate both from the same evidence. If the canonical `location` label changes without a matching normalized update, the database trigger clears the normalized fields rather than leave stale filter data.

The initial 2026-09-10 enrichment uses `geo.api.gouv.fr` administrative data and commune-centre coordinates for eight events identified through Search Console. A second catalog-wide pass resolves another 36 French event anchors by exact INSEE code. The organizer-source batch through May 2027 adds Rouffach and Cahors and corrects the existing Volvic anchor, bringing full commune-level coverage to 46 French events. It also normalizes the country of 50 official UTMB international events from their stored official catalog evidence, but leaves ambiguous city/admin/coordinate fields null. Official organizer pages remain authoritative for event identity and multi-city departure-arrival labels.

The public `/courses` search reads only the normalized locality names alongside public format/event location strings. It does not expose or search coordinates, organizer JSON, or stable codes, and it does not turn text matching into a claim of exact geographic containment.

## Gotchas

- RaceBook branding may recolor Maps buttons and location icons, but it must not alter stored coordinates, generated Google Maps URLs, deduplication, or location inheritance.
- Layout changes to the format metric fields must leave the canonical location text and structured `raceLocation` update paths unchanged.
- Do not use a copied event location to make the UI look like a custom override. Equality with the current event location must still render as inherited, even though the save payload persists the effective location required by catalog publication.
- Do not confuse format-location inheritance with access inheritance. Format access uses its own `access.overrideEnabled` flag and may copy event start/finish access metadata only when the organizer enables a specific access value.
- Do not replace the canonical text fields with geocoded JSON. Publication and normal text display still depend on the string fields.
- Do not use free-text parsing as a fallback for exact catalog geography. A missing normalized field means “not curated yet,” not permission to guess.
- Do not promote country-level international evidence into a city anchor. Venues, islands, provinces and multi-city races require separate locality verification before nearby-city discovery is enabled.
- Commune-centre coordinates are approximate discovery anchors, not exact start lines, course geometry or routing distances.
- Do not assume every historical organizer row has geocoded metadata or a `bibPickup.locations[]` array; old single-location rows should parse through the legacy fallback without losing their free-text schedule.
- The current Nominatim-backed route is intentionally lightweight. If usage grows, move to a dedicated paid or self-hosted geocoding service before increasing request volume.
- The current quality improvement is still heuristic on top of Nominatim. It helps French race addresses significantly, but it is not a full postal-address provider with rooftop accuracy guarantees.
- Google Places is a valid future replacement for autocomplete quality, but it requires a Google Maps Platform key, billing, quota management, and a review of Google usage terms before swapping providers.
- Keep the provider call server-side so browser clients do not depend directly on third-party geocoding availability or headers.
- Preserve the combobox roles, active-option relationship and keyboard behavior when changing suggestion rendering; mouse-only autocomplete is not an acceptable fallback.
- Google Maps links are generated locally from the selected label/coordinates; the app does not currently call a Google geocoding API.
- In the mobile Racebook access tab, generated start/finish links are exposed through explicit Maps buttons. Equal normalized start and finish address strings render as one location while retaining the first available generated link; the optional organizer-supplied general map remains a separate labeled action.
- Keep the organizer address/editor copy UTF-8 safe. `event-format-editors.tsx` mixes geocoded address controls with accented French labels, so a bad save/import encoding can surface mojibake such as `Ã©` right next to location fields.
- `organizer-dashboard-details.ts` also normalizes unrelated equipment overrides, event website/social URLs (including an HTTPS prefix for otherwise valid domain links), and event emergency-phone display values. It still rejects invalid and non-HTTP(S) links. Preserve those paths without changing any canonical or geocoded location field.

## Related Docs

- [Web App](../01-architecture/web-app.md)
- [Organizer Race Management](../03-business-rules/organizer-race-management.md)
- [race_events](../02-database/tables/race-events.md)
