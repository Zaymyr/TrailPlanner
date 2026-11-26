---
title: MET Norway Course Weather
scope: integration
last_verified: 2026-11-26
ai_priority: medium
related_files:
  - apps/web/app/api/race-weather/route.ts
  - apps/web/app/api/race-weather/route.test.ts
  - apps/web/lib/course-weather/service.ts
  - apps/web/lib/race-runner-visibility.ts
  - apps/web/lib/course-weather/met-norway.ts
  - apps/web/lib/course-weather/points.ts
  - apps/web/lib/course-weather/time-zone.ts
  - apps/web/lib/course-weather/course-weather.test.ts
  - apps/web/lib/course-weather-presentation.test.ts
  - packages/shared/src/course-weather/index.ts
  - packages/shared/src/course-weather/types.ts
  - packages/shared/src/course-weather/presentation.ts
related_tables:
  - races
  - race_events
  - race_event_editions
  - race_aid_stations
  - race_start_waves
---

# MET Norway Course Weather

## Purpose

`GET /api/race-weather?raceId=<uuid>` returns the weather forecast along a race course (start, aid stations, highest point, finish) around the official start, for the web planner and the mobile app. The source is MET Norway Locationforecast 2.0.

**Display-only.** Weather values never feed the pacing or nutrition calculations. This stays true until the thresholds have been calibrated on several real races (decision 2026-11-23 in `docs/context/DECISIONS.md`).

No migration, no stored weather, no new npm dependency: every response is computed on request and cached by Next.js and the CDN.

## Key Concepts

- **Source and terms.** MET Norway Locationforecast 2.0 (`https://api.met.no/weatherapi/locationforecast/2.0/complete`) is free, including commercial use, under CC BY 4.0 (and NLOD). Two obligations:
  - **Attribution** next to any weather display: `source.attribution` = `Données météo : MET Norway (CC BY 4.0)`, `source.url` = `https://api.met.no/`. UIs must render it.
  - **Identifying User-Agent** on every request: `PaceYourself/1.0 (+https://pace-yourself.com)` (`MET_NORWAY_USER_AGENT`). Never a personal e-mail address. Requests without one are rejected (403).
  - MET also asks clients to cache, respect `Expires`, send at most 4 decimals of latitude/longitude and stay well under 20 requests/second per application.
- **Open-Meteo is rejected**: its free tier forbids commercial use and the paid tier costs about 30 €/month.
- **Contract**: `packages/shared/src/course-weather/types.ts` (`CourseWeatherResponse` = `forecast` | `too_early` | `unavailable`), shared by web and mobile. Pure presentation helpers (nearest hour, feels-like, alerts, summaries, weather at planned passages) live in `packages/shared/src/course-weather/presentation.ts`.

## Endpoint

`apps/web/app/api/race-weather/route.ts` → `buildCourseWeather` in `apps/web/lib/course-weather/service.ts`.

| Case | HTTP | Body | `Cache-Control` |
|---|---|---|---|
| Invalid `raceId` | 400 | `{ message }` | `no-store` |
| Unknown or runner-hidden race | 404 | `{ message }` | `no-store` |
| Rate limit (30 / min / IP, in-memory) | 429 | `{ message }` | `no-store` |
| Supabase read failure | 502 | `{ message }` | `no-store` |
| `forecast` | 200 | `CourseWeatherForecast` | `public, s-maxage=1800, stale-while-revalidate=3600` |
| `too_early` | 200 | `CourseWeatherTooEarly` | `public, s-maxage=21600, stale-while-revalidate=3600` |
| `unavailable` (any reason) | 200 | `CourseWeatherUnavailable` | `no-store` |

No authentication: the endpoint only serves races a runner can already see.

### Visibility

`isRaceRunnerVisible` in `apps/web/lib/race-runner-visibility.ts` (shared with `GET /api/race-terrain`, see [Course Terrain](../03-business-rules/course-terrain.md)) mirrors the anon branches of the `races_select` policy (`supabase/migrations/20260911114106_expose_private_formats_in_visible_catalog.sql`), read with the service role:

- `races.is_public = true`, and the parent event is not `is_live = false`; then
- `races.is_live = true` (public format), **or**
- `racebook_preview_is_visible = true`, a live parent event and, when the format has an edition, `race_event_editions.is_visible = true` (the mobile catalog's private state).

Anything else answers 404, like an unknown id.

### Status rules (in order)

1. No `race_date` → `unavailable / no_date`.
2. Time zone from the event (see below); `today` = race-local date of now.
3. `race_date < today − 1` → `unavailable / past` (the day after the race still gets a forecast).
4. `race_date > today + COURSE_WEATHER_HORIZON_DAYS` (9) → `too_early`, `availableFrom = race_date − 9 days`.
5. No GPX track and no `start_lat`/`start_lng` → `unavailable / no_route`.
6. Every MET point call failed → `unavailable / provider_error`. Partial failures drop only the failed points.
7. MET answered but has no hour in the window (start beyond its last step) → `too_early` with `availableFrom = today + 1`, or `past` when the start is behind us.

### Start instant and time zone

- Start clock: earliest `race_start_waves.start_time` (authoritative when present, see `docs/02-database/tables/race-start-waves.md`), else `races.organizer_details.schedule.startTime`, else **07:00 local** with `startTimeIsEstimated: true`. Clock texts such as `7h30`, `07:30` or `07:30:00` are accepted.
- Time zone (`courseWeatherTimeZone`): `race_events.location_country_code` → IANA zone (common European countries, e.g. `FR` → `Europe/Paris`, `CH` → `Europe/Zurich`). French overseas regions are resolved from the INSEE `location_region_code`: `01` America/Guadeloupe, `02` America/Martinique, `03` America/Cayenne, `04` Indian/Reunion, `06` Indian/Mayotte (also when the ISO code is `GP`/`MQ`/`GF`/`RE`/`YT`). Unknown or missing → `Europe/Paris`.
- Local date + clock → UTC with `Intl` only (`zonedLocalTimeToUtc`), DST-safe: a skipped spring-forward clock resolves one hour later, an ambiguous fall-back clock to its first occurrence.

### Forecast points (`apps/web/lib/course-weather/points.ts`)

From the parsed GPX (`apps/web/lib/gpx/parseGpx.ts`, `race-gpx` storage, `force-cache` because GPX paths are versioned):

- `start` (km 0) and `finish` (`distanceKm` = official `distance_km`, else GPX length; position = GPX end).
- One `aid_station` per `race_aid_stations` row (`aid-<order_index>`), projected on the track by its official km with linear interpolation of lat/lon/elevation (clamped to the track ends). Stations within 0.5 km of the start or finish are dropped (they duplicate those points).
- `summit` = highest GPX point, unless within 2 km of another selected point.
- At most 15 points: start, finish and summit are kept; aid stations are thinned evenly (first and last kept).
- Without a usable GPX: a single `start` point from `start_lat`/`start_lng`, `altitudeM: null`.
- Latitude/longitude rounded to 4 decimals, altitude to integer metres and sent as `altitude` so MET corrects the temperature for elevation.

### MET calls (`apps/web/lib/course-weather/met-norway.ts`)

- One `GET …/complete?lat=&lon=&altitude=` per point, at most 4 in flight, through the Next.js data cache (`next: { revalidate: 3600 }`, keyed by URL so identical points share one call).
- `expiresAt` = earliest future `Expires` header of the answered points, else `fetchedAt + 1 h`.

### Parsing and 6-hour expansion

- Instant values: `air_temperature`, `wind_speed` and `wind_speed_of_gust` (m/s × 3.6 → km/h), `wind_from_direction`, `relative_humidity`, `cloud_area_fraction`.
- Period values from `next_1_hours`: `summary.symbol_code`, `precipitation_amount`, `probability_of_precipitation`.
- After about 2.5 days MET publishes 6-hour steps. Each is expanded to hourly entries: instant values interpolated linearly towards the next step (wind direction along the shortest arc), precipitation = `next_6_hours` amount / 6, symbol and probability from `next_6_hours` (symbol falls back to `next_12_hours`). This keeps `courseWeatherHourAt` working at any passage.
- Window: `startAt − 2 h` (floored to the hour) to `startAt + 48 h`, trimmed to the data MET returns. `windowStart`/`windowEnd` in the response are the trimmed bounds.
- Rounding: temperature, wind and precipitation to 0.1; direction, humidity, cloud cover and probability to integers.

## Presentation thresholds

From `COURSE_WEATHER_THRESHOLDS` in `packages/shared/src/course-weather/presentation.ts` (display alerts only):

| Alert | Rule |
|---|---|
| `heat` | feels-like ≥ 27 °C (heat index when T ≥ 27 °C with humidity) |
| `cold` | feels-like ≤ 0 °C (wind chill when T ≤ 10 °C and wind > 4.8 km/h) |
| `wind` | gust ≥ 60 km/h, or sustained wind ≥ 40 km/h when the source has no gusts |
| `rain` | precipitation ≥ 1 mm/h or a `rain` symbol |
| `storm` | `thunder` symbol |
| `snow` | `snow` or `sleet` symbol (replaces `rain`) |

Without a runner plan (public race page, Livret coureur without plan, Livret supporter), each point is summarised over the hours the field is likely to pass it: `courseWeatherLikelyPassageWindow(km, startAt)` gives `startAt + km / 12 km/h − 30 min` to `startAt + km / 4 km/h + 1 h` (`COURSE_WEATHER_FIELD_SPEED_KPH`), and `courseWeatherLikelyPassageHours` keeps the hours of that window (all hours when `startAt` is unknown). Summarising the whole 48 h window mixed daytime highs into night races (SaintéLyon showed −1 to 9 °C at a 23:30 start instead of −1 °C).

## Mobile display (inline in the passage rows)

Since 2026-11-25 the mobile app shows weather inside the rows that already carry passage times, not as a separate card (details in `docs/01-architecture/mobile-app.md` § Course weather):

- **Livret coureur** aid-station list (start, each aid station, finish): with a linked plan, the forecast hour at the runner's own passage = `startAt` shifted by the personal departure clock, plus the plan's elapsed minutes; without a plan, the field window above.
- **Livret supporter** stops: from the first expected arrival to the stop cutoff (organizer race-day clocks converted to instants by anchoring them on `startAt` in the response `timeZone`), the field window filling a missing bound.
- Rows are matched to forecast points by id (`start`, `finish`, `aid-<order_index>`) when the km agrees within 2 km, else by nearest km within 2 km; thinned or near-endpoint stations therefore borrow the closest point, and a row with no point within 2 km shows nothing.
- The attribution `Données météo : MET Norway (CC BY 4.0)` and the status messages (too early, stale copy, estimated start, device time) are rendered once per list, under the rows.

## Gotchas

- Outside MET's Nordic high-resolution model (i.e. France and most race locations) the `complete` product has **no `wind_speed_of_gust` and no `probability_of_precipitation`**: these fields are `null`, and `summarizeCourseWeatherHours` falls back to wind speed for `maxWindGustKph`. The `wind` alert then falls back to sustained wind ≥ 40 km/h.
- The last MET step carries only instant values: its hour has `symbol` and `precipitationMm` `null`.
- Forecast cache key is the point URL: changing rounding or the altitude source invalidates every cached point.
- Aid-station km are official kms projected on the GPX length; when the GPX is shorter than the official distance, late stations clamp to the GPX end. `distanceKm` stays the official km so planned passages match.
- The in-memory rate limiter is per serverless instance; the CDN cache in front of the route is the real protection for MET.
- Never put a personal address in the User-Agent and never call MET from the client apps: always through this route.
- Point ids use `order_index` server-side (`row.order_index ?? index`) while the mobile Livret reads `order_index ?? 0`; a null `order_index` can therefore mismatch the id, which the 2 km distance check and the nearest-km fallback absorb.
- Mobile converts local clocks to instants relative to `startAt`, so a DST change between the start and a passage is ignored (at most one hour, display only).

## Related Docs

- [race_start_waves](../02-database/tables/race-start-waves.md)
- [races](../02-database/tables/races.md)
- [GPX Import](../03-business-rules/gpx-import.md)
- [Packages Architecture](../01-architecture/packages.md)
- [Course Terrain from OpenStreetMap](../03-business-rules/course-terrain.md) (sister display-only feature, same visibility rule)
