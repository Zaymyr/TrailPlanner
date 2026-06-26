---
title: Geocoding
scope: integration
last_verified: 2026-06-26
ai_priority: medium
related_files:
  - apps/web/app/api/location-search/route.ts
  - apps/web/lib/location-utils.ts
  - apps/web/app/organizer/_components/dashboard/address-autocomplete-field.tsx
  - apps/web/app/organizer/_components/dashboard/event-format-editors.tsx
  - apps/web/app/organizer/_components/dashboard/detail-editors.tsx
  - apps/web/app/organizer/_components/dashboard/runner-preview-dialog.tsx
  - apps/web/lib/organizer-dashboard-details.ts
related_tables: []
---

# Geocoding

## Purpose

This document describes the web geocoding/autocomplete integration used by the organizer dashboard to enrich location-like fields with optional coordinates and Google Maps links.

## Key Concepts

- Address autocomplete: server-backed search suggestions for typed addresses/places.
- Geocoded metadata: additive `lat/lng` and Google Maps URL stored next to the existing plain text fields.
- Canonical text field: the existing event/race/bib/access string that still drives publication checks and normal display.
- Preview-only GPS affordance: coordinates and map links shown in the runner preview when geocoding data exists.

## Current Flow

The current organizer flow is:

1. The user types into a route-local `AddressAutocompleteField`.
2. After 3+ characters and a short debounce, the component calls `GET /api/location-search?q=...`.
3. The route proxies the lookup to OpenStreetMap Nominatim server-side.
4. When the field or its parent scope already has coordinates, the component also sends a proximity bias so nearby suggestions rank first.
5. The user can keep typing free text normally; the component keeps the raw input locally and only syncs a manual location object on blur when no autocomplete suggestion was chosen.
6. The selected suggestion keeps the text input filled and also stores a structured location object in `organizer_details`.
7. The runner preview reads that structured object to display GPS coordinates and an "Ouvrir dans Google Maps" link.
8. The mobile Racebook can reuse the same stored Google Maps URL for bib pickup plus start/finish rows.

Manual free text is still allowed. In that case the helper stores the label plus a Google Maps search URL, but no coordinates.

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
- `organizer_details.bibPickup.locationDetails`
- `organizer_details.access.startLocation`
- `organizer_details.access.finishLocation`

Each object stores:

- `label`
- `lat`
- `lng`
- `googleMapsUrl`
- `source` = `manual | autocomplete`

## Gotchas

- Do not replace the canonical text fields with geocoded JSON. Publication and normal text display still depend on the string fields.
- Do not assume every historical organizer row has geocoded metadata; old rows should parse to empty/default location objects.
- The current Nominatim-backed route is intentionally lightweight. If usage grows, move to a dedicated paid or self-hosted geocoding service before increasing request volume.
- The current quality improvement is still heuristic on top of Nominatim. It helps French race addresses significantly, but it is not a full postal-address provider with rooftop accuracy guarantees.
- Google Places is a valid future replacement for autocomplete quality, but it requires a Google Maps Platform key, billing, quota management, and a review of Google usage terms before swapping providers.
- Keep the provider call server-side so browser clients do not depend directly on third-party geocoding availability or headers.
- Google Maps links are generated locally from the selected label/coordinates; the app does not currently call a Google geocoding API.

## Related Docs

- [Web App](../01-architecture/web-app.md)
- [Organizer Race Management](../03-business-rules/organizer-race-management.md)
- [race_events](../02-database/tables/race-events.md)
