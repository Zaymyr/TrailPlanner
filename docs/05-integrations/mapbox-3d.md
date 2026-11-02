---
title: Mapbox 3D Admin Course Viewer
scope: integration
last_verified: 2026-11-02
ai_priority: high
related_files:
  - apps/web/package.json
  - apps/web/.env.example
  - apps/web/app/admin/page.tsx
  - apps/web/app/admin/video-generator/page.tsx
  - apps/web/app/admin/video-generator/VideoGeneratorMap.tsx
  - apps/web/app/admin/video-generator/VideoGeneratorMapClient.tsx
  - apps/web/app/admin/video-generator/camera-controller.ts
  - apps/web/app/admin/video-generator/video-generator-catalog.ts
  - apps/web/app/api/admin/video-generator/races/[id]/route.ts
  - apps/web/lib/video-generator.ts
related_tables:
  - race_events
  - races
  - race_aid_stations
---

# Mapbox 3D Admin Course Viewer

## Purpose

The admin-only `/admin/video-generator` route renders existing race GPX files over satellite imagery and real 3D terrain. Phase 1 is an interactive preparation surface only: it does not animate a camera, capture frames, encode video, or install Remotion/FFmpeg.

## Key Concepts

- Mapbox GL JS is isolated to the admin video-generator chunk; existing public, Organizer, and mobile route maps remain on Leaflet.
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is a browser-visible public token and must be restricted to approved web origins in Mapbox.
- The shared GPX parser remains the geometry source of truth.
- Draft and published formats are available because the server verifies trusted admin `app_metadata` before any service-role read.
- Mapbox logo and source attribution remain enabled on the interactive map.

## Data Flow And Security

The page reuses `GET /api/admin/race-catalog` for the authorized event/format selector. Standalone formats are grouped under a synthetic UI label only; their database identity remains the stable race id.

`GET /api/admin/video-generator/races/[id]` then:

1. validates the UUID and bearer token;
2. verifies the user through Supabase Auth and `isAdminUser`;
3. reads the selected `races` row and ordered `race_aid_stations` with the server-only service role;
4. reads the private `race-gpx` object;
5. parses it with `apps/web/lib/gpx/parseGpx.ts`;
6. returns an explicit DTO with race metrics, stations, ordered points, elevation, cumulative distance and bounds.

The response never serializes the service credential, Storage path, signed URL, or raw GPX XML. A missing GPX is a successful `gpx.status = "missing"` response; invalid GPX returns `422`, and Supabase/PostgREST/Storage failures return `502`.

Changing the selected format aborts the previous browser request. The client also scopes its state to the current race id so a late response cannot replace the active route.

## Rendering And Camera

The Mapbox component loads with `next/dynamic` and `ssr: false`, then initializes Mapbox Standard Satellite plus `mapbox-terrain-dem-v1` with a restrained `1.15` terrain exaggeration. It preserves every parsed point in one GeoJSON line; Mapbox owns render-time tiling and simplification.

Start, finish and aid stations use separate GeoJSON marker layers so they remain part of the WebGL composition. Stations have no source latitude/longitude in `race_aid_stations`; the browser projects each station kilometer onto the nearest cumulative-distance GPX point using a binary search. This creates no database coordinate.

The camera controller is separate from rendering:

- **Vue d'ensemble** recomputes a full-route camera while preserving current bearing and pitch.
- **Réinitialiser la caméra** returns to north-up bearing `0` and pitch `55` over the complete route.
- a one-point route uses a stable close zoom rather than invalid zero-area bounds.

Future `flyTo`, `easeTo`, or frame-by-frame animation belongs in this controller boundary, not in GPX loading or the route layers.

## Environment And Provider Terms

- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`: public Mapbox token used only by the browser map. Restrict production, preview and local origins as needed; never place a Mapbox secret token in this variable.
- Mapbox GL JS usage is billed by map load under the provider's current pricing. The provider currently documents a free tier, but pricing can change and must be reviewed before rollout.
- Mapbox requires its logo and applicable Mapbox/OpenStreetMap attribution on maps using its styles, terrain or imagery.
- Phase 2 promotional video export requires written confirmation that the intended recording, distribution, attribution and satellite-imagery use are covered. Interactive-map access does not by itself settle that downstream licensing question.

Provider references:

- [Mapbox GL JS pricing](https://docs.mapbox.com/mapbox-gl-js/guides/pricing/)
- [Mapbox token URL restrictions](https://docs.mapbox.com/accounts/guides/tokens/)
- [Mapbox attribution](https://docs.mapbox.com/help/dive-deeper/attribution/)
- [Mapbox terrain](https://docs.mapbox.com/style-spec/reference/terrain/)

## Validation

- Route tests cover missing/invalid sessions, non-admin denial, draft reads, absent/invalid GPX, Storage failure and sensitive-field omission.
- Pure tests cover ordered GeoJSON, endpoint markers, station projection and one-point routes.
- Camera tests cover orientation-preserving overview and canonical reset.
- Manual validation needs a real restricted token and a known format such as SaintéLyon to confirm satellite imagery, terrain, controls, attribution and visual alignment.

## Gotchas

- Do not import Mapbox into public or Organizer Leaflet components; the dependency must remain route-local so public performance does not regress.
- Do not expose `gpx_storage_path` or raw GPX from the video-generator detail route.
- Do not filter draft formats in the admin selector; this tool is specifically allowed to prepare unpublished courses.
- Do not persist projected station coordinates. Their current source contract is `race_aid_stations.km` plus GPX geometry.
- Do not remove provider attribution from the map or from any future captured output without explicit provider approval.
- Do not describe phase 1 as video generation. It produces no video artifact.

## Related Docs

- [Web App](../01-architecture/web-app.md)
- [Infrastructure](../01-architecture/infrastructure.md)
- [GPX Import](../03-business-rules/gpx-import.md)
- [OpenStreetMap and Leaflet](openstreetmap-leaflet.md)
