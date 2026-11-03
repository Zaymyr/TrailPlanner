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
  - apps/web/app/admin/video-generator/VideoGeneratorMapClient.test.ts
  - apps/web/app/admin/video-generator/AnimationControls.tsx
  - apps/web/app/admin/video-generator/AnimationControls.test.ts
  - apps/web/app/admin/video-generator/animation-controller.ts
  - apps/web/app/admin/video-generator/animation-controller.test.ts
  - apps/web/app/admin/video-generator/camera-controller.ts
  - apps/web/app/admin/video-generator/camera-controller.test.ts
  - apps/web/app/admin/video-generator/map-resize-controller.ts
  - apps/web/app/admin/video-generator/route-animation.ts
  - apps/web/app/admin/video-generator/route-animation.test.ts
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

The admin-only `/admin/video-generator` route renders existing race GPX files over satellite imagery and real 3D terrain. Phase 2 adds a deterministic automatic flyover and interactive timeline. It still does not capture frames, encode video, or install Remotion/FFmpeg.

## Key Concepts

- Mapbox GL JS is isolated to the admin video-generator chunk; existing public, Organizer, and mobile route maps remain on Leaflet.
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is a browser-visible public token and must be restricted to approved web origins in Mapbox.
- The shared GPX parser remains the geometry source of truth.
- Draft and published formats are available because the server verifies trusted admin `app_metadata` before any service-role read.
- Mapbox logo and source attribution remain enabled on the interactive map.
- The viewer fixes the projection to Mercator for consistent terrain rendering across desktop GPUs and observes its container so the WebGL canvas is resized after responsive layout changes.
- The preview defaults to a 9:16 Instagram/Reels frame at a logical 1080 x 1920 ratio and can switch to a real 16:9 camera viewport. Neither preview captures or encodes video.
- The classic `satellite-streets-v12` style is the default compatibility basemap. Admins can switch to Mapbox Standard Satellite at runtime to compare rendering without reloading the GPX.
- Automatic playback is opt-in, defaults to 45 seconds and progressive route reveal, and exposes presets plus a bounded 10-300 second custom duration.

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

The Mapbox component loads with `next/dynamic` and `ssr: false`, then initializes the compatibility satellite style plus `mapbox-terrain-dem-v1` with a restrained `1.15` terrain exaggeration. It preserves every parsed point in one GeoJSON line; Mapbox owns render-time tiling and simplification.

Start, finish and aid stations use separate GeoJSON marker layers so they remain part of the WebGL composition. Stations have no source latitude/longitude in `race_aid_stations`; the browser projects each station kilometer onto the nearest cumulative-distance GPX point using a binary search. This creates no database coordinate.

The camera stack is separated into three boundaries:

- **Vue d'ensemble** recomputes a full-route camera while preserving current bearing and pitch.
- **Réinitialiser la caméra** returns to north-up bearing `0` and pitch `55` over the complete route.
- a one-point route uses a stable close zoom rather than invalid zero-area bounds.
- `route-animation.ts` regularly samples cumulative GPX distance, resolves missing elevation from valid GPX neighbors and then loaded terrain, and exports deterministic `getCameraStateAtTime` calculations.
- `animation-controller.ts` owns the monotonic playback clock, pause/resume, restart, seek and duration changes without accumulating camera state frame by frame.
- `camera-controller.ts` converts a calculated frame into Mapbox `FreeCameraOptions`; it never chains `flyTo` calls.

The camera path is capped at 2,500 regularly spaced samples for long ultras. The displayed route keeps every original GPX point. Playback updates only the free camera, the `line-trim-offset` of a bright reveal layer drawn over a faint full-route layer (both on one `lineMetrics` source), and the position of a DOM `mapboxgl.Marker` for the progress point. It never calls `setData` or rebuilds a `line-gradient` per frame: both re-tile or re-texture the route and made playback stutter. Camera interaction is disabled during playback and restored on pause or completion. Hidden tabs pause instead of jumping forward when they become visible again.

The dynamic-following preset derives look-ahead, setback, smoothing and clearance from route distance divided by selected duration. Portrait mode raises and looks farther ahead than landscape mode so the route remains framed around the title and future elevation-profile safe areas. Additional aerial/cinematic presets are intentionally deferred.

## Environment And Provider Terms

- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`: public Mapbox token used only by the browser map. Restrict production, preview and local origins as needed; never place a Mapbox secret token in this variable.
- Mapbox GL JS usage is billed by map load under the provider's current pricing. The provider currently documents a free tier, but pricing can change and must be reviewed before rollout.
- Mapbox requires its logo and applicable Mapbox/OpenStreetMap attribution on maps using its styles, terrain or imagery.
- Phase 3 promotional video export requires written confirmation that the intended recording, distribution, attribution and satellite-imagery use are covered. Interactive-map access does not by itself settle that downstream licensing question.

Provider references:

- [Mapbox GL JS pricing](https://docs.mapbox.com/mapbox-gl-js/guides/pricing/)
- [Mapbox token URL restrictions](https://docs.mapbox.com/accounts/guides/tokens/)
- [Mapbox attribution](https://docs.mapbox.com/help/dive-deeper/attribution/)
- [Mapbox terrain](https://docs.mapbox.com/style-spec/reference/terrain/)

## Validation

- Route tests cover missing/invalid sessions, non-admin denial, draft reads, absent/invalid GPX, Storage failure and sensitive-field omission.
- Pure tests cover ordered GeoJSON, endpoint markers, station projection and one-point routes.
- Animation tests cover distance interpolation, sample caps, missing/invalid elevations, deterministic camera frames, playback controls and duration preservation.
- UI and mocked-Mapbox tests cover the default 9:16/45-second/progressive state, custom duration, seek, terrain/layer setup, FreeCamera application, style switching and cleanup.
- Manual validation needs a real restricted token and known short/long formats such as SaintéLyon and Diagonale des Fous to confirm terrain clearance, smooth turns, exact end state, both aspect ratios, attribution and visual alignment.

## Gotchas

- Do not import Mapbox into public or Organizer Leaflet components; the dependency must remain route-local so public performance does not regress.
- Do not expose `gpx_storage_path` or raw GPX from the video-generator detail route.
- Do not filter draft formats in the admin selector; this tool is specifically allowed to prepare unpublished courses.
- Do not persist projected station coordinates. Their current source contract is `race_aid_stations.km` plus GPX geometry.
- Do not remove provider attribution from the map or from any future captured output without explicit provider approval.
- Do not put positioning utilities such as `absolute inset-0` on the element passed to `new mapboxgl.Map({ container })`. Mapbox adds `.mapboxgl-map { position: relative }`, and the production stylesheet order lets it override Tailwind, collapsing the container to 0px height and showing only the black viewer background. Position a wrapper and give the container `h-full w-full`.
- Do not mutate, thin or progressively slice the displayed GPX source. Camera samples are derived separately and route reveal trims a `lineMetrics` layer with `line-trim-offset`.
- Do not make rotation smoothing depend on the previous rendered frame. Seeking and future frame export require the same time to reproduce the same camera state.
- Do not gate animation frames on `map.isStyleLoaded()`. In Mapbox GL v3 it stays false while any tile loads or a source has pending updates, which is continuous during a flyover; the viewer tracks its own layers-ready flag, reset on style switches.
- Do not describe phase 2 as video generation. It produces no video artifact.

## Related Docs

- [Web App](../01-architecture/web-app.md)
- [Infrastructure](../01-architecture/infrastructure.md)
- [GPX Import](../03-business-rules/gpx-import.md)
- [OpenStreetMap and Leaflet](openstreetmap-leaflet.md)
