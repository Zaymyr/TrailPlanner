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
  - apps/web/app/admin/video-generator/VideoCompositionOverlay.tsx
  - apps/web/app/admin/video-generator/CompositionSettingsPanel.tsx
  - apps/web/app/admin/video-generator/video-composition.ts
  - apps/web/app/admin/video-generator/map-appearance.ts
  - apps/web/app/admin/video-generator/video-composition.test.ts
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
  - apps/web/app/admin/video-generator/route-story.ts
  - apps/web/app/admin/video-generator/route-clock.ts
  - apps/web/app/admin/video-generator/route-clock.test.ts
  - apps/web/app/admin/video-generator/route-story.test.ts
  - apps/web/app/admin/video-generator/narration-player.ts
  - apps/web/app/admin/video-generator/StoryEditor.tsx
  - apps/web/app/api/admin/video-generator/script/route.ts
  - apps/web/app/api/admin/video-generator/voice/route.ts
  - apps/web/lib/video-narration.ts
  - apps/web/app/admin/video-generator/InstagramPanel.tsx
  - apps/web/app/admin/video-generator/ExportPanel.tsx
  - apps/web/app/admin/video-generator/video-export.ts
  - apps/web/app/admin/video-generator/video-export.test.ts
  - apps/web/app/api/admin/video-generator/caption/route.ts
  - apps/web/lib/video-generator.ts
related_tables:
  - race_events
  - races
  - race_aid_stations
---

# Mapbox 3D Admin Course Viewer

## Purpose

The admin-only `/admin/video-generator` route renders existing race GPX files over satellite imagery and real 3D terrain. Phase 2 adds a deterministic automatic flyover and interactive timeline. Phase 3 priority 1 adds the full Reel composition preview (header, animated elevation profile, current kilometre, aid-station labels, branding, intro and outro) driven by one time function meant to be reused by the future MP4 export. It still does not capture frames, encode video, or install Remotion/FFmpeg.

## Key Concepts

- Mapbox GL JS is isolated to the admin video-generator chunk; existing public, Organizer, and mobile route maps remain on Leaflet.
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is a browser-visible public token and must be restricted to approved web origins in Mapbox.
- The shared GPX parser remains the geometry source of truth.
- Draft and published formats are available because the server verifies trusted admin `app_metadata` before any service-role read.
- Mapbox logo and source attribution remain enabled on the interactive map.
- The viewer fixes the projection to Mercator for consistent terrain rendering across desktop GPUs and observes its container so the WebGL canvas is resized after responsive layout changes.
- The page is a three-column workspace: race selection on the left, the phone preview with its compact transport bar in the middle (sized from the viewport height so the whole 9:16 frame is visible without scrolling), and the "Composition vidéo" settings on the right.
- The preview defaults to a 9:16 Instagram/Reels frame at a logical 1080 x 1920 ratio and can switch to a real 16:9 camera viewport. Neither preview captures or encodes video.
- The default basemap is the brand style `mapbox://styles/paceyourself/cmw0o76rp00bh01r10iuwh6vy`, owned by the Pace Yourself Mapbox account (cream background, brand-green hillshade and contours, sage forests, muted roads under prominent dashed brand-green trails with a light casing, peaks with altitude). Admins can switch to the classic `satellite-streets-v12`, Mapbox Standard Satellite or their own Mapbox Studio style (`mapbox://styles/<account>/<id>`, validated before use; the brand style is used until a valid URL is entered) without reloading the GPX. The public token must belong to the account that owns the brand style.
- `map-appearance.ts` applies the basemap look on style load and on setting changes, never per frame: five ambiances (Pace Yourself, natural, vivid, cinematic, night) set raster saturation/contrast/brightness and fog/sky, basemap place and road labels can be hidden (Standard uses its label configuration properties), terrain exaggeration ranges from 1 to 3 (default 1.8, the brand style hillshade is also stronger) and also feeds the camera clearance, and the route can be thin or bold with an optional blurred glow layer trimmed like the reveal layer. Defaults: brand green route `#2d5016` with a white casing (`video-route-line-casing`, trimmed like the reveal layer), thin, no glow, brand green accent, orange `#ff8a3d` for the told slope; the runner is a white dot ringed in the route colour with a soft shadow. Route and slope GeoJSON sources use `tolerance: 0`: simplified low-zoom tiles cut switchbacks short, which made the line progress, and the revealed trace, run ahead of the marker on winding climbs after a wide framing shot.
- Prominent summits (`natural_label` peaks and volcanoes with `filterrank` ≤ 3 from Mapbox Streets) are the generator's own `video-peak-labels` layer, labelled with name and altitude, so they stay visible when basemap labels are hidden. They are green on the brand style and white elsewhere.
- Map navigation buttons and the interactive attribution control are not rendered because the output is a video. Mapbox terms require the logo and attribution on captured output: the logo stays bottom-right on the map and "© Mapbox © OpenStreetMap" is burned into the overlay as legible text just above it; neither may be removed or hidden.
- Automatic playback is opt-in, defaults to 45 seconds and progressive route reveal. Durations are limited to the Reel presets 30, 45, 60 and 90 seconds, which include the optional 3-second intro and outro.
- `VideoCompositionSettings` (`video-composition.ts`) is a versioned, zod-validated, JSON-serializable object holding every visual choice (format, export resolution 540p/1080p, information toggles, route and accent colours, logo/CTA, sequences, disabled aid stations). "Copier la configuration" exports it so a render can be reproduced.

## Data Flow And Security

The page reuses `GET /api/admin/race-catalog` for the authorized event/format selector. Standalone formats are grouped under a synthetic UI label only; their database identity remains the stable race id.

`GET /api/admin/video-generator/races/[id]` then:

1. validates the UUID and bearer token;
2. verifies the user through Supabase Auth and `isAdminUser`;
3. reads the selected `races` row and ordered `race_aid_stations` with the server-only service role;
4. reads the private `race-gpx` object;
5. parses it with `apps/web/lib/gpx/parseGpx.ts`;
6. returns an explicit DTO with race metrics, stations, ordered points, elevation, cumulative distance and bounds.

Stations carry `water_available`, `solid_available`, `assistance_allowed` and, from `organizer_details` parsed with the shared organizer parser, whether the station is a life base, offers a drop bag, and its cutoff time. The race carries `race_date`, the organizer start time (`organizer_details.schedule.startTime`) and the first available start place (race then event start location/address, race location, `location_text`). Raw organizer JSON and organizer notes are never returned.

The response never serializes the service credential, Storage path, signed URL, or raw GPX XML. A missing GPX is a successful `gpx.status = "missing"` response; invalid GPX returns `422`, and Supabase/PostgREST/Storage failures return `502`.

Changing the selected format aborts the previous browser request. The client also scopes its state to the current race id so a late response cannot replace the active route.

## Rendering And Camera

The Mapbox component loads with `next/dynamic` and `ssr: false`, then initializes the compatibility satellite style plus `mapbox-terrain-dem-v1` with a restrained `1.15` terrain exaggeration. It preserves every parsed point in one GeoJSON line; Mapbox owns render-time tiling and simplification.

Start, finish and aid stations use separate GeoJSON marker layers so they remain part of the WebGL composition. Stations have no source latitude/longitude in `race_aid_stations`; the browser projects each station kilometer onto the nearest cumulative-distance GPX point using a binary search. This creates no database coordinate.

The camera stack is separated into three boundaries:

- **Vue d'ensemble** recomputes a full-route camera while preserving current bearing and pitch.
- **Réinitialiser la caméra** returns to north-up bearing `0` and pitch `55` over the complete route.
- a one-point route uses a stable close zoom rather than invalid zero-area bounds.
- `route-animation.ts` regularly samples cumulative GPX distance, resolves missing elevation from valid GPX neighbors and then loaded terrain, and exports the pure chase camera, overview camera and pose interpolation.
- `video-composition.ts` builds the timeline (intro, flyover, outro), the variable pacing, the aid-label schedule and the elevation profile once per configuration, and exposes `getVideoFrameState(timeline, timeMs)` plus `getVideoCameraPose`. The preview, the overlay and the future export all derive a frame from these two functions only.
- `animation-controller.ts` owns the monotonic playback clock, pause/resume, restart, seek and duration changes without accumulating camera state frame by frame.
- `camera-controller.ts` converts a calculated frame into Mapbox `FreeCameraOptions`; it never chains `flyTo` calls.

The camera path is capped at 2,500 regularly spaced samples for long ultras. The displayed route keeps every original GPX point. Playback updates only the free camera, the `line-trim-offset` of a bright reveal layer drawn over a faint full-route layer (both on one `lineMetrics` source), and the position of a DOM `mapboxgl.Marker` for the progress point. It never calls `setData` or rebuilds a `line-gradient` per frame: both re-tile or re-texture the route and made playback stutter. Camera interaction is disabled during playback and restored on pause or completion. Hidden tabs pause instead of jumping forward when they become visible again.

The chase camera always looks exactly at the progress marker, so the runner stays centred between the header and the profile. It sits behind the marker along a travel direction averaged over three symmetric chords (a hairpin rotates progressively instead of snapping) and is raised above the highest nearby GPX sample plus 300 m of clearance. Back distance and heading window scale with the average flyover speed rather than the instantaneous one, so framing stays stable while the pace changes. Portrait mode sits 20% further back and higher. The intro holds a pure north-up overview fitted to the route and glides to the start; the outro glides back to it.

The narration drives the video and tells the route as one continuous story. `route-story.ts` detects the significant climbs and descents (hysteresis on the profile smoothed over ±250 m, threshold 4% of total gain clamped to 60-150 m, flat ends trimmed) and cuts the route into consecutive legs covering 0 to the finish. Cut points are, by priority, the foot of the five hardest climbs (gain × √grade), life bases, climb tops, then aid stations; a reel keeps about one leg per 5.5 s (at most 20 within the 2-minute cap) and legs are at least 1 km or 4% of the route, a station close to a climb foot sharing that cut. Each leg is classified (start, climb, descent, life base, aid, flat, finish) and gets a French default narration that announces what comes next ("Départ : Musée de Bibracte. 7 kilomètres sans grosse difficulté jusqu'au ravito de… : avance à un rythme confortable", "la montée vers le Mont Thou : 6,7 kilomètres à 7 pour cent… Prends ton temps"); stations inside a leg are only mentioned in passing. Summit names come from the Mapbox Tilequery API (highest `natural_label` peak within 1.5 km of each climb top, fetched once per route with the public token). Organizer start addresses are shortened to their first part ("Musée de Bibracte").

`buildVideoTimeline` makes a continuous story last exactly as long as it is told: each leg lasts its narration (the real ElevenLabs duration once generated, otherwise about 15 characters per second, plus 0.5 s of silence), spread over the whole leg so the voice accompanies the camera until the next cut, with no silent dash between legs. Inside a leg the camera is slower near the point the leg starts from (×3.5 at the cut, fading over 12% of the leg) and on climbs (up to +140% at 15% or more, +50% on steep descents); a station pause is spent right at the point (0.9 s at an aid station, 2.2 s at a life base, over a dwell of 12% of the leg, 0.15 km to max(0.3 km, 1.2% of the route)). The voice and its caption start 0.4 s before the camera reaches the cut. In auto mode the reel length is the narration length (capped at 2 minutes); a manual length spreads any spare time across legs in proportion to their narration. Isolated beats keep the older behaviour (narration on a dwell, 70% at most, the rest as terrain-weighted transit). The time density is smoothed over 0.35% of the route. The script route gives each leg a word budget proportional to its share of the route (with a floor), so the camera keeps a similar pace from leg to leg. The camera orientation is computed from the pose (`getPitchBearing`: pitch and bearing of the camera → target vector, `setPitchBearing`) instead of `lookAtPoint`, which re-reads the terrain under the target every frame and made the view nod over ravines and ridges. Because the top of the frame holds the title, the profile and the leg card, `shiftIntoVisibleZone` moves the whole rig forward by 18% of its ground distance so the runner, or a framed slope, sits in the clear middle-low part of the picture. The camera flies like a helicopter: it aims at `getSmoothedCameraTarget`, the weighted mean of every route sample the runner covers within ±6 s (dense, so regularly spaced switchbacks cannot alias; the window shrinks symmetrically near the start and the finish so the start is centred; a leash keeps the aimed point within 10% of the camera distance of the runner so a fast runner stays in frame), so the dot drifts gently around the centre instead of shaking the picture; it looks down at 54° and its distance follows the ground speed over a ±6 s window (70% average, 30% local): 4.5 km behind at the slowest (×1.25 in portrait), up to 20 km on fast stretches. The runner stays centred but the camera does not chase the trail: `getOrbitLookDirection` places one keyframe per told leg (at the middle of its time on screen) looking along the leg overall direction (start to end, ignoring switchbacks) turned 35° to the side closest to the previous keyframe, for a three-quarter view of the relief, and glides between keyframes with a smoothstep over the whole time between them (under 1.5° per frame). Without legs it falls back to `getTimeSmoothedHeading`, the chords between where the runner is ±3, ±6 and ±9 s away. The high, distant viewpoint keeps whole sections readable and removes the small camera movements of a winding trail. While a climb or descent is told, the camera rises over 3.5 s to `getSegmentFramingPose`, then hands back to the chase camera as the runner climbs (from 35% to 80% of the slope), so the dot never leaves the frame and the camera never catches up at once; a shot looking along the whole slope from behind its foot, seen from high above (62°) at about 1.5 times its length (6-30 km) so the foot, the top and the high point read at once. Finally `getVideoCameraPose` reads the frame from a flight computed once per timeline and format: `getRawVideoCameraPose` sampled every 100 ms over the whole reel, then a gaussian low-pass in time (σ = 1.8 s, ends held) on the camera position and on the aimed point, so every turn, speed change and climb shot becomes a long glide, while each frame stays a pure function of time (the export renders the same flight as the preview).

The day/night look comes from `route-clock.ts`. A classic mid-pack pace in effort-km per hour (`11 − 1.1 × ln(effort / 10)`, effort = km + D+/100 + D−/400, between 4.5 and 11) plus 3 min per aid station and 15 min per life base gives an estimated passing time per kilometre, pulled earlier wherever an organizer cutoff would otherwise be missed (85% of the allowed time). With the race date and start time (Europe/Paris), low-precision NOAA formulas give the sun elevation and azimuth at the start coordinates. The daylight level (smoothstep of the sun elevation from −16° to +10°, averaged over ±8% of the route so the video fades slowly even if it is not exactly on time) blends fog, sky and a few stars from a blue, readable night to the ambiance colours with a warm tint around sunrise and sunset, dims satellite imagery to 60% at most, turns hillshade light toward the sun and switches the Standard `lightPreset`; these map changes are applied only when the quantized daylight changes. The overlay adds a light navy multiply veil at night (32% at most) and a warm soft-light tint at dawn and dusk (works on any basemap) and shows the estimated time next to the altitude. Legs gain an `≈ HH:MM` fact and night, sunrise or nightfall mentions. Without a start time the look stays in daylight; the "Jour / nuit" setting turns it off. Intro and outro last their narration (3 s minimum). Every reel is capped at 2 minutes: auto mode starts at 30/45/60/90 s for routes under 25/60/120 km or longer and grows with the narration up to 120 s; manual lengths go up to 120 s and flag a narration that does not fit. Narrations never overlap. The cumulative table is inverted with a binary search, which keeps any time → distance lookup deterministic and seekable.

The script is edited in the "Narration" panel. "Rédiger avec l’IA" posts the beats and their facts to `/api/admin/video-generator/script`: admin only, Claude Opus 5.5 with structured output (max_tokens 16,000 because its always-on thinking counts toward the limit; a cut-short JSON returns an explicit retry message), server-side refusal fallback, and a prompt that asks for a continuous race briefing in the voice of a trail-running friend (familiar, trail vocabulary, never vulgar) with pacing advice, each leg between 75% and 100% of its word budget, mentions stations naturally, forbids inventing facts and splits a 2-minute word budget (about 2.4 words per second) across legs, climbs getting a little more. "Générer la voix off" posts the texts to `/api/admin/video-generator/voice`, which calls ElevenLabs `with-timestamps` with the chosen model (`eleven_multilingual_v2`, steady, or `eleven_v3`, far more expressive; v3 takes no neighbouring text and only the stability presets 0 / 0.5 / 1) and voice settings derived from an intonation slider; with v3 the script prompt allows at most one English performance tag per leg ([excited], [laughs], [sighs]…), spoken as intonation and stripped (`stripVoiceTags`) from subtitles, timing estimates and alignment mapping; (v2: stability 0.7 → 0.2, style 0.1 → 0.6, speaker boost) two sentences at a time (the free plan allows 2 parallel requests, Starter 3) and retries a sentence after 0.8, 1.6 and 3.2 s when the parallel limit is still hit, with neighbouring sentences as context, and returns base64 MP3 clips with their spoken duration and, when the alignment maps one-to-one onto the text, per-character end times used for subtitles. A clip stays valid only while its text is unchanged. `narration-player.ts` decodes the clips with Web Audio and schedules each at its beat's `narrationStartMs`, restarting on play, seek and restart so the voice stays in sync with the camera. Requests carry up to 40 beats or sentences; a rejected payload names the offending field. ElevenLabs errors are translated into actionable admin messages: the key ID pasted instead of the secret `sk_` key, a free plan that cannot use library voices through the API (use a premade voice or a paid plan), missing Text to Speech permission, quota. An empty `ELEVENLABS_VOICE_ID` falls back to the default premade voice. Audio and edited scripts are not persisted yet.

The "Publication Instagram" panel asks `/api/admin/video-generator/caption` (admin only, Claude Opus 5.5, structured output, refusal fallback, max_tokens 16,000) for a Reel description: a hook line, a short story of the race from the told legs in the same trail-buddy tone, a call to action to the app (link in bio, iPhone and Android) and a question, 500-1,200 characters, plus 15-20 hashtags. Hashtags are normalised server-side (no accents, letters, digits and underscores, unique, 30 at most). Both stay editable, with Instagram limits shown (2,200 characters, 30 hashtags), and are copied together in one click. Publishing to Instagram itself is out of scope.

The "Export vidéo" panel renders the MP4 in the browser (`video-export.ts`), deterministically: the preview frame is laid out at the exact video size (540 × 960 or 1080 × 1920, swapped in 16:9; scaled down on screen by wrappers so the capture is not scaled, without the phone border), then for every frame at `index / 30 fps` the viewer applies the frame, lets React paint the overlay and waits for the map `idle` event (tiles loaded, 6 s timeout). Each frame is composited on a canvas: the Mapbox canvas (map created with `preserveDrawingBuffer: true`), then the frame DOM rasterised with `html-to-image` (fonts embedded once, the map canvas skipped; markers, cards, subtitles and the Mapbox logo included). `mediabunny` (pinned 1.61.6) encodes H.264 (3.5 Mb/s at 540p, 10 Mb/s at 1080p, a key frame every 2 s) and the voice-over mixed offline at its cue times as AAC 160 kb/s, into an MP4 with the index at the start. The export needs Chrome or Edge (WebCodecs H.264/AAC) and a visible tab (Mapbox does not draw in a background tab); progress, remaining time and cancel are shown, then the file downloads as `<race>-reel.mp4`.

The settings panel keeps relief exaggeration and video quality as quick settings; every other group (format and duration, map, route and camera, displayed information, colours and brand, sequences, aid stations) is collapsed by default. In the narration panel the voice model, intonation and voice id sit right under the generation buttons and the narration texts are collapsible. The right column takes the remaining width; the preview sits next to the race column.

The composition overlay is plain DOM above the map, sized in `cqmin` container units so the preview and a 1080 x 1920 capture share the same layout. It reads frames from a small external store with `useSyncExternalStore`, leaving the rest of the page at the existing 10 Hz snapshot rate. The elevation profile path is computed once (at most 400 points); frames only move a clip rectangle and a cursor whose distance is the exact marker distance. The layout keeps a compact title band at the top (title on one line, subtitle and stats pill on the next), the elevation profile right under it, the map in the middle and the leg card under the profile band and the burned-in subtitles of the voice-over at the bottom above the footer (white medium-weight text on a brand-green band with a soft shadow) (sentences split into lines of at most 60 characters, timed exactly from the ElevenLabs per-character alignment when it matches the text, otherwise in proportion to their length), readable whatever the route does: a kind chip (Départ, Montée, Descente, Ravito, Base de vie, Arrivée), a title (station name, or the km range of a slope) and its facts with service icons. Bubbles pinned on the map were dropped because they became unreadable when the route zigzags. While a climb, descent or rolling section is narrated, the slope itself (`focusStartKm`-`focusEndKm`: the whole climb from foot to top, even when the leg is cut at a station) gets an orange border: a line in the highlight colour (default soft orange `#d9925b`, setting "Section racontée") 4 px wider than the white casing, drawn under every route layer (`video-beat-segment-line`), so the green route keeps its colour and only the edges turn orange; it is removed as soon as the runner is past the slope top; it is updated only when the beat changes. Climb narrations quote the whole climb too. Start, finish and aid stations are round icons drawn by the map (`video-route-marker-icons` symbol layer, images painted on a canvas and re-registered on style load and accent change) at the exact route point of their kilometre, so they sit on the route at terrain level: a flag on the accent colour for the start, a chequered flag on black for the finish, a bottle on white for an aid station, a tent on the accent colour for a life base. Above a station, a white DOM card with a brand-green edge (Mapbox marker anchored 18 px above the icon) shows a "Base de vie" pill when relevant, the name in uppercase brand green, with the name with a "Base de vie" prefix, kilometre, cumulative D+ from the start (5 m jitter threshold) and cutoff. The cutoff is shown in red with a clock icon. While a climb or descent is told, one reused brand-green card with an orange edge and orange figures sits in the middle of the slope with its title ("Montée vers …" with the summit when known) and figures (length, D+ or D−, average grade), from the start of its narration until the voice ends or the runner reaches the top. A station card shows from 3.5 s before the runner reaches its station to 1.5 s after (0.4 s fades, video time, so it behaves the same at any flyover speed); opacity is written only when its rounded value changes. Mapbox owns the marker element (absolute position, transform, occlusion opacity), so styles and fading live on its children only; styling the element itself stretched the card and anchored it away from the point. Setting "Bulles des ravitos". Stations the story leaves out are flagged "non raconté" in the panel. The accent colour is only used as a background (pills, bubble border, progress) so a dark brand green stays legible on the dark gradients.

The elevation profile spans the full frame width and, by default, scrolls: it shows an 18% window of the route (6 to 25 km) with the cursor at 35%, plus kilometre ticks, the current altitude and grade, and a thin full-route bar locating the window. "Parcours entier" keeps the whole route instead. Every camera sample is drawn once as slope-coloured segments (descent, rolling, 4-10%, 10-18%, above 18% over ±100 m); a frame only changes the SVG `viewBox` and a dimming rectangle over the remaining route. Essential information stays out of the right-hand Instagram action column and above the bottom caption area. Disabled stations are removed from the map markers and the pacing; the station being announced is enlarged on the map.

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
- Composition tests cover settings defaults and JSON round-trip, intro/flyover/outro split, slower climbs and aid stations, aid-label collisions, deterministic frames, the intro camera glide and the bounded profile.
- UI and mocked-Mapbox tests cover the default 9:16/45-second/progressive state, seek, terrain/layer setup, FreeCamera application, information toggles, style switching and cleanup.
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
- Do not show the fatal map error for tile, sprite or glyph errors (events carrying `sourceId` or `tile`) once the layers are ready; Mapbox keeps rendering. Only token rejections (401/403) or failures before the style is usable block the viewer.
- Do not gate animation frames on `map.isStyleLoaded()`. In Mapbox GL v3 it stays false while any tile loads or a source has pending updates, which is continuous during a flyover; the viewer tracks its own layers-ready flag, reset on style switches.
- Do not compute overlay content, camera or pacing anywhere else than `video-composition.ts` and `route-animation.ts`; the export must replay exactly what the preview shows.
- Do not describe the current preview as video generation. It produces no video artifact until the export phase ships.

## Related Docs

- [Web App](../01-architecture/web-app.md)
- [Infrastructure](../01-architecture/infrastructure.md)
- [GPX Import](../03-business-rules/gpx-import.md)
- [OpenStreetMap and Leaflet](openstreetmap-leaflet.md)

## Background render and voice library

"Générer en arrière-plan" (under the MP4 export) saves the composition and renders it on Google Cloud Run in headless Chrome, so the tab can be closed; the finished MP4 is listed in the same panel. `VideoGeneratorMapClient` accepts a `render` prop (`VideoRenderHooks`): it seeds settings, narration overrides, summit names and voice clips from the snapshot, skips the Tilequery lookup, hides every panel, exports at scale 1 as soon as the map is ready and hands the blob over instead of offering a download. See [Google Cloud Background Reel Render](google-cloud-video-render.md). When the browser has no native AAC encoder (Linux Chrome, Firefox), the export registers `@mediabunny/aac-encoder` (pinned to the `mediabunny` version). `VideoRaceInfo` carries the catalog race `id` to file renders.

The ElevenLabs voice field (`VoiceIdPicker`, `voice-library.ts`) remembers voices in this browser's `localStorage` (`py.videoGenerator.voices`): every voice used for a successful voice-over joins a 6-entry recent history, a voice can be saved under a name (kept until removed), chips select a voice in one click, and the last one used is filled in on the next visit. It is a per-browser convenience, not shared between admins or devices.

The script request accepts a station cutoff of up to 120 characters: organizers type it as free text ("Samedi 14h30 au plus tard"), not only a clock time.
